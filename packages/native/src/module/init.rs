//! `GLib` main loop initialization and thread spawning.
//!
//! The [`init`] function spawns a dedicated `GLib` thread that runs a plain
//! `glib::MainLoop`. The loop reference is exposed to JavaScript as a
//! [`NativeHandle`] wrapping a `GMainLoop` boxed value, allowing the JS layer
//! to terminate it via `g_main_loop_quit` through the standard FFI dispatch.
//!
//! ## Startup Sequence
//!
//! 1. Wire up the wake and error-reporter threadsafe functions
//! 2. Spawn a new OS thread that runs the `GLib` main loop
//! 3. Build a [`NativeHandle`] for the loop and post a `glib::idle_add_once`
//!    barrier that fires on the first iteration to confirm liveness
//! 4. Block the JS thread on the barrier; once unblocked, return the handle
//! 5. The loop runs until JS calls `stop`, which dispatches a final task to
//!    drain pending finalizers and quit the loop
//!
//! Every function here wires threadsafe functions to a live [`napi::Env`] and
//! spawns the `GLib` thread, so the module is excluded from coverage
//! instrumentation.

#![cfg_attr(coverage_nightly, coverage(off))]

use std::panic::{self, AssertUnwindSafe};
use std::sync::Arc;
use std::sync::mpsc;

use gtk4::glib;
use napi::Env;
use napi::bindgen_prelude::*;
use napi::sys;
use napi_derive::napi;

use crate::dispatch::{Mailbox, WakeJsTsfn};
use crate::error_reporter::{ErrorReporterTsfn, NativeErrorReporter};
use crate::glib_log_handler::GlibLogHandler;
use crate::panic_handler::{format_panic_payload, install_panic_hook};
use crate::state::GlibThread;

#[napi(catch_unwind)]
#[cfg_attr(test, allow(dead_code))]
pub fn init(env: Env) -> napi::Result<External<glib::MainLoop>> {
    GlibThread::global()
        .begin_start()
        .map_err(|msg| napi::Error::new(napi::Status::GenericFailure, msg))?;

    let wake_js_fn = env.create_function_from_closure::<(), _, _>("gtkx_wake_js", |ctx| {
        Mailbox::global().process_node_pending(*ctx.env);
        Ok(())
    })?;

    let wake_tsfn: WakeJsTsfn = wake_js_fn
        .build_threadsafe_function::<()>()
        .weak::<true>()
        .callee_handled::<false>()
        .build()?;

    Mailbox::global().set_wake_tsfn(Arc::new(wake_tsfn));

    let error_fn =
        env.create_function_from_closure::<String, (), _>("gtkx_report_error", |ctx| {
            let msg: String = ctx.get(0)?;
            UnhandledRejection::emit(ctx.env, &msg);
            Ok(())
        })?;

    let error_tsfn: ErrorReporterTsfn = error_fn
        .build_threadsafe_function::<String>()
        .weak::<true>()
        .callee_handled::<false>()
        .build()?;

    NativeErrorReporter::global().initialize(Arc::new(error_tsfn));
    install_panic_hook();

    let (tx, rx) = mpsc::channel::<glib::MainLoop>();

    let handle = std::thread::Builder::new()
        .name("gtkx-glib".to_owned())
        .spawn(move || {
            let result = panic::catch_unwind(AssertUnwindSafe(|| {
                GlibLogHandler::install();

                let main_loop = glib::MainLoop::new(None, false);
                let main_loop_for_js = main_loop.clone();

                glib::idle_add_once(move || {
                    if tx.send(main_loop_for_js).is_err() {
                        NativeErrorReporter::global()
                            .report_str("GLib main loop ready but startup channel was closed");
                    }
                });

                main_loop.run();
            }));

            if let Err(payload) = result {
                NativeErrorReporter::global().report_str(&format!(
                    "GLib thread panicked: {}",
                    format_panic_payload(&*payload)
                ));
            }
        })
        .map_err(|err| {
            GlibThread::global().abort_start();
            napi::Error::new(
                napi::Status::GenericFailure,
                format!("Error spawning GLib thread: {err}"),
            )
        })?;

    GlibThread::global().set_handle(handle);

    let main_loop = rx.recv().map_err(|err| {
        let glib_thread = GlibThread::global();
        let panic_message = glib_thread.join();
        let _ = glib_thread.begin_stop();
        let cause = panic_message.unwrap_or_else(|| err.to_string());
        napi::Error::new(
            napi::Status::GenericFailure,
            format!("Error starting GLib thread: {cause}"),
        )
    })?;

    Ok(External::new(main_loop))
}

/// Surfaces native-side failures that have no JavaScript stack of their own by
/// emitting `unhandledRejection` events on the Node.js process.
#[cfg_attr(test, allow(dead_code))]
struct UnhandledRejection;

impl UnhandledRejection {
    /// Emits an `unhandledRejection` event on the Node.js process with a
    /// synthesized `Error` whose message is `msg`. The event flows through
    /// Node's standard rejection handling so userland code can suppress or
    /// redirect it via `process.on('unhandledRejection', ...)`.
    ///
    /// Falls back to `stderr` if any step of the emission fails.
    #[allow(clippy::trivially_copy_pass_by_ref)]
    #[cfg_attr(test, allow(dead_code))]
    fn emit(env: &Env, msg: &str) {
        if Self::try_emit(env, msg).is_none() {
            eprintln!("[gtkx] ERROR: {msg}");
        }
    }

    /// Performs the `unhandledRejection` emission, returning `None` as soon as
    /// any napi step fails so [`emit`](Self::emit) can fall back to `stderr`.
    #[cfg_attr(test, allow(dead_code))]
    fn try_emit(env: &Env, msg: &str) -> Option<()> {
        let raw_env = env.raw();
        // SAFETY: This runs on the JS thread with the live `env` of the
        // current callback; every value passed between the napi calls was
        // created under that same env.
        unsafe {
            let mut global = std::ptr::null_mut();
            (sys::napi_get_global(raw_env, &mut global) == sys::Status::napi_ok).then_some(())?;

            let mut process = std::ptr::null_mut();
            (sys::napi_get_named_property(raw_env, global, c"process".as_ptr(), &mut process)
                == sys::Status::napi_ok)
                .then_some(())?;

            let mut emit_fn = std::ptr::null_mut();
            (sys::napi_get_named_property(raw_env, process, c"emit".as_ptr(), &mut emit_fn)
                == sys::Status::napi_ok)
                .then_some(())?;

            let event_name =
                String::to_napi_value(raw_env, "unhandledRejection".to_owned()).ok()?;
            let error_obj = Self::make_error_object(raw_env, msg)?;
            let promise = Self::make_resolved_promise(raw_env)?;

            let args = [event_name, error_obj, promise];
            let mut result = std::ptr::null_mut();
            let _ = sys::napi_call_function(
                raw_env,
                process,
                emit_fn,
                args.len(),
                args.as_ptr(),
                &mut result,
            );

            let mut had_exception = false;
            sys::napi_is_exception_pending(raw_env, &mut had_exception);
            if had_exception {
                let mut exc = std::ptr::null_mut();
                sys::napi_get_and_clear_last_exception(raw_env, &mut exc);
            }
        }
        Some(())
    }

    #[cfg_attr(test, allow(dead_code))]
    unsafe fn make_error_object(env: sys::napi_env, msg: &str) -> Option<sys::napi_value> {
        // SAFETY: The caller passes the live env of the current JS-thread
        // callback, and `msg` provides valid UTF-8 bytes for the string.
        unsafe {
            let mut msg_value = std::ptr::null_mut();
            let bytes = msg.as_bytes();
            if sys::napi_create_string_utf8(
                env,
                bytes.as_ptr().cast(),
                bytes.len() as isize,
                &mut msg_value,
            ) != sys::Status::napi_ok
            {
                return None;
            }
            let mut error = std::ptr::null_mut();
            if sys::napi_create_error(env, std::ptr::null_mut(), msg_value, &mut error)
                != sys::Status::napi_ok
            {
                return None;
            }
            Some(error)
        }
    }

    #[cfg_attr(test, allow(dead_code))]
    unsafe fn make_resolved_promise(env: sys::napi_env) -> Option<sys::napi_value> {
        // SAFETY: The caller passes the live env of the current JS-thread
        // callback; the deferred and undefined values are created under it.
        unsafe {
            let mut deferred = std::ptr::null_mut();
            let mut promise = std::ptr::null_mut();
            if sys::napi_create_promise(env, &mut deferred, &mut promise) != sys::Status::napi_ok {
                return None;
            }
            let mut undefined = std::ptr::null_mut();
            sys::napi_get_undefined(env, &mut undefined);
            sys::napi_resolve_deferred(env, deferred, undefined);
            Some(promise)
        }
    }
}

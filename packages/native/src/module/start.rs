//! `GLib` main loop initialization and thread spawning.
//!
//! The [`start`] function spawns a dedicated `GLib` thread that runs a plain
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

use std::ffi::c_void;
use std::sync::Arc;
use std::sync::mpsc;

use gtk4::glib::{
    self,
    translate::{FromGlib, IntoGlibPtr},
};
use napi::Env;
use napi::bindgen_prelude::*;
use napi::sys;
use napi_derive::napi;

use crate::dispatch::{Mailbox, WakeJsTsfn};
use crate::error_reporter::{ErrorReporterTsfn, NativeErrorReporter};
use crate::glib_log_handler::GlibLogHandler;
use crate::managed::{Boxed, NativeHandle, NativeValue};

#[napi]
pub fn start(env: Env) -> napi::Result<External<NativeHandle>> {
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
            emit_unhandled_rejection(ctx.env, &msg);
            Ok(())
        })?;

    let error_tsfn: ErrorReporterTsfn = error_fn
        .build_threadsafe_function::<String>()
        .weak::<true>()
        .callee_handled::<false>()
        .build()?;

    NativeErrorReporter::global().initialize(Arc::new(error_tsfn));

    let (tx, rx) = mpsc::channel::<NativeHandle>();

    std::thread::spawn(move || {
        GlibLogHandler::install();

        let main_loop = glib::MainLoop::new(None, false);
        let main_loop_for_js = main_loop.clone();

        glib::idle_add_once(move || {
            let gtype = unsafe { glib::Type::from_glib(glib::ffi::g_main_loop_get_type()) };
            let raw_ptr = IntoGlibPtr::<*mut glib::ffi::GMainLoop>::into_glib_ptr(main_loop_for_js)
                as *mut c_void;
            let boxed = Boxed::from_glib_full(Some(gtype), raw_ptr);
            let handle: NativeHandle = NativeValue::Boxed(boxed).into();

            if tx.send(handle).is_err() {
                NativeErrorReporter::global()
                    .report_str("GLib main loop ready but startup channel was closed");
            }
        });

        main_loop.run();
    });

    let main_loop_handle = rx.recv().map_err(|err| {
        napi::Error::new(
            napi::Status::GenericFailure,
            format!("Error starting GLib thread: {err}"),
        )
    })?;

    Ok(External::new(main_loop_handle))
}

/// Emits an `unhandledRejection` event on the Node.js process with a synthesized
/// `Error` whose message is `msg`. The event flows through Node's standard
/// rejection handling so userland code can suppress or redirect it via
/// `process.on('unhandledRejection', ...)`.
fn emit_unhandled_rejection(env: &Env, msg: &str) {
    let raw_env = env.raw();
    unsafe {
        let mut global = std::ptr::null_mut();
        if sys::napi_get_global(raw_env, &mut global) != sys::Status::napi_ok {
            eprintln!("[gtkx] ERROR: {msg}");
            return;
        }

        let mut process = std::ptr::null_mut();
        if sys::napi_get_named_property(raw_env, global, c"process".as_ptr(), &mut process)
            != sys::Status::napi_ok
        {
            eprintln!("[gtkx] ERROR: {msg}");
            return;
        }

        let mut emit = std::ptr::null_mut();
        if sys::napi_get_named_property(raw_env, process, c"emit".as_ptr(), &mut emit)
            != sys::Status::napi_ok
        {
            eprintln!("[gtkx] ERROR: {msg}");
            return;
        }

        let Ok(event_name) = String::to_napi_value(raw_env, "unhandledRejection".to_owned()) else {
            eprintln!("[gtkx] ERROR: {msg}");
            return;
        };

        let Some(error_obj) = make_error_object(raw_env, msg) else {
            eprintln!("[gtkx] ERROR: {msg}");
            return;
        };

        let Some(promise) = make_resolved_promise(raw_env) else {
            eprintln!("[gtkx] ERROR: {msg}");
            return;
        };

        let args = [event_name, error_obj, promise];
        let mut result = std::ptr::null_mut();
        let _ = sys::napi_call_function(
            raw_env,
            process,
            emit,
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
}

unsafe fn make_error_object(env: sys::napi_env, msg: &str) -> Option<sys::napi_value> {
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

unsafe fn make_resolved_promise(env: sys::napi_env) -> Option<sys::napi_value> {
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

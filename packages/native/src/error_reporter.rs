//! Native-side error surface for the JavaScript thread.
//!
//! [`NativeErrorReporter`] is a process-global singleton holding a
//! [`ThreadsafeFunction`] installed once at startup. Any thread can call
//! [`NativeErrorReporter::report`] / [`NativeErrorReporter::report_str`]; the
//! TSFN schedules the message back onto the JavaScript thread where it is
//! raised as an uncaught exception.
//!
//! The TSFN is `Weak`, so a pending error never keeps the Node.js event loop
//! alive past natural shutdown.
//!
//! Every path here either installs or invokes a threadsafe function bound to
//! the Node.js event loop, so the module is excluded from coverage
//! instrumentation — a `cargo test` process has no event loop to drive it.

#![cfg_attr(coverage_nightly, coverage(off))]

use std::sync::{Arc, OnceLock};

use napi::bindgen_prelude::*;
use napi::threadsafe_function::{ThreadsafeFunction, ThreadsafeFunctionCallMode};
use napi::{Env, Status, sys};

/// Type alias for the threadsafe function used to throw native errors on the
/// JavaScript thread.
///
/// The const generics encode `CalleeHandled = false` and `Weak = true`.
pub type ErrorReporterTsfn = ThreadsafeFunction<String, (), String, Status, false, true>;

/// Process-global error reporter routing native errors back to JavaScript.
pub struct NativeErrorReporter {
    tsfn: OnceLock<Arc<ErrorReporterTsfn>>,
}

impl std::fmt::Debug for NativeErrorReporter {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("NativeErrorReporter")
            .field("initialized", &self.tsfn.get().is_some())
            .finish_non_exhaustive()
    }
}

static REPORTER: OnceLock<NativeErrorReporter> = OnceLock::new();

impl NativeErrorReporter {
    /// Returns the global reporter, initializing it on first access.
    pub fn global() -> &'static Self {
        REPORTER.get_or_init(|| Self {
            tsfn: OnceLock::new(),
        })
    }

    /// Installs the JavaScript-thread TSFN. Called exactly once during startup.
    ///
    /// Subsequent calls are silently ignored to keep the singleton write-once.
    pub fn initialize(&self, tsfn: Arc<ErrorReporterTsfn>) {
        let _ = self.tsfn.set(tsfn);
    }

    /// Builds the `gtkx_report_error` JS function and its threadsafe function,
    /// then initializes the reporter with it. The function surfaces each native
    /// error as an `unhandledRejection` on the Node.js process through
    /// [`UnhandledRejection`].
    pub fn install(&self, env: Env) -> napi::Result<()> {
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

        self.initialize(Arc::new(error_tsfn));
        Ok(())
    }

    /// Reports an [`anyhow::Error`] (with full chain) as a JavaScript exception.
    pub fn report(&self, error: &anyhow::Error) {
        self.report_str(&format!("{error:#}"));
    }

    /// Reports a free-form message as a JavaScript exception.
    ///
    /// Falls back to `stderr` if the reporter has not been initialized, so
    /// startup errors are still observable.
    pub fn report_str(&self, message: &str) {
        let Some(tsfn) = self.tsfn.get() else {
            eprintln!("[gtkx] ERROR (not initialized): {message}");
            return;
        };

        tsfn.call(message.to_owned(), ThreadsafeFunctionCallMode::NonBlocking);
    }
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

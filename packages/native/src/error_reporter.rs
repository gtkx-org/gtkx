#![cfg_attr(coverage_nightly, coverage(off))]

use std::sync::{Arc, OnceLock};

use napi::bindgen_prelude::*;
use napi::threadsafe_function::{ThreadsafeFunction, ThreadsafeFunctionCallMode};
use napi::{Env, Status, sys};

pub type ErrorReporterTsfn = ThreadsafeFunction<String, (), String, Status, false, true>;

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
    pub fn global() -> &'static Self {
        REPORTER.get_or_init(|| Self {
            tsfn: OnceLock::new(),
        })
    }

    pub fn initialize(&self, tsfn: Arc<ErrorReporterTsfn>) {
        let _ = self.tsfn.set(tsfn);
    }

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

    pub fn report(&self, error: &anyhow::Error) {
        self.report_str(&format!("{error:#}"));
    }

    pub fn report_str(&self, message: &str) {
        let Some(tsfn) = self.tsfn.get() else {
            eprintln!("[gtkx] ERROR (not initialized): {message}");
            return;
        };

        tsfn.call(message.to_owned(), ThreadsafeFunctionCallMode::NonBlocking);
    }
}

#[cfg_attr(test, allow(dead_code))]
struct UnhandledRejection;

impl UnhandledRejection {
    #[allow(clippy::trivially_copy_pass_by_ref)]
    #[cfg_attr(test, allow(dead_code))]
    fn emit(env: &Env, msg: &str) {
        if Self::try_emit(env, msg).is_none() {
            eprintln!("[gtkx] ERROR: {msg}");
        }
    }

    #[cfg_attr(test, allow(dead_code))]
    fn try_emit(env: &Env, msg: &str) -> Option<()> {
        let raw_env = env.raw();
        // SAFETY: runs on the Node (JS) thread that owns `env`, so `raw_env` is its live napi env.
        // Every napi call below passes that env with out-pointers to local, correctly typed slots,
        // and each derived value (`global`, `process`, `emit_fn`, the argument values) is checked
        // for success before use; `make_error_object`/`make_resolved_promise` are called with the
        // same valid env. Any pending exception from the emit call is fetched and cleared.
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

    /// # Safety
    ///
    /// `env` must be a live napi env for the current (Node) thread. The returned value, if any, is
    /// a napi `Error` object valid within that env.
    #[cfg_attr(test, allow(dead_code))]
    unsafe fn make_error_object(env: sys::napi_env, msg: &str) -> Option<sys::napi_value> {
        // SAFETY: per the contract `env` is a live napi env; the string and error are created via
        // napi calls with out-pointers to local slots, and each call's status is checked before the
        // produced value is used. `msg.as_bytes()` provides a valid pointer/length for the string.
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

    /// # Safety
    ///
    /// `env` must be a live napi env for the current (Node) thread. The returned value, if any, is
    /// an already-resolved napi `Promise` valid within that env.
    #[cfg_attr(test, allow(dead_code))]
    unsafe fn make_resolved_promise(env: sys::napi_env) -> Option<sys::napi_value> {
        // SAFETY: per the contract `env` is a live napi env; the promise/deferred pair and the
        // undefined value are created via napi calls into local out-pointer slots, the create status
        // is checked, and the deferred is resolved with that undefined value once.
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

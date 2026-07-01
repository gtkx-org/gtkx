use std::sync::{Arc, OnceLock};

use napi::bindgen_prelude::*;
use napi::threadsafe_function::{ThreadsafeFunction, ThreadsafeFunctionCallMode};
use napi::{Env, Status, sys};

pub type ErrorReporterTsfn = ThreadsafeFunction<String, (), String, Status, false, true>;

pub struct ErrorReporter {
    tsfn: OnceLock<Arc<ErrorReporterTsfn>>,
}

impl std::fmt::Debug for ErrorReporter {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("ErrorReporter")
            .field("initialized", &self.tsfn.get().is_some())
            .finish_non_exhaustive()
    }
}

static REPORTER: OnceLock<ErrorReporter> = OnceLock::new();

impl ErrorReporter {
    pub fn global() -> &'static Self {
        REPORTER.get_or_init(|| Self {
            tsfn: OnceLock::new(),
        })
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

        let _ = self.tsfn.set(Arc::new(error_tsfn));
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

pub trait ReportErr<T> {
    fn report_err<C>(self, context: C) -> Option<T>
    where
        C: std::fmt::Display + Send + Sync + 'static;
}

impl<T> ReportErr<T> for anyhow::Result<T> {
    fn report_err<C>(self, context: C) -> Option<T>
    where
        C: std::fmt::Display + Send + Sync + 'static,
    {
        match self {
            Ok(value) => Some(value),
            Err(error) => {
                ErrorReporter::global().report(&error.context(context));
                None
            }
        }
    }
}

struct UnhandledRejection;

impl UnhandledRejection {
    fn emit(env: &Env, msg: &str) {
        if Self::try_emit(env, msg).is_none() {
            eprintln!("[gtkx] ERROR: {msg}");
        }
    }

    fn try_emit(env: &Env, msg: &str) -> Option<()> {
        let raw_env = env.raw();
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
}

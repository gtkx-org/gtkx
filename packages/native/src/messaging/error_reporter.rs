use std::sync::OnceLock;

use napi::bindgen_prelude::*;
use napi::threadsafe_function::{ThreadsafeFunction, ThreadsafeFunctionCallMode};
use napi::{Env, Status};

pub type ErrorReporterTsfn = ThreadsafeFunction<String, (), String, Status, false, true>;

pub struct ErrorReporter {
    tsfn: OnceLock<ErrorReporterTsfn>,
}

static REPORTER: ErrorReporter = ErrorReporter {
    tsfn: OnceLock::new(),
};

impl ErrorReporter {
    pub fn global() -> &'static Self {
        &REPORTER
    }

    pub fn install(&self, env: Env) -> napi::Result<()> {
        let error_tsfn = super::build_weak_tsfn::<String, _>(env, "gtkx_report_error", |ctx| {
            let message: String = ctx.get(0)?;
            UnhandledRejection::emit(ctx.env, &message);
            Ok(())
        })?;

        let _ = self.tsfn.set(error_tsfn);
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
    fn emit(env: &Env, message: &str) {
        if Self::try_emit(env, message).is_err() {
            eprintln!("[gtkx] ERROR: {message}");
        }
    }

    fn try_emit(env: &Env, message: &str) -> napi::Result<()> {
        let global = env.get_global()?;
        let process: Object = global.get_named_property("process")?;
        let emit: Function<FnArgs<(String, Object, PromiseRaw<()>)>> =
            process.get_named_property("emit")?;
        let error = env.create_error(Error::new(Status::GenericFailure, message.to_owned()))?;
        let promise = PromiseRaw::resolve(env, ())?;
        emit.bind(process)?.call(FnArgs {
            data: ("unhandledRejection".to_owned(), error, promise),
        })?;
        Ok(())
    }
}

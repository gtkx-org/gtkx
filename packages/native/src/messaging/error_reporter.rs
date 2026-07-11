use napi::{Error, Status};

use super::node_env;

pub struct ErrorReporter;

static REPORTER: ErrorReporter = ErrorReporter;

impl ErrorReporter {
    pub fn global() -> &'static Self {
        &REPORTER
    }

    pub fn report(&self, error: &anyhow::Error) {
        self.report_str(&format!("{error:#}"));
    }

    pub fn report_str(&self, message: &str) {
        eprintln!("gtkx: {message}");
        node_env::env().fatal_exception(Error::new(Status::GenericFailure, message.to_owned()));
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn report_str_prints_and_raises_a_fatal_exception() {
        test_support::run(|| {
            ErrorReporter::global().report_str("a diagnostic");
            assert!(test_support::napi_mock::count("napi_fatal_exception") >= 1);
        });
    }

    #[test]
    fn report_formats_an_anyhow_error() {
        test_support::run(|| {
            let error = anyhow::anyhow!("boom").context("while doing work");
            ErrorReporter::global().report(&error);
            assert!(test_support::napi_mock::count("napi_fatal_exception") >= 1);
        });
    }

    #[test]
    fn report_err_passes_ok_through_and_reports_err() {
        test_support::run(|| {
            let ok: anyhow::Result<u32> = Ok(5);
            assert_eq!(ok.report_err("context"), Some(5));

            let failed: anyhow::Result<u32> = Err(anyhow::anyhow!("nope"));
            assert_eq!(failed.report_err("adding context"), None);
            assert!(test_support::napi_mock::count("napi_fatal_exception") >= 1);
        });
    }
}

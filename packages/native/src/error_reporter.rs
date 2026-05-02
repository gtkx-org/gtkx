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

use std::sync::{Arc, OnceLock};

use napi::Status;
use napi::threadsafe_function::{ThreadsafeFunction, ThreadsafeFunctionCallMode};

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
    /// Returns the global reporter, initialising it on first access.
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

    /// Reports an [`anyhow::Error`] (with full chain) as a JavaScript exception.
    pub fn report(&self, error: &anyhow::Error) {
        self.report_str(&format!("{error:#}"));
    }

    /// Reports a free-form message as a JavaScript exception.
    ///
    /// Falls back to `stderr` if the reporter has not been initialised, so
    /// startup errors are still observable.
    pub fn report_str(&self, message: &str) {
        let Some(tsfn) = self.tsfn.get() else {
            eprintln!("[gtkx] ERROR (not initialized): {message}");
            return;
        };

        tsfn.call(message.to_owned(), ThreadsafeFunctionCallMode::NonBlocking);
    }
}

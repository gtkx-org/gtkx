//! Routes `GLib` log messages to stderr and the JavaScript error reporter.
//!
//! Every log message is written to stderr synchronously so it is observable
//! even if the process aborts before the JavaScript event loop can drain.
//! `Error` and `Critical` levels additionally forward through
//! [`NativeErrorReporter`], which raises them as JavaScript exceptions on the
//! Node.js event loop.

#![cfg_attr(coverage_nightly, coverage(off))]

use gtk4::glib::{self, LogLevel};

use crate::error_reporter::NativeErrorReporter;

#[derive(Debug)]
pub struct GlibLogHandler;

impl GlibLogHandler {
    pub fn install() {
        glib::log_set_default_handler(Self::handle_log);
    }

    fn handle_log(domain: Option<&str>, level: LogLevel, message: &str) {
        let level_str = match level {
            LogLevel::Error => "ERROR",
            LogLevel::Critical => "CRITICAL",
            LogLevel::Warning => "WARNING",
            LogLevel::Message => "MESSAGE",
            LogLevel::Info => "INFO",
            LogLevel::Debug => "DEBUG",
        };
        let domain_str = domain.unwrap_or("unknown");
        let formatted = format!("{domain_str}-{level_str}: {message}");

        eprintln!("[gtkx] {formatted}");

        if matches!(level, LogLevel::Error | LogLevel::Critical) {
            NativeErrorReporter::global().report_str(&formatted);
        }
    }
}

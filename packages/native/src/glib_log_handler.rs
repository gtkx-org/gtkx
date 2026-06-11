//! Routes `GLib` log messages to the JavaScript error reporter.
//!
//! The handler installs a structured log **writer**
//! (`glib::log_set_writer_func`), which receives every message: legacy
//! `g_log` calls, structured `g_log_structured` calls (used by parts of GTK
//! itself), and `GTK` criticals. `Error` and `Critical` levels forward
//! through [`NativeErrorReporter`], which raises them as JavaScript
//! exceptions on the Node.js event loop; every message then delegates to
//! `glib::log_writer_default`, which applies the standard would-drop
//! filtering and journald/stderr selection synchronously, so fatal output is
//! observable even if the process aborts before the JavaScript event loop can
//! drain.

#![cfg_attr(coverage_nightly, coverage(off))]

use std::sync::OnceLock;

use gtk4::glib::{self, LogLevel, LogWriterOutput};

use crate::error_reporter::NativeErrorReporter;

/// Guards the writer installation: `GLib` allows the writer function to be
/// set only once per process, and the `glib` wrapper panics on a second call.
static INSTALLED: OnceLock<()> = OnceLock::new();

#[derive(Debug)]
pub struct GlibLogHandler;

impl GlibLogHandler {
    /// Installs the structured log writer. Calls after the first are no-ops.
    pub fn install() {
        INSTALLED.get_or_init(|| {
            glib::log_set_writer_func(Self::write_log);
        });
    }

    fn write_log(level: LogLevel, fields: &[glib::LogField<'_>]) -> LogWriterOutput {
        if matches!(level, LogLevel::Error | LogLevel::Critical) {
            let level_str = if level == LogLevel::Error {
                "ERROR"
            } else {
                "CRITICAL"
            };
            let domain = field_value(fields, "GLIB_DOMAIN").unwrap_or("unknown");
            let message = field_value(fields, "MESSAGE").unwrap_or("(no message)");
            NativeErrorReporter::global().report_str(&format!("{domain}-{level_str}: {message}"));
        }

        glib::log_writer_default(level, fields)
    }
}

/// Returns the UTF-8 value of the log field named `key`, when present.
fn field_value<'a>(fields: &'a [glib::LogField<'_>], key: &str) -> Option<&'a str> {
    fields
        .iter()
        .find(|field| field.key() == key)
        .and_then(glib::LogField::value_str)
}

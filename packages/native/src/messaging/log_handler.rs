use std::sync::OnceLock;

use glib::{LogLevel, LogWriterOutput};

use crate::messaging::error_reporter::ErrorReporter;
use crate::messaging::{NATIVE_LOG_PREFIX, native_debug_enabled};

static INSTALLED: OnceLock<()> = OnceLock::new();

#[derive(Debug)]
pub struct GlibLogHandler;

impl GlibLogHandler {
    pub fn install() {
        INSTALLED.get_or_init(|| {
            glib::log_set_writer_func(Self::write_log);
        });
    }

    fn write_log(level: LogLevel, fields: &[glib::LogField<'_>]) -> LogWriterOutput {
        let domain = field_value(fields, "GLIB_DOMAIN").unwrap_or("unknown");
        let message = field_value(fields, "MESSAGE").unwrap_or("(no message)");
        match level {
            LogLevel::Error => {
                ErrorReporter::global().report_str(&format!("{domain}-ERROR: {message}"));
                glib::log_writer_default(level, fields)
            }
            LogLevel::Critical => {
                ErrorReporter::global().report_str(&format!("{domain}-CRITICAL: {message}"));
                glib::log_writer_default(level, fields)
            }
            LogLevel::Warning => {
                eprintln!("{NATIVE_LOG_PREFIX} warn {domain}: {message}");
                LogWriterOutput::Handled
            }
            LogLevel::Message | LogLevel::Info => {
                eprintln!("{NATIVE_LOG_PREFIX} {domain}: {message}");
                LogWriterOutput::Handled
            }
            LogLevel::Debug => {
                if native_debug_enabled() {
                    eprintln!("{NATIVE_LOG_PREFIX} {domain}: {message}");
                }
                LogWriterOutput::Handled
            }
        }
    }
}

fn field_value<'a>(fields: &'a [glib::LogField<'_>], key: &str) -> Option<&'a str> {
    fields
        .iter()
        .find(|field| field.key() == key)
        .and_then(glib::LogField::value_str)
}

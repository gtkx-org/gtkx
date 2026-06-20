#![cfg_attr(coverage_nightly, coverage(off))]

use std::sync::OnceLock;

use glib::{LogLevel, LogWriterOutput};

use crate::error_reporter::NativeErrorReporter;

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
        let level_str = match level {
            LogLevel::Error => "ERROR",
            LogLevel::Critical => "CRITICAL",
            _ => return glib::log_writer_default(level, fields),
        };
        let domain = field_value(fields, "GLIB_DOMAIN").unwrap_or("unknown");
        let message = field_value(fields, "MESSAGE").unwrap_or("(no message)");
        NativeErrorReporter::global().report_str(&format!("{domain}-{level_str}: {message}"));
        glib::log_writer_default(level, fields)
    }
}

fn field_value<'a>(fields: &'a [glib::LogField<'_>], key: &str) -> Option<&'a str> {
    fields
        .iter()
        .find(|field| field.key() == key)
        .and_then(glib::LogField::value_str)
}

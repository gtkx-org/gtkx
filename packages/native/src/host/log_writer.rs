use std::sync::OnceLock;

use glib::{LogField, LogLevel, LogWriterOutput};

use super::error_reporter;

static INSTALLED: OnceLock<()> = OnceLock::new();

pub(crate) fn install() {
    INSTALLED.get_or_init(|| {
        glib::log_set_writer_func(write_log);
    });
}

fn write_log(level: LogLevel, fields: &[LogField<'_>]) -> LogWriterOutput {
    if let Some(severity) = fatal_severity(level) {
        let domain = field_value(fields, "GLIB_DOMAIN").unwrap_or("unknown");
        let message = field_value(fields, "MESSAGE").unwrap_or("(no message)");
        error_reporter::report_str(&format!("{domain}-{severity}: {message}"));
    }
    glib::log_writer_default(level, fields)
}

fn fatal_severity(level: LogLevel) -> Option<&'static str> {
    match level {
        LogLevel::Error => Some("ERROR"),
        LogLevel::Critical => Some("CRITICAL"),
        LogLevel::Warning | LogLevel::Message | LogLevel::Info | LogLevel::Debug => None,
    }
}

fn field_value<'a>(fields: &'a [LogField<'_>], key: &str) -> Option<&'a str> {
    fields
        .iter()
        .find(|field| field.key() == key)
        .and_then(LogField::value_str)
}

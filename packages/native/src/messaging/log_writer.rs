use std::sync::OnceLock;

use glib::{LogField, LogLevel, LogWriterOutput};

use super::error_reporter::ErrorReporter;

static INSTALLED: OnceLock<()> = OnceLock::new();

pub fn install() {
    INSTALLED.get_or_init(|| {
        glib::log_set_writer_func(write_log);
    });
}

fn write_log(level: LogLevel, fields: &[LogField<'_>]) -> LogWriterOutput {
    if let Some(severity) = fatal_severity(level) {
        let domain = field_value(fields, "GLIB_DOMAIN").unwrap_or("unknown");
        let message = field_value(fields, "MESSAGE").unwrap_or("(no message)");
        ErrorReporter::global().report_str(&format!("{domain}-{severity}: {message}"));
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

#[cfg(test)]
mod tests {
    use glib::gstr;
    use test_support::napi_mock;

    use super::*;
    use crate::messaging::node_env;

    fn entry_fields<'a>(domain: &'a str, message: &'a str) -> [LogField<'a>; 2] {
        [
            LogField::new(gstr!("GLIB_DOMAIN"), domain.as_bytes()),
            LogField::new(gstr!("MESSAGE"), message.as_bytes()),
        ]
    }

    #[test]
    fn error_and_critical_are_the_fatal_severities() {
        assert_eq!(fatal_severity(LogLevel::Error), Some("ERROR"));
        assert_eq!(fatal_severity(LogLevel::Critical), Some("CRITICAL"));
        assert_eq!(fatal_severity(LogLevel::Warning), None);
        assert_eq!(fatal_severity(LogLevel::Message), None);
        assert_eq!(fatal_severity(LogLevel::Info), None);
        assert_eq!(fatal_severity(LogLevel::Debug), None);
    }

    #[test]
    fn critical_entries_raise_a_fatal_exception() {
        node_env::run_installed(|| {
            let before = napi_mock::count("napi_fatal_exception");
            let output = write_log(
                LogLevel::Critical,
                &entry_fields("Gtk", "invalid widget use"),
            );
            assert_eq!(output, LogWriterOutput::Handled);
            assert_eq!(napi_mock::count("napi_fatal_exception"), before + 1);
        });
    }

    #[test]
    fn sub_critical_entries_flow_to_the_default_writer_without_reporting() {
        node_env::run_installed(|| {
            let before = napi_mock::count("napi_fatal_exception");
            for level in [LogLevel::Warning, LogLevel::Message, LogLevel::Debug] {
                write_log(level, &entry_fields("Gtk", "a routine entry"));
            }
            assert_eq!(napi_mock::count("napi_fatal_exception"), before);
        });
    }

    #[test]
    fn off_thread_criticals_marshal_the_fatal_to_the_install_thread() {
        node_env::run_installed(|| {
            let before = napi_mock::count("napi_fatal_exception");
            let count_on_emitting_thread = std::thread::spawn(move || {
                write_log(
                    LogLevel::Critical,
                    &entry_fields("Gtk", "an off-thread critical"),
                );
                napi_mock::count("napi_fatal_exception")
            })
            .join()
            .expect("the off-thread writer call should not crash");
            assert_eq!(count_on_emitting_thread, before);

            test_support::pump_default_context_until(|| {
                napi_mock::count("napi_fatal_exception") > before
            });
            assert_eq!(napi_mock::count("napi_fatal_exception"), before + 1);
        });
    }

    #[test]
    fn installed_writer_receives_structured_glib_logs() {
        node_env::run_installed(|| {
            install();
            install();
            let before = napi_mock::count("napi_fatal_exception");
            glib::log_structured!(
                "gtkx-test",
                LogLevel::Critical,
                {
                    "MESSAGE" => "a structured critical";
                }
            );
            assert_eq!(napi_mock::count("napi_fatal_exception"), before + 1);
        });
    }
}

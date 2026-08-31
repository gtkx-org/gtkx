use std::cell::RefCell;
use std::sync::OnceLock;

use glib::{LogField, LogLevel, LogWriterOutput};

use super::error_reporter;

static INSTALLED: OnceLock<()> = OnceLock::new();

/// State of the trap on one thread: `armed` for as long as a native call is on that thread's
/// stack, `caught` holding the first `G_LOG_LEVEL_CRITICAL` the callee logged while it was.
struct TrapSlot {
    armed: bool,
    caught: Option<String>,
}

thread_local! {
    static CRITICAL_TRAP: RefCell<TrapSlot> = const {
        RefCell::new(TrapSlot {
            armed: false,
            caught: None,
        })
    };
}

/// Collects the criticals a callee logs instead of raising them into JavaScript from the callee's
/// own stack frame, so a callee that rejects its arguments through `g_return_if_fail` fails the
/// call that made it rather than the process. Armed for the duration of one `cif.call` and
/// restores the enclosing trap when disarmed, so a call made from inside a callback keeps its own.
/// Restoring also happens on drop, so a call that unwinds cannot leave the trap armed and swallow
/// the criticals logged after it.
pub(crate) struct CriticalTrap {
    outer: Option<TrapSlot>,
}

impl CriticalTrap {
    pub(crate) fn arm() -> Self {
        let armed = TrapSlot {
            armed: true,
            caught: None,
        };

        Self {
            outer: Some(CRITICAL_TRAP.with(|trap| trap.replace(armed))),
        }
    }

    pub(crate) fn disarm(mut self) -> Option<String> {
        self.restore()
    }

    fn restore(&mut self) -> Option<String> {
        let outer = self.outer.take()?;

        CRITICAL_TRAP.with(|trap| trap.replace(outer)).caught
    }
}

impl Drop for CriticalTrap {
    fn drop(&mut self) {
        self.restore();
    }
}

pub(crate) fn install() {
    INSTALLED.get_or_init(|| {
        glib::log_set_writer_func(write_log);
    });
}

fn write_log(level: LogLevel, fields: &[LogField<'_>]) -> LogWriterOutput {
    if let Some(severity) = fatal_severity(level) {
        let domain = field_value(fields, "GLIB_DOMAIN").unwrap_or("unknown");
        let message = field_value(fields, "MESSAGE").unwrap_or("(no message)");
        let report = format!("{domain}-{severity}: {message}");

        if !matches!(level, LogLevel::Critical) || !trap(&report) {
            error_reporter::report_str(&report);
        }
    }
    glib::log_writer_default(level, fields)
}

fn trap(message: &str) -> bool {
    CRITICAL_TRAP.with(|cell| {
        let Ok(mut slot) = cell.try_borrow_mut() else {
            return false;
        };

        if !slot.armed {
            return false;
        }

        if slot.caught.is_none() {
            slot.caught = Some(message.to_owned());
        }

        true
    })
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

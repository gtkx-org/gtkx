use std::any::Any;
use std::panic::{self, AssertUnwindSafe, PanicHookInfo};
use std::sync::OnceLock;

use crate::messaging::error_reporter::ErrorReporter;

static PANIC_HOOK_INSTALLED: OnceLock<()> = OnceLock::new();

pub fn guard_ffi_boundary<R>(context: &str, body: impl FnOnce() -> R) -> Option<R> {
    match panic::catch_unwind(AssertUnwindSafe(body)) {
        Ok(value) => Some(value),
        Err(payload) => {
            ErrorReporter::global().report_str(&format!(
                "panic at {context}: {}",
                format_panic_payload(&*payload)
            ));
            None
        }
    }
}

pub fn format_panic_payload(payload: &(dyn Any + Send)) -> String {
    payload
        .downcast_ref::<&str>()
        .copied()
        .map(str::to_owned)
        .or_else(|| payload.downcast_ref::<String>().cloned())
        .unwrap_or_else(|| "unknown panic".to_owned())
}

pub fn format_panic_report(info: &PanicHookInfo<'_>) -> String {
    let location = info
        .location()
        .map(|loc| format!(" at {}:{}:{}", loc.file(), loc.line(), loc.column()))
        .unwrap_or_default();
    let message = format_panic_payload(info.payload());
    let thread = std::thread::current();
    let thread_name = thread.name().unwrap_or("<unnamed>");
    format!("native panic on thread '{thread_name}'{location}: {message}")
}

pub fn install_panic_hook() {
    PANIC_HOOK_INSTALLED.get_or_init(|| {
        let previous = panic::take_hook();
        panic::set_hook(Box::new(move |info: &PanicHookInfo<'_>| {
            previous(info);
            ErrorReporter::global().report_str(&format_panic_report(info));
        }));
    });
}

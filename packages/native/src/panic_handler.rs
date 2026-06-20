use std::any::Any;
use std::panic::{self, PanicHookInfo};
use std::sync::OnceLock;

use crate::error_reporter::NativeErrorReporter;

static PANIC_HOOK_INSTALLED: OnceLock<()> = OnceLock::new();

#[must_use]
pub fn format_panic_payload(payload: &(dyn Any + Send)) -> String {
    payload
        .downcast_ref::<&str>()
        .copied()
        .map(str::to_owned)
        .or_else(|| payload.downcast_ref::<String>().cloned())
        .unwrap_or_else(|| "unknown panic".to_owned())
}

#[must_use]
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

#[cfg_attr(coverage_nightly, coverage(off))]
pub fn install_panic_hook() {
    PANIC_HOOK_INSTALLED.get_or_init(|| {
        let previous = panic::take_hook();
        panic::set_hook(Box::new(move |info: &PanicHookInfo<'_>| {
            previous(info);
            NativeErrorReporter::global().report_str(&format_panic_report(info));
        }));
    });
}

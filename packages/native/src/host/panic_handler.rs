use std::any::Any;
use std::cell::Cell;
use std::panic::{self, AssertUnwindSafe};
use std::sync::OnceLock;

use crate::host::error_reporter;

static INSTALLED: OnceLock<()> = OnceLock::new();

thread_local! {
    static PANIC_LOCATION: Cell<Option<String>> = const { Cell::new(None) };
}

pub fn install() {
    INSTALLED.get_or_init(|| {
        let previous = panic::take_hook();
        panic::set_hook(Box::new(move |info| {
            PANIC_LOCATION.set(info.location().map(ToString::to_string));
            previous(info);
        }));
    });
}

pub fn guard_ffi_boundary<R>(context: &str, body: impl FnOnce() -> R) -> Option<R> {
    match panic::catch_unwind(AssertUnwindSafe(body)) {
        Ok(value) => Some(value),
        Err(payload) => {
            error_reporter::report_str(&format!(
                "panic at {context} ({}): {}",
                take_panic_location(),
                format_panic_payload(&*payload)
            ));
            None
        }
    }
}

fn take_panic_location() -> String {
    PANIC_LOCATION
        .take()
        .unwrap_or_else(|| "unknown location".to_owned())
}

pub fn format_panic_payload(payload: &(dyn Any + Send)) -> String {
    payload
        .downcast_ref::<&str>()
        .copied()
        .map(str::to_owned)
        .or_else(|| payload.downcast_ref::<String>().cloned())
        .unwrap_or_else(|| "unknown panic".to_owned())
}

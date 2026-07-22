use std::any::Any;
use std::panic::{self, AssertUnwindSafe};

use crate::host::error_reporter;

pub fn guard_ffi_boundary<R>(context: &str, body: impl FnOnce() -> R) -> Option<R> {
    match panic::catch_unwind(AssertUnwindSafe(body)) {
        Ok(value) => Some(value),
        Err(payload) => {
            error_reporter::report_str(&format!(
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

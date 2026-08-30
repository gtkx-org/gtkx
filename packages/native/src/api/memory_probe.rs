use libloading::os::unix::Library;
use napi_derive::napi;

use crate::value::{fundamental_wrapper, wrapper};

/// The number of `GObject` instances currently carrying a JS wrapper with a live toggle
/// reference, plus the number of fundamental instances with a cached wrapper. A test that
/// creates and drops wrappers can assert the count returns to its baseline after a GC drain.
#[napi(catch_unwind)]
#[allow(clippy::cast_possible_truncation)]
#[must_use]
pub fn live_wrapper_count() -> u32 {
    (wrapper::live_count() + fundamental_wrapper::live_count()) as u32
}

/// Runs `LeakSanitizer`'s recoverable leak check when the process has an `AddressSanitizer`
/// runtime loaded, reporting any outstanding leaks to stderr and returning non-zero. Without
/// the runtime it reports nothing and returns zero.
#[napi(catch_unwind)]
#[must_use]
pub fn leak_check() -> i32 {
    let process = Library::this();
    let check =
        unsafe { process.get::<extern "C" fn() -> i32>(b"__lsan_do_recoverable_leak_check\0") };

    match check {
        Ok(run) => run(),
        Err(_) => 0,
    }
}

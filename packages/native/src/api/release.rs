use napi::bindgen_prelude::*;
use napi_derive::napi;

use crate::api::native_result;
use crate::handle::Handle;

/// Ends a handle now instead of when it is collected: an owned boxed value is freed through its
/// free function, a borrowed value's borrow ends, and every later use of the handle or its fields
/// throws. Releasing a handle that has already ended is harmless; a value a native operation still
/// in progress is using, and every other kind of handle, is refused.
#[napi(catch_unwind)]
pub fn release_handle(handle: &External<Handle>) -> Result<()> {
    native_result("releaseHandle", handle.release())
}

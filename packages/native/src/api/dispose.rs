use napi::bindgen_prelude::*;
use napi_derive::napi;

use crate::api::native_result;
use crate::handle::Handle;

/// Immediately releases an owned record through its native destructor and expires its aliases.
/// Releasing an already disposed owned record is harmless; borrowed handles are rejected.
#[napi(catch_unwind)]
pub fn dispose_handle(handle: &External<Handle>) -> Result<()> {
    native_result("record disposal", handle.dispose_struct())
}

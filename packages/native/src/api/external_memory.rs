use napi::bindgen_prelude::*;
use napi_derive::napi;

use crate::handle::Handle;

/// Counts `bytes` of native memory that the handle's instance keeps alive, such as an image
/// surface's pixels, toward the garbage collector's external memory until the handle is released.
#[napi(catch_unwind)]
pub fn report_external_memory(handle: &External<Handle>, bytes: i64) -> Result<()> {
    if bytes < 0 {
        return Err(Error::new(
            Status::InvalidArg,
            format!("reportExternalMemory: bytes must not be negative, got {bytes}"),
        ));
    }

    handle.report_external_memory(bytes)
}

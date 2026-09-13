use std::ffi::c_void;

use napi::bindgen_prelude::*;
use napi_derive::napi;

use crate::api::{byte_count_from_f64, handle_memory_range, native_result};
use crate::ffi::library_cache::FfiCache;
use crate::handle::Handle;

#[allow(clippy::needless_pass_by_value)]
#[napi(catch_unwind)]
pub fn resolve_function(shared_library: String, symbol_name: String) -> Result<External<Handle>> {
    let ptr = native_result(
        "resolve_function",
        FfiCache::with(|state| unsafe {
            state.resolve_symbol::<*mut c_void>(&shared_library, &symbol_name)
        }),
    )?;
    Ok(External::new(Handle::function(ptr, None, false, false)))
}

#[napi(catch_unwind)]
pub fn read_function_pointer(owner: &External<Handle>, offset: f64) -> Result<External<Handle>> {
    let _leases = crate::handle::LeaseScope::open();
    let offset = byte_count_from_f64(offset, "read_function_pointer: offset")?;
    let slot = handle_memory_range(
        owner,
        offset,
        size_of::<*mut c_void>(),
        "read_function_pointer",
    )?;
    let ptr = unsafe { slot.cast::<*mut c_void>().read_unaligned() };
    let handle = Handle::function(ptr, Some((**owner).clone()), false, false);
    native_result("read_function_pointer", handle.function_ptr())?;
    Ok(External::new(handle))
}

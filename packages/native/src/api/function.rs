use std::ffi::c_void;

use napi::bindgen_prelude::*;
use napi_derive::napi;

use crate::api::{byte_count_from_f64, handle_memory_range, native_result};
use crate::ffi::library_cache::LibraryHandle;
use crate::handle::Handle;

/// Opens exactly one library candidate with the process-wide loader flags and lifetime.
#[allow(clippy::needless_pass_by_value)]
#[napi(catch_unwind)]
pub fn open_library(candidate: String) -> Result<External<LibraryHandle>> {
    native_result("open_library", LibraryHandle::open(&candidate)).map(External::new)
}

/// Resolves an executable handle that retains its library. Optional lookup returns null only
/// for absent symbols; malformed names and loader errors remain errors.
#[allow(clippy::needless_pass_by_value)]
#[napi(catch_unwind)]
pub fn resolve_symbol(
    library: &External<LibraryHandle>,
    symbol_name: String,
    optional: bool,
) -> Result<Option<External<Handle>>> {
    let ptr = native_result("resolve_symbol", unsafe {
        library.resolve_symbol::<*mut c_void>(&symbol_name, optional)
    })?;
    Ok(ptr.map(|ptr| External::new(Handle::library_function(ptr, library.owner()))))
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

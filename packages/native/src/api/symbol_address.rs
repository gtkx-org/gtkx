use std::ffi::c_void;

use napi::bindgen_prelude::*;
use napi_derive::napi;

use crate::api::native_result;
use crate::ffi::library_cache::FfiCache;

fn resolve(shared_library: &str, symbol_name: &str) -> anyhow::Result<*mut c_void> {
    FfiCache::with(|state| unsafe {
        state.resolve_symbol::<*mut c_void>(shared_library, symbol_name)
    })
}

/// Resolves `symbolName` in `sharedLibrary` to the address it is exported at. It is how a binding
/// names a C function it never calls itself, for a callee that stores the pointer — the way
/// `g_closure_set_marshal` takes `g_cclosure_marshal_generic`.
///
/// # Errors
///
/// Fails when the library cannot be loaded or does not export the symbol.
#[allow(clippy::needless_pass_by_value)]
#[napi(catch_unwind)]
pub fn symbol_address(shared_library: String, symbol_name: String) -> Result<BigInt> {
    let address = native_result("symbol_address", resolve(&shared_library, &symbol_name))?;

    Ok(BigInt::from(address as u64))
}

use glib::translate::IntoGlib as _;
use napi::bindgen_prelude::*;
use napi_derive::napi;

use crate::api::native_result;
use crate::ffi::library_cache::FfiCache;

fn resolve(shared_library: &str, get_type_fn_name: &str) -> anyhow::Result<u64> {
    let type_ =
        FfiCache::with(|state| state.resolve_type_optional(shared_library, get_type_fn_name))?;
    Ok(type_.into_glib() as u64)
}

/// Calls the `getTypeFnName` registration function in `sharedLibrary` and returns the resulting
/// `GType`, or 0 when the symbol is absent.
#[allow(clippy::needless_pass_by_value)]
#[napi(catch_unwind)]
pub fn resolve_type(shared_library: String, get_type_fn_name: String) -> Result<BigInt> {
    let type_ = native_result("resolve_type", resolve(&shared_library, &get_type_fn_name))?;
    Ok(BigInt::from(type_))
}

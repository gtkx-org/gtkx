use napi::Env;
use napi::bindgen_prelude::*;
use napi_derive::napi;

use crate::handle::Handle;
use crate::value::fundamental_wrapper;

/// Returns the JavaScript wrapper object previously cached for the handle's fundamental
/// instance, or null when no wrapper is cached.
#[napi(catch_unwind)]
pub fn get_fundamental_wrapper<'env>(
    env: &'env Env,
    handle: &External<Handle>,
) -> Result<Option<Object<'env>>> {
    let Some(ptr) = handle.as_fundamental_ptr() else {
        return Ok(None);
    };

    Ok(fundamental_wrapper::lookup(env, ptr))
}

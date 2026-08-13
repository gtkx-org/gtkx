use napi::Env;
use napi::bindgen_prelude::*;
use napi_derive::napi;

use crate::handle::Handle;
use crate::value::wrapper;

/// Returns the JavaScript wrapper object previously attached to the handle's `GObject`,
/// or null when no wrapper is set.
#[napi(catch_unwind)]
pub fn get_wrapper<'env>(
    env: &'env Env,
    handle: &External<Handle>,
) -> Result<Option<Object<'env>>> {
    let Some(gobject_ptr) = handle.as_gobject_ptr() else {
        return Ok(None);
    };

    let Some(wrapper) = (unsafe { wrapper::wrapper_value(env, gobject_ptr) }) else {
        return Ok(None);
    };

    handle.release_owned();

    Ok(Some(wrapper))
}

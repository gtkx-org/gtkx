use napi::bindgen_prelude::*;
use napi::{Env, sys};
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
    let gobject_ptr = handle.as_ptr() as usize;

    let napi_ref = unsafe { wrapper::wrapper_ref(gobject_ptr as *mut _) };

    if !napi_ref.is_null() {
        let mut raw_value: sys::napi_value = std::ptr::null_mut();
        unsafe { sys::napi_get_reference_value(env.raw(), napi_ref, &raw mut raw_value) };
        if !raw_value.is_null() {
            drop(handle.take_owned());
            return Ok(Some(unsafe {
                Object::from_napi_value(env.raw(), raw_value)?
            }));
        }
    }

    Ok(None)
}

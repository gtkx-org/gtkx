use napi::bindgen_prelude::*;
use napi::{Env, sys};
use napi_derive::napi;

use crate::handle::Handle;
use crate::handle::wrapper;
use crate::messaging::Mailbox;

#[napi(catch_unwind)]
pub fn get_wrapper<'env>(
    env: &'env Env,
    handle: &External<Handle>,
) -> napi::Result<Option<Object<'env>>> {
    let gobject_ptr = handle.as_ptr() as usize;

    let napi_ref: usize = Mailbox::global().invoke_glib_and_wait_napi(*env, move || unsafe {
        wrapper::wrapper_ref(gobject_ptr as *mut _) as usize
    })?;

    if napi_ref != 0 {
        let raw_ref = napi_ref as sys::napi_ref;
        let mut raw_value: sys::napi_value = std::ptr::null_mut();
        unsafe { sys::napi_get_reference_value(env.raw(), raw_ref, &mut raw_value) };
        if !raw_value.is_null() {
            if handle.take_pending_gobject_ref() && !Mailbox::global().is_not_running() {
                glib::idle_add_once(move || unsafe {
                    glib::gobject_ffi::g_object_unref(
                        gobject_ptr as *mut glib::gobject_ffi::GObject,
                    );
                });
            }
            return Ok(Some(unsafe {
                Object::from_napi_value(env.raw(), raw_value)?
            }));
        }
    }

    Ok(None)
}

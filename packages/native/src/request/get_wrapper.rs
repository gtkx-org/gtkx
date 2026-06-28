use napi::bindgen_prelude::*;
use napi::{Env, sys};
use napi_derive::napi;

use crate::handle::Handle;
use crate::handle::wrapper_registry;
use crate::messaging::Mailbox;

#[napi(catch_unwind)]
pub fn get_wrapper<'env>(
    env: &'env Env,
    handle: &External<Handle>,
) -> napi::Result<Option<Object<'env>>> {
    let gobject_addr = handle.ptr() as usize;

    let ref_addr: usize = Mailbox::global().dispatch_and_wait_napi(*env, move || unsafe {
        wrapper_registry::WrapperRegistry::global().wrapper_ref(gobject_addr as *mut _) as usize
    })?;

    if ref_addr != 0 {
        let raw_ref = ref_addr as sys::napi_ref;
        let mut raw_value: sys::napi_value = std::ptr::null_mut();
        unsafe { sys::napi_get_reference_value(env.raw(), raw_ref, &mut raw_value) };
        if !raw_value.is_null() {
            if handle.take_pending_gobject_ref() {
                Mailbox::global().dispatch_and_wait_napi(*env, move || unsafe {
                    glib::gobject_ffi::g_object_unref(
                        gobject_addr as *mut glib::gobject_ffi::GObject,
                    );
                })?;
            }
            return Ok(Some(unsafe {
                Object::from_napi_value(env.raw(), raw_value)?
            }));
        }
    }

    Ok(None)
}

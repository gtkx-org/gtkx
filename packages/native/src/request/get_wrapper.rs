#![cfg_attr(coverage_nightly, coverage(off))]

use napi::bindgen_prelude::*;
use napi::{Env, sys};
use napi_derive::napi;

use crate::handle::Handle;
use crate::handle::wrapper_registry;
use crate::messaging::Mailbox;

#[napi(catch_unwind)]
#[cfg_attr(test, allow(dead_code))]
pub fn get_wrapper<'env>(env: &'env Env, handle: &External<Handle>) -> napi::Result<Unknown<'env>> {
    let gobject_addr = handle.ptr() as usize;

    // SAFETY: the closure runs on the gtkx-glib thread; `gobject_addr` is the handle's GObject
    // pointer (or 0), which `wrapper_ref` accepts as null or a live GObject.
    let ref_addr: usize = Mailbox::global().dispatch_and_wait_napi(*env, move || unsafe {
        wrapper_registry::WrapperRegistry::global().wrapper_ref(gobject_addr as *mut _) as usize
    })?;

    if ref_addr != 0 {
        let raw_ref = ref_addr as sys::napi_ref;
        let mut raw_value: sys::napi_value = std::ptr::null_mut();
        // SAFETY: runs on the JS thread with the live `env`; `raw_ref` is the napi reference
        // recorded in the wrapper binding, and `raw_value` is an out-param node-api fills.
        unsafe { sys::napi_get_reference_value(env.raw(), raw_ref, &mut raw_value) };
        if !raw_value.is_null() {
            if handle.take_pending_gobject_ref() {
                // SAFETY: the closure runs on the gtkx-glib thread; the handle carried a pending
                // strong reference on the live `gobject_addr`, which this releases exactly once.
                Mailbox::global().dispatch_and_wait_napi(*env, move || unsafe {
                    glib::gobject_ffi::g_object_unref(
                        gobject_addr as *mut glib::gobject_ffi::GObject,
                    );
                })?;
            }
            // SAFETY: `raw_value` is the non-null napi value just resolved from `raw_ref` for the
            // live `env`, so reconstructing an `Unknown` from the pair is sound.
            return Ok(unsafe { Unknown::from_raw_unchecked(env.raw(), raw_value) });
        }
    }

    let mut undefined: sys::napi_value = std::ptr::null_mut();
    // SAFETY: runs on the JS thread with the live `env`; `undefined` is an out-param node-api fills
    // with the undefined value.
    unsafe { sys::napi_get_undefined(env.raw(), &mut undefined) };
    // SAFETY: `undefined` is the valid napi value just produced for the live `env`.
    Ok(unsafe { Unknown::from_raw_unchecked(env.raw(), undefined) })
}

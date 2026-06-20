#![cfg_attr(coverage_nightly, coverage(off))]

use std::ffi::c_void;
use std::sync::Arc;

use napi::bindgen_prelude::*;
use napi::{Env, JsObject, NapiRaw, sys};
use napi_derive::napi;

use crate::dispatch::Mailbox;
use crate::managed::NativeHandle;
use crate::toggle_ref;

struct FinalizeData {
    gobject_addr: usize,
    ref_addr: usize,
    binding: Option<Arc<toggle_ref::WrapperBinding>>,
    generation: u64,
}

unsafe extern "C" fn on_wrapper_finalize(
    _env: sys::napi_env,
    finalize_data: *mut c_void,
    _finalize_hint: *mut c_void,
) {
    let mut data = unsafe { Box::from_raw(finalize_data.cast::<FinalizeData>()) };
    toggle_ref::WrapperRegistry::global().schedule_cleanup(
        data.binding.take(),
        data.generation,
        data.gobject_addr,
        data.ref_addr,
    );
}

#[napi(catch_unwind)]
#[cfg_attr(test, allow(dead_code))]
pub fn set_wrapper(
    env: Env,
    handle: &External<NativeHandle>,
    wrapper: JsObject,
) -> napi::Result<()> {
    let gobject_addr = handle.ptr() as usize;
    if gobject_addr == 0 {
        return Err(napi::Error::new(
            napi::Status::InvalidArg,
            "set_wrapper: handle has a null pointer",
        ));
    }

    let data = Box::into_raw(Box::new(FinalizeData {
        gobject_addr,
        ref_addr: 0,
        binding: None,
        generation: 0,
    }));

    let mut raw_ref: sys::napi_ref = std::ptr::null_mut();
    let status = unsafe {
        sys::napi_add_finalizer(
            env.raw(),
            wrapper.raw(),
            data.cast::<c_void>(),
            Some(on_wrapper_finalize),
            std::ptr::null_mut(),
            &mut raw_ref,
        )
    };
    if status != sys::Status::napi_ok {
        drop(unsafe { Box::from_raw(data) });
        return Err(napi::Error::new(
            napi::Status::GenericFailure,
            "failed to add wrapper finalizer",
        ));
    }
    unsafe { (*data).ref_addr = raw_ref as usize };

    let ref_addr = raw_ref as usize;
    toggle_ref::RefOp::Strengthen.apply(&env, ref_addr);
    let consume_pending = handle.take_pending_gobject_ref();
    let (binding, generation) = Mailbox::global().dispatch_and_wait_napi(env, move || unsafe {
        toggle_ref::WrapperRegistry::global().install(
            gobject_addr as *mut _,
            ref_addr as *mut c_void,
            consume_pending,
        )
    })?;
    unsafe {
        (*data).binding = Some(binding);
        (*data).generation = generation;
    }

    Ok(())
}

#[napi(catch_unwind)]
#[cfg_attr(test, allow(dead_code))]
pub fn get_wrapper<'env>(
    env: &'env Env,
    handle: &External<NativeHandle>,
) -> napi::Result<Unknown<'env>> {
    let gobject_addr = handle.ptr() as usize;

    let ref_addr: usize = Mailbox::global().dispatch_and_wait_napi(*env, move || unsafe {
        toggle_ref::WrapperRegistry::global().wrapper_ref(gobject_addr as *mut _) as usize
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
            return Ok(unsafe { Unknown::from_raw_unchecked(env.raw(), raw_value) });
        }
    }

    let mut undefined: sys::napi_value = std::ptr::null_mut();
    unsafe { sys::napi_get_undefined(env.raw(), &mut undefined) };
    Ok(unsafe { Unknown::from_raw_unchecked(env.raw(), undefined) })
}

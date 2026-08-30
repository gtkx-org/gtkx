use std::ffi::c_void;
use std::rc::Rc;

use glib::translate::from_glib_none;
use napi::bindgen_prelude::*;
use napi::{Env, sys};
use napi_derive::napi;

use crate::handle::Handle;
use crate::value::wrapper;

struct FinalizeData {
    gobject_ptr: *mut glib::gobject_ffi::GObject,
    napi_ref: sys::napi_ref,
    wrapper_handle: Option<Rc<wrapper::WrapperHandle>>,
    generation: u64,
}

unsafe extern "C" fn on_wrapper_finalize(
    _env: sys::napi_env,
    finalize_data: *mut c_void,
    _finalize_hint: *mut c_void,
) {
    let mut data = unsafe { Box::from_raw(finalize_data.cast::<FinalizeData>()) };
    unsafe {
        wrapper::schedule_cleanup(
            data.wrapper_handle.take(),
            data.generation,
            data.gobject_ptr,
            data.napi_ref,
        );
    }
}

/// Attaches the JavaScript `wrapper` object to the handle's `GObject` and registers a finalizer
/// that releases it when the wrapper is garbage collected.
#[napi(catch_unwind)]
pub fn set_wrapper(env: Env, handle: &External<Handle>, wrapper: Object<'_>) -> Result<()> {
    let Some(gobject_ptr) = handle.as_gobject_ptr() else {
        return Err(Error::new(
            Status::InvalidArg,
            "set_wrapper: the handle does not reference a GObject",
        ));
    };

    let data = Box::into_raw(Box::new(FinalizeData {
        gobject_ptr,
        napi_ref: std::ptr::null_mut(),
        wrapper_handle: None,
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
            &raw mut raw_ref,
        )
    };
    if status != sys::Status::napi_ok {
        drop(unsafe { Box::from_raw(data) });
        return Err(Error::new(
            Status::GenericFailure,
            "failed to add wrapper finalizer",
        ));
    }
    unsafe { (*data).napi_ref = raw_ref };

    let mut ref_count: u32 = 0;
    unsafe { sys::napi_reference_ref(env.raw(), raw_ref, &raw mut ref_count) };
    let pinned: glib::Object = unsafe { from_glib_none(gobject_ptr) };
    let owned = handle.take_owned();
    let (wrapper_handle, generation) = unsafe { wrapper::install(gobject_ptr, raw_ref) };
    drop(owned);
    unsafe {
        (*data).wrapper_handle = Some(wrapper_handle);
        (*data).generation = generation;
    }
    drop(pinned);

    Ok(())
}

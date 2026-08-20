use std::cell::RefCell;
use std::collections::HashMap;
use std::ffi::c_void;

use napi::bindgen_prelude::*;
use napi::{Env, sys};

thread_local! {
    static WRAPPERS: RefCell<HashMap<usize, sys::napi_ref>> = RefCell::new(HashMap::new());
}

struct FinalizeData {
    ptr: usize,
    napi_ref: sys::napi_ref,
}

unsafe extern "C" fn on_wrapper_finalize(
    env: sys::napi_env,
    finalize_data: *mut c_void,
    _finalize_hint: *mut c_void,
) {
    let data = unsafe { Box::from_raw(finalize_data.cast::<FinalizeData>()) };
    WRAPPERS.with_borrow_mut(|wrappers| {
        if wrappers.get(&data.ptr) == Some(&data.napi_ref) {
            wrappers.remove(&data.ptr);
        }
    });
    unsafe { sys::napi_delete_reference(env, data.napi_ref) };
}

/// Returns the wrapper cached for a fundamental instance, or `None` when no wrapper was cached
/// for the pointer or the cached one has been collected. The returned object borrows the
/// environment and stays valid only for the current native call.
pub fn lookup(env: &Env, ptr: *mut c_void) -> Option<Object<'_>> {
    let napi_ref = WRAPPERS.with_borrow(|wrappers| wrappers.get(&(ptr as usize)).copied())?;
    let mut raw_value: sys::napi_value = std::ptr::null_mut();
    unsafe { sys::napi_get_reference_value(env.raw(), napi_ref, &raw mut raw_value) };

    if raw_value.is_null() {
        return None;
    }

    unsafe { Object::from_napi_value(env.raw(), raw_value) }.ok()
}

/// Caches `wrapper` as the one object representing the fundamental instance at `ptr`. The cache
/// holds the wrapper weakly: a finalizer drops the entry once the wrapper is collected, so the
/// cache never keeps a wrapper alive itself. The caller must guarantee the instance outlives the
/// wrapper, which the wrapper's own handle does by holding a reference to the instance.
pub fn install(env: &Env, ptr: *mut c_void, wrapper: &Object<'_>) -> Result<()> {
    let data = Box::into_raw(Box::new(FinalizeData {
        ptr: ptr as usize,
        napi_ref: std::ptr::null_mut(),
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
            "failed to add fundamental wrapper finalizer",
        ));
    }
    unsafe { (*data).napi_ref = raw_ref };

    WRAPPERS.with_borrow_mut(|wrappers| {
        wrappers.insert(ptr as usize, raw_ref);
    });

    Ok(())
}

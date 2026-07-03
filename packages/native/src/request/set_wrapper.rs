use std::ffi::c_void;
use std::sync::Arc;

use napi::bindgen_prelude::*;
use napi::{Env, sys};
use napi_derive::napi;

use crate::handle::Handle;
use crate::handle::wrapper;
use crate::messaging::{Mailbox, WrapperRefOp};

struct FinalizeData {
    gobject_ptr: usize,
    napi_ref: usize,
    binding: Option<Arc<wrapper::WrapperBinding>>,
    generation: u64,
}

unsafe extern "C" fn on_wrapper_finalize(
    _env: sys::napi_env,
    finalize_data: *mut c_void,
    _finalize_hint: *mut c_void,
) {
    let mut data = unsafe { Box::from_raw(finalize_data.cast::<FinalizeData>()) };
    wrapper::schedule_cleanup(
        data.binding.take(),
        data.generation,
        data.gobject_ptr,
        data.napi_ref,
    );
}

#[napi(catch_unwind)]
pub fn set_wrapper(env: Env, handle: &External<Handle>, wrapper: Object<'_>) -> napi::Result<()> {
    let gobject_ptr = handle.as_ptr() as usize;

    let data = Box::into_raw(Box::new(FinalizeData {
        gobject_ptr,
        napi_ref: 0,
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
    unsafe { (*data).napi_ref = raw_ref as usize };

    let napi_ref = raw_ref as usize;
    WrapperRefOp::Ref.apply(&env, napi_ref);
    let consume_pending = handle.take_pending_gobject_ref();
    let (binding, generation) =
        Mailbox::global().invoke_glib_and_wait_napi(env, move || unsafe {
            wrapper::install(
                gobject_ptr as *mut _,
                napi_ref as *mut c_void,
                consume_pending,
            )
        })?;
    unsafe {
        (*data).binding = Some(binding);
        (*data).generation = generation;
    }

    Ok(())
}

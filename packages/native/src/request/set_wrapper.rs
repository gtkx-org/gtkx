#![cfg_attr(coverage_nightly, coverage(off))]

use std::ffi::c_void;
use std::sync::Arc;

use napi::bindgen_prelude::*;
use napi::{Env, JsObject, NapiRaw, sys};
use napi_derive::napi;

use crate::handle::NativeHandle;
use crate::handle::wrapper_registry;
use crate::messaging::Mailbox;

struct FinalizeData {
    gobject_addr: usize,
    ref_addr: usize,
    binding: Option<Arc<wrapper_registry::WrapperBinding>>,
    generation: u64,
}

/// napi finalizer invoked when the JS wrapper object is garbage collected.
///
/// # Safety
///
/// Called by node-api on the JS thread. `finalize_data` is the `Box<FinalizeData>` raw pointer
/// installed by `set_wrapper` via `napi_add_finalizer`; node-api invokes this finalizer at most
/// once, so reclaiming the box here frees it exactly once.
unsafe extern "C" fn on_wrapper_finalize(
    env: sys::napi_env,
    finalize_data: *mut c_void,
    _finalize_hint: *mut c_void,
) {
    // SAFETY: `finalize_data` is the non-null `Box<FinalizeData>` raw pointer that `set_wrapper`
    // passed to `napi_add_finalizer`; this finalizer fires once, so reclaiming ownership of the
    // box and dropping it after scheduling cleanup is sound.
    let mut data = unsafe { Box::from_raw(finalize_data.cast::<FinalizeData>()) };
    wrapper_registry::WrapperRegistry::global().schedule_cleanup(
        env as usize,
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
    // SAFETY: runs on the JS thread with the live `env` and `wrapper` object; `data` is a freshly
    // leaked `Box<FinalizeData>` whose ownership is transferred to node-api, which hands it back to
    // `on_wrapper_finalize`. `raw_ref` is an out-param node-api fills with the reference handle.
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
        // SAFETY: the finalizer was not installed (the call failed), so `data` is still owned here;
        // reclaiming and dropping the box frees it exactly once.
        drop(unsafe { Box::from_raw(data) });
        return Err(napi::Error::new(
            napi::Status::GenericFailure,
            "failed to add wrapper finalizer",
        ));
    }
    // SAFETY: `data` still points to the live `FinalizeData` (node-api now also references it, but
    // it is not dropped until the finalizer runs); recording the reference handle is a plain write.
    unsafe { (*data).ref_addr = raw_ref as usize };

    let ref_addr = raw_ref as usize;
    wrapper_registry::WrapperRefOp::Ref.apply(&env, ref_addr);
    let consume_pending = handle.take_pending_gobject_ref();
    // SAFETY: the closure runs on the gtkx-glib thread (dispatched via the mailbox); `gobject_addr`
    // is the non-null GObject pointer validated above and `ref_addr` is the live napi reference, so
    // `WrapperRegistry::install`'s contract is met.
    let (binding, generation) = Mailbox::global().dispatch_and_wait_napi(env, move || unsafe {
        wrapper_registry::WrapperRegistry::global().install(
            gobject_addr as *mut _,
            ref_addr as *mut c_void,
            consume_pending,
        )
    })?;
    // SAFETY: `data` still points to the live `FinalizeData` owned by the pending finalizer;
    // storing the binding and generation are plain writes through that valid pointer.
    unsafe {
        (*data).binding = Some(binding);
        (*data).generation = generation;
    }

    Ok(())
}

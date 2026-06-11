//! napi exports for `GObject` toggle-reference wrapper tracking.
//!
//! [`set_object_toggle_notify`] installs the JS callback that flips a wrapper
//! reference strong/weak (or deletes it) by opcode. [`set_wrapper`] binds a
//! freshly created JavaScript wrapper to its `GObject`: it creates a `napi_ref`
//! plus a finalizer on the wrapper, then installs the toggle ref on the `GLib`
//! thread. [`get_wrapper`] resolves the existing wrapper for an object the
//! registry already tracks. [`apply_wrapper_ref_op`] performs the actual
//! `napi_reference_*` call the toggle callback requests.
//!
//! Each export either creates napi references or dispatches `GObject` work to
//! the `GLib` thread, so the module is excluded from coverage instrumentation.

#![cfg_attr(coverage_nightly, coverage(off))]

use std::ffi::c_void;
use std::sync::Arc;

use gtk4::glib;
use napi::bindgen_prelude::*;
use napi::{Env, JsFunction, JsObject, NapiRaw, NapiValue, sys};
use napi_derive::napi;

use crate::dispatch::Mailbox;
use crate::managed::NativeHandle;
use crate::toggle_ref;
use crate::value::JsRef;

/// Finalizer payload carried by a wrapper's napi reference: the addresses of
/// the `GObject` and the `napi_ref`, the finalizer's `Arc` clone of the
/// object's `WrapperBinding` cell, and the binding generation in effect when
/// this wrapper was bound. [`set_wrapper`] fills `binding` and `generation`
/// from the value [`toggle_ref::install`] returns, so a finalizer that runs
/// before that write (only on a shutdown dispatch failure) carries no binding
/// and merely deletes its reference.
struct FinalizeData {
    gobject_addr: usize,
    ref_addr: usize,
    binding: Option<Arc<toggle_ref::WrapperBinding>>,
    generation: u64,
}

/// Runs when a tracked wrapper is garbage collected (JS thread). Hands the
/// binding cell, generation, and object and reference addresses to
/// [`toggle_ref::schedule_cleanup`], which resolves the binding and tears it down
/// on the `GLib` thread.
unsafe extern "C" fn on_wrapper_finalize(
    _env: sys::napi_env,
    finalize_data: *mut c_void,
    _finalize_hint: *mut c_void,
) {
    // SAFETY: `finalize_data` is the unique `Box::into_raw` pointer
    // `set_wrapper` attached to this finalizer, which napi invokes exactly
    // once.
    let mut data = unsafe { Box::from_raw(finalize_data.cast::<FinalizeData>()) };
    toggle_ref::schedule_cleanup(
        data.binding.take(),
        data.generation,
        data.gobject_addr,
        data.ref_addr,
    );
}

/// Installs the JavaScript reference-operation callback invoked, on the JS
/// thread, with `(refPtr, opcode)` whenever the binding must flip a wrapper
/// reference strong/weak or delete it. A non-function `callback` is rejected
/// with `InvalidArg`.
#[napi(catch_unwind)]
#[cfg_attr(test, allow(dead_code))]
pub fn set_object_toggle_notify(env: Env, callback: Unknown<'_>) -> napi::Result<()> {
    if !matches!(callback.get_type()?, napi::ValueType::Function) {
        return Err(napi::Error::new(
            napi::Status::InvalidArg,
            "set_object_toggle_notify: callback must be a function",
        ));
    }
    // SAFETY: `callback` is a live JS value from the current callback's
    // `env`, verified to be a function just above.
    let func: JsFunction = unsafe { JsFunction::from_raw_unchecked(env.raw(), callback.raw()) };
    let func_ref = JsRef::from_js_value(&env, &func)?;
    toggle_ref::initialize(Arc::new(func_ref));
    Ok(())
}

/// Applies one `napi_reference_*` operation to `ref_ptr` by opcode. Only the
/// three known opcodes act; any other value is a no-op rather than a silent
/// deletion, so a stray call cannot destroy a wrapper reference. A stale or
/// already-deleted reference yields a benign failure status that is ignored, so
/// teardown ordering never crashes.
#[napi(catch_unwind)]
#[allow(clippy::unnecessary_wraps)]
#[cfg_attr(test, allow(dead_code))]
pub fn apply_wrapper_ref_op(env: Env, ref_ptr: f64, op: u32) -> napi::Result<()> {
    let raw_ref = ref_ptr as usize as sys::napi_ref;
    let mut count: u32 = 0;
    // SAFETY: This runs on the JS thread owning `env`; a stale or deleted
    // reference makes the napi call return a failure status, which is
    // ignored by design.
    unsafe {
        match toggle_ref::RefOp::from_opcode(op) {
            Some(toggle_ref::RefOp::Strengthen) => {
                sys::napi_reference_ref(env.raw(), raw_ref, &mut count);
            }
            Some(toggle_ref::RefOp::Weaken) => {
                sys::napi_reference_unref(env.raw(), raw_ref, &mut count);
            }
            Some(toggle_ref::RefOp::Delete) => {
                sys::napi_delete_reference(env.raw(), raw_ref);
            }
            None => {}
        }
    }
    Ok(())
}

/// Binds `wrapper` to the `GObject` behind `handle`, installing the toggle ref.
///
/// Creates a `napi_ref` plus a finalizer on `wrapper`, normalizes the reference
/// to strong, then installs the toggle ref on the `GLib` thread — consuming the
/// pending owned reference the decode path left on the object when `handle`
/// still carries it. For a freshly created object with no other holder, the
/// install's final unref fires the toggle notify synchronously, weakening the
/// reference before this returns. A null `handle` pointer is rejected with
/// `InvalidArg`.
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
    // SAFETY: `wrapper` is a live object under the current callback's
    // `env`, and `data` stays valid until the finalizer consumes it.
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
        // SAFETY: The finalizer was never installed, so the unique
        // `Box::into_raw` pointer is still unconsumed.
        drop(unsafe { Box::from_raw(data) });
        return Err(napi::Error::new(
            napi::Status::GenericFailure,
            "failed to add wrapper finalizer",
        ));
    }
    // SAFETY: `data` stays a valid unique allocation until the finalizer
    // consumes it, and the finalizer cannot run during this callback.
    unsafe { (*data).ref_addr = raw_ref as usize };

    let mut count: u32 = 0;
    // SAFETY: `raw_ref` is the live reference napi_add_finalizer just
    // created under the current callback's `env`.
    unsafe {
        sys::napi_reference_ref(env.raw(), raw_ref, &mut count);
        while count > 1 {
            sys::napi_reference_unref(env.raw(), raw_ref, &mut count);
        }
    }

    let ref_addr = raw_ref as usize;
    let consume_pending = handle.take_pending_gobject_ref();
    let (binding, generation) = Mailbox::global()
        // SAFETY: This closure runs on the GLib thread; the handle's
        // pending reference (or the wrapper itself) keeps the GObject
        // alive across the dispatch.
        .dispatch_to_glib_and_wait(env, move || unsafe {
            toggle_ref::install(
                gobject_addr as *mut _,
                ref_addr as *mut c_void,
                consume_pending,
            )
        })
        .map_err(|e| napi::Error::new(napi::Status::GenericFailure, e.to_string()))?;
    // SAFETY: `data` stays a valid unique allocation until the finalizer
    // consumes it, and the finalizer cannot run during this callback.
    unsafe {
        (*data).binding = Some(binding);
        (*data).generation = generation;
    }

    Ok(())
}

/// Resolves the existing JavaScript wrapper for the `GObject` behind `handle`,
/// or `undefined` when the object is untracked or its wrapper has already been
/// collected. Reads the wrapper reference from qdata on the `GLib` thread, then
/// resolves it to its JS value on the JS thread.
///
/// A live wrapper resolution consumes the pending decode reference `handle`
/// carries: the wrapper install is the pending reference's other consumer, and
/// a handle that resolves to an existing wrapper will never reach it.
///
/// A null or non-`GObject` `handle` resolves to `undefined`: unlike
/// [`set_wrapper`], this lookup needs no null guard because
/// [`toggle_ref::wrapper_ref`] checks both conditions before touching qdata.
#[napi(catch_unwind)]
#[cfg_attr(test, allow(dead_code))]
pub fn get_wrapper<'env>(
    env: &'env Env,
    handle: &External<NativeHandle>,
) -> napi::Result<Unknown<'env>> {
    let gobject_addr = handle.ptr() as usize;

    let ref_addr: usize = Mailbox::global()
        // SAFETY: This closure runs on the GLib thread, and wrapper_ref
        // null-checks the address before touching qdata.
        .dispatch_to_glib_and_wait(*env, move || unsafe {
            toggle_ref::wrapper_ref(gobject_addr as *mut _) as usize
        })
        .map_err(|e| napi::Error::new(napi::Status::GenericFailure, e.to_string()))?;

    if ref_addr != 0 {
        let raw_ref = ref_addr as sys::napi_ref;
        let mut raw_value: sys::napi_value = std::ptr::null_mut();
        // SAFETY: The binding holds the wrapper's live napi_ref, and this
        // runs on the JS thread owning `env`.
        unsafe { sys::napi_get_reference_value(env.raw(), raw_ref, &mut raw_value) };
        if !raw_value.is_null() {
            if handle.take_pending_gobject_ref() {
                Mailbox::global()
                    // SAFETY: The swapped flag held the one pending decode
                    // reference, released exactly once on the GLib thread;
                    // the live wrapper keeps the object alive afterward.
                    .dispatch_to_glib_and_wait(*env, move || unsafe {
                        glib::gobject_ffi::g_object_unref(
                            gobject_addr as *mut glib::gobject_ffi::GObject,
                        );
                    })
                    .map_err(|e| napi::Error::new(napi::Status::GenericFailure, e.to_string()))?;
            }
            // SAFETY: `raw_value` is the live wrapper value just resolved
            // under the current callback's `env`.
            return Ok(unsafe { Unknown::from_raw_unchecked(env.raw(), raw_value) });
        }
    }

    let mut undefined: sys::napi_value = std::ptr::null_mut();
    // SAFETY: This runs on the JS thread with the live `env` of the
    // current callback.
    unsafe { sys::napi_get_undefined(env.raw(), &mut undefined) };
    // SAFETY: `undefined` was just produced under the current callback's
    // `env`.
    Ok(unsafe { Unknown::from_raw_unchecked(env.raw(), undefined) })
}

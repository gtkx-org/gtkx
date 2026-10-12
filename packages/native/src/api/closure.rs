use std::ffi::c_void;

use glib::gobject_ffi;
use glib::prelude::StaticType as _;
use napi::Env;
use napi::bindgen_prelude::*;
use napi_derive::napi;

use crate::api::native_result;
use crate::ffi::Stash;
use crate::ffi::closure::ClosureState;
use crate::ffi::codec::{CallbackScope, Codec, DestroyNotifyKind, Encoder as _};
use crate::ffi::descriptor::Descriptor;
use crate::handle::{Boxed, Handle};
use crate::host::callback_error::CallbackErrorScope;

type MarshalFn = unsafe extern "C" fn(
    *mut gobject_ffi::GClosure,
    *mut gobject_ffi::GValue,
    u32,
    *const gobject_ffi::GValue,
    *mut c_void,
    *mut c_void,
);

unsafe extern "C" fn release_callback(data: *mut c_void, _closure: *mut gobject_ffi::GClosure) {
    unsafe { ClosureState::destroy(data) };
}

/// Creates a non-floating `GClosure` whose finalizer owns the callback and marshal trampoline.
/// A generic marshal invokes the supplied typed callback; otherwise the callback is the marshal.
#[napi(catch_unwind)]
pub fn create_closure(
    env: Env,
    callback_descriptor: Descriptor,
    callback: Unknown<'_>,
    generic_marshal: bool,
) -> Result<External<Handle>> {
    let _errors = CallbackErrorScope::open(env);
    let _leases = crate::handle::LeaseScope::open();
    let Codec::Callback(codec) = callback_descriptor.into_codec()? else {
        return Err(Error::from_reason(
            "A GClosure requires a callback descriptor",
        ));
    };
    if codec.scope != CallbackScope::Notified
        || !codec.has_user_data
        || !codec.has_destroy
        || codec.destroy_kind != DestroyNotifyKind::ClosureNotify
    {
        return Err(Error::from_reason(
            "A GClosure callback requires notified scope, user data and a closure notifier",
        ));
    }
    let Stash::Callback(encoded) = native_result("create_closure", codec.encode(&env, callback))?
    else {
        return Err(Error::from_reason(
            "A GClosure requires an encoded callback",
        ));
    };
    let data = encoded
        .closure_data()
        .ok_or_else(|| Error::from_reason("A GClosure requires a non-null callback"))?;
    let function = encoded.function_pointer();
    let callback_fn =
        unsafe { std::mem::transmute::<*mut c_void, unsafe extern "C" fn()>(function) };
    let closure = unsafe {
        gobject_ffi::g_cclosure_new(
            Some(callback_fn),
            data.state_ptr.get().cast(),
            Some(release_callback),
        )
    };
    if closure.is_null() {
        return Err(Error::from_reason("Could not allocate a GClosure"));
    }
    encoded.disarm_pending_transfer();
    let handle = Handle::from(Boxed::from_glib_full(
        glib::Closure::static_type(),
        closure.cast(),
    ));
    let marshal: MarshalFn = if generic_marshal {
        gobject_ffi::g_cclosure_marshal_generic
    } else {
        unsafe { std::mem::transmute::<*mut c_void, MarshalFn>(function) }
    };
    unsafe {
        gobject_ffi::g_closure_ref(closure);
        gobject_ffi::g_closure_sink(closure);
        gobject_ffi::g_closure_set_marshal(closure, Some(marshal));
    }
    let size_hint = handle.size_hint();
    Ok(External::new_with_size_hint(handle, size_hint))
}

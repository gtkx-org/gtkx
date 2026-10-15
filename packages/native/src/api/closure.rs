use std::ffi::c_void;

use glib::gobject_ffi;
use glib::prelude::StaticType as _;
use napi::Env;
use napi::bindgen_prelude::*;
use napi_derive::napi;

use crate::api::bind::FunctionSignature;
use crate::api::native_result;
use crate::ffi::Stash;
use crate::ffi::closure::ClosureState;
use crate::ffi::codec::{
    CallbackCodec, CallbackReleasePolicy, CallbackScope, Codec, DestroyNotifyKind, Encoder as _,
};
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

/// The generic C marshal takes a borrowed callback result into its `GValue`. During emitv,
/// retain each result before an accumulator or a later handler can reset that `GValue`. Native
/// emissions use a different argument array and retain their existing C return convention.
unsafe extern "C" fn marshal_borrowed_object(
    closure: *mut gobject_ffi::GClosure,
    return_value: *mut gobject_ffi::GValue,
    n_param_values: u32,
    param_values: *const gobject_ffi::GValue,
    invocation_hint: *mut c_void,
    marshal_data: *mut c_void,
) {
    unsafe {
        gobject_ffi::g_cclosure_marshal_generic(
            closure,
            return_value,
            n_param_values,
            param_values,
            invocation_hint,
            marshal_data,
        );
        if !return_value.is_null() && super::signal::is_synthetic_emission(param_values) {
            let object = gobject_ffi::g_value_get_object(return_value);
            if !object.is_null() {
                gobject_ffi::g_object_ref(object);
            }
        }
    }
}

#[napi(
    discriminant = "kind",
    discriminant_case = "camelCase",
    object_to_js = false
)]
#[derive(Clone, Copy)]
pub enum FunctionOptions {
    Pointer,
    Closure { generic_marshal: bool },
}

/// Creates an owned callback pointer or a non-floating `GClosure` from a compiled signature.
/// For closures, a generic marshal calls the typed callback; otherwise the callback is the marshal.
#[napi(catch_unwind, ts_return_type = "ExternalObject<Handle>")]
pub fn create_function<'e>(
    env: &'e Env,
    signature: &External<FunctionSignature>,
    callback: Unknown<'e>,
    options: FunctionOptions,
) -> Result<Unknown<'e>> {
    let _errors = CallbackErrorScope::open(*env);
    let _leases = crate::handle::LeaseScope::open();
    signature.ensure_callback()?;
    let is_closure = matches!(options, FunctionOptions::Closure { .. });
    let codec = CallbackCodec {
        signature: (**signature).clone(),
        scope: if is_closure {
            CallbackScope::Notified
        } else {
            CallbackScope::Call
        },
        has_user_data: is_closure,
        has_destroy: is_closure,
        destroy_kind: if is_closure {
            DestroyNotifyKind::ClosureNotify
        } else {
            DestroyNotifyKind::DestroyNotify
        },
        release_policy: CallbackReleasePolicy::Scope,
    };
    match options {
        FunctionOptions::Pointer => {
            super::value_pointer::create_callback(env, &Codec::Callback(codec), callback)
        }
        FunctionOptions::Closure { generic_marshal } => {
            let handle = create_closure(env, &codec, callback, generic_marshal)?;
            crate::value::handle_to_unknown(env, handle)
        }
    }
}

fn create_closure(
    env: &Env,
    codec: &CallbackCodec,
    callback: Unknown<'_>,
    generic_marshal: bool,
) -> Result<Handle> {
    let Stash::Callback(encoded) = native_result("create_function", codec.encode(env, callback))?
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
        if matches!(&codec.return_codec, Codec::Object(object) if object.ownership.is_borrowed()) {
            marshal_borrowed_object
        } else {
            gobject_ffi::g_cclosure_marshal_generic
        }
    } else {
        unsafe { std::mem::transmute::<*mut c_void, MarshalFn>(function) }
    };
    unsafe {
        gobject_ffi::g_closure_ref(closure);
        gobject_ffi::g_closure_sink(closure);
        gobject_ffi::g_closure_set_marshal(closure, Some(marshal));
    }
    Ok(handle)
}

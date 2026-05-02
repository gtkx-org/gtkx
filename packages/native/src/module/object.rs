//! Object pointer retrieval.
//!
//! The [`get_native_id`] function returns the raw pointer value for a managed
//! object. This is primarily used for object-identity comparisons in JavaScript.
//! With pointer-bearing handles, the read is purely synchronous and never
//! crosses the `GLib` thread boundary.

use napi::bindgen_prelude::*;
use napi::{Env, ValueType};
use napi_derive::napi;

use crate::managed::NativeHandle;

#[napi]
pub fn get_native_id(handle: &External<NativeHandle>) -> f64 {
    handle.ptr_as_usize() as f64
}

#[napi]
pub fn is_native_handle(env: &Env, value: Unknown<'_>) -> napi::Result<bool> {
    if value.get_type()? != ValueType::External {
        return Ok(false);
    }

    let Ok(handle) =
        (unsafe { <&External<NativeHandle>>::from_napi_value(env.raw(), value.raw()) })
    else {
        return Ok(false);
    };

    Ok(handle.is_ours())
}

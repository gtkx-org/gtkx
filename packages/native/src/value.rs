//! JavaScript value representation for the native module.
//!
//! This module defines [`Value`], the intermediate representation for values
//! crossing between JavaScript and native code. Values are converted to/from
//! JavaScript types via napi-rs and to/from FFI-compatible representations
//! via the [`ffi`] module.
//!
//! The [`Value`] enum supports all types that can be passed through the FFI:
//! - Primitives: numbers, strings, booleans
//! - Objects: `GObjects`, boxed types, structs
//! - Callbacks: JavaScript functions invocable from native code
//! - Arrays and references
//!
//! [`JsRef`], [`Callback`], [`Ref`], and the [`napi::Env`]-bound conversions
//! ([`Value::from_js_value`], [`Value::to_js_value`], [`map_js_array`]) wrap
//! live JavaScript references, so they are excluded from coverage
//! instrumentation — a `cargo test` process has no JavaScript runtime to
//! exercise them against.

use std::ffi::c_void;
use std::marker::PhantomData;
use std::sync::Arc;

use napi::bindgen_prelude::*;
use napi::sys;
use napi::{Env, JsFunction, JsObject, NapiRaw, NapiValue, ValueType};

use crate::managed::NativeHandle;
use crate::types::{FfiDecoder, Type};
use crate::{arg::Arg, ffi};

/// Send-safe napi reference to a JavaScript value of type `T`.
///
/// Wraps a raw `napi_ref` paired with its `napi_env`. Sending the ref across
/// threads is safe because the contained pointer is opaque; only the JS thread
/// dereferences it via [`get_value`](Self::get_value). The reference is
/// released on `Drop`.
///
/// `T` is the napi JS value kind the reference resolves to (e.g. [`JsFunction`]
/// for callbacks, [`JsObject`] for `Ref` write-backs); it is tracked purely at
/// the type level via [`PhantomData`].
pub struct JsRef<T> {
    raw: sys::napi_ref,
    env: sys::napi_env,
    _marker: PhantomData<T>,
}

unsafe impl<T> Send for JsRef<T> {}
unsafe impl<T> Sync for JsRef<T> {}

#[cfg_attr(coverage_nightly, coverage(off))]
impl<T> std::fmt::Debug for JsRef<T> {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("JsRef").finish_non_exhaustive()
    }
}

#[cfg_attr(coverage_nightly, coverage(off))]
impl<T> Drop for JsRef<T> {
    fn drop(&mut self) {
        let status = unsafe { sys::napi_delete_reference(self.env, self.raw) };
        debug_assert_eq!(status, sys::Status::napi_ok);
    }
}

#[cfg_attr(coverage_nightly, coverage(off))]
impl<T: NapiRaw + NapiValue> JsRef<T> {
    /// Creates a reference that keeps `value` alive so it can outlive the JS
    /// call and be resolved later, possibly from another thread.
    pub fn from_js_value(env: &Env, value: &T) -> napi::Result<Self> {
        let raw_value = unsafe { value.raw() };
        let mut raw_ref = std::ptr::null_mut();
        unsafe {
            let status = sys::napi_create_reference(env.raw(), raw_value, 1, &mut raw_ref);
            if status != sys::Status::napi_ok {
                return Err(napi::Error::new(
                    napi::Status::GenericFailure,
                    "Failed to create reference",
                ));
            }
        }
        Ok(Self {
            raw: raw_ref,
            env: env.raw(),
            _marker: PhantomData,
        })
    }

    /// Resolves the reference back to its JavaScript value on the JS thread.
    pub fn get_value(&self, env: &Env) -> napi::Result<T> {
        let mut raw_value = std::ptr::null_mut();
        unsafe {
            let status = sys::napi_get_reference_value(env.raw(), self.raw, &mut raw_value);
            if status != sys::Status::napi_ok {
                return Err(napi::Error::new(
                    napi::Status::GenericFailure,
                    "Failed to get reference value",
                ));
            }
            Ok(T::from_raw_unchecked(env.raw(), raw_value))
        }
    }
}

/// A JavaScript function held across the FFI boundary so native code can invoke
/// it as a callback.
pub struct Callback {
    pub js_func: Arc<JsRef<JsFunction>>,
}

#[cfg_attr(coverage_nightly, coverage(off))]
impl std::fmt::Debug for Callback {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Callback").finish_non_exhaustive()
    }
}

#[cfg_attr(coverage_nightly, coverage(off))]
impl Callback {
    #[must_use]
    pub fn new(js_func: Arc<JsRef<JsFunction>>) -> Self {
        Self { js_func }
    }

    pub fn from_js_value(env: &Env, value: Unknown<'_>) -> napi::Result<Self> {
        let func: JsFunction = unsafe { JsFunction::from_raw_unchecked(env.raw(), value.raw()) };
        let func_ref = JsRef::from_js_value(env, &func)?;
        Ok(Self::new(Arc::new(func_ref)))
    }

    pub fn to_js_value<'env>(&self, env: &'env Env) -> napi::Result<Unknown<'env>> {
        let func = self.js_func.get_value(env)?;
        Ok(unsafe { Unknown::from_raw_unchecked(env.raw(), func.raw()) })
    }
}

#[cfg_attr(coverage_nightly, coverage(off))]
impl Clone for Callback {
    fn clone(&self) -> Self {
        Self {
            js_func: self.js_func.clone(),
        }
    }
}

/// An out-parameter reference: a boxed inner [`Value`] paired with the JS
/// wrapper object whose `value` property receives the updated result.
pub struct Ref {
    pub value: Box<Value>,
    pub js_obj: Arc<JsRef<JsObject>>,
}

#[cfg_attr(coverage_nightly, coverage(off))]
impl std::fmt::Debug for Ref {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Ref")
            .field("value", &self.value)
            .finish_non_exhaustive()
    }
}

#[cfg_attr(coverage_nightly, coverage(off))]
impl Clone for Ref {
    fn clone(&self) -> Self {
        Self {
            value: self.value.clone(),
            js_obj: self.js_obj.clone(),
        }
    }
}

#[cfg_attr(coverage_nightly, coverage(off))]
impl Ref {
    #[must_use]
    pub fn new(value: Value, js_obj: Arc<JsRef<JsObject>>) -> Self {
        Self {
            value: Box::new(value),
            js_obj,
        }
    }

    pub fn from_js_value(env: &Env, value: Unknown<'_>) -> napi::Result<Self> {
        let obj: JsObject = unsafe { JsObject::from_raw_unchecked(env.raw(), value.raw()) };
        let value_prop: Unknown<'_> = obj.get_named_property("value")?;
        let inner = Value::from_js_value(env, value_prop)?;
        let js_obj_ref = JsRef::from_js_value(env, &obj)?;

        Ok(Self::new(inner, Arc::new(js_obj_ref)))
    }
}

#[derive(Debug, Clone)]
#[non_exhaustive]
pub enum Value {
    Number(f64),
    String(String),
    Boolean(bool),
    Object(NativeHandle),
    Null,
    Undefined,
    Array(Vec<Self>),
    Callback(Callback),
    Ref(Ref),
}

impl Value {
    #[must_use]
    pub fn result_to_ptr(result: &std::result::Result<Self, ()>) -> *mut c_void {
        match result {
            Ok(Self::Object(handle)) => handle.ptr(),
            _ => std::ptr::null_mut(),
        }
    }

    /// Extracts the `f64` payload of a [`Value::Number`], mapping every other
    /// variant to `None`.
    #[must_use]
    pub fn as_number(&self) -> Option<f64> {
        match self {
            Self::Number(n) => Some(*n),
            _ => None,
        }
    }

    pub fn object_ptr(&self, type_name: &str) -> anyhow::Result<*mut c_void> {
        match self {
            Self::Object(handle) => Ok(handle.ptr()),
            Self::Null | Self::Undefined => Ok(std::ptr::null_mut()),
            Self::Number(_)
            | Self::String(_)
            | Self::Boolean(_)
            | Self::Array(_)
            | Self::Callback(_)
            | Self::Ref(_) => {
                anyhow::bail!("Expected an Object for {type_name} type, got {self:?}")
            }
        }
    }

    pub fn from_ffi_value_with_args(
        ffi_value: &ffi::FfiValue,
        ty: &Type,
        ffi_args: &[ffi::FfiValue],
        args: &[Arg],
    ) -> anyhow::Result<Self> {
        ty.decode_with_context(ffi_value, ffi_args, args)
    }

    #[cfg_attr(coverage_nightly, coverage(off))]
    pub fn from_js_value(env: &Env, value: Unknown<'_>) -> napi::Result<Self> {
        let value_type = value.get_type()?;

        match value_type {
            ValueType::Number => {
                let n = unsafe { f64::from_napi_value(env.raw(), value.raw())? };
                Ok(Self::Number(n))
            }
            ValueType::String => {
                let s = unsafe { String::from_napi_value(env.raw(), value.raw())? };
                Ok(Self::String(s))
            }
            ValueType::Boolean => {
                let b = unsafe { bool::from_napi_value(env.raw(), value.raw())? };
                Ok(Self::Boolean(b))
            }
            ValueType::Null => Ok(Self::Null),
            ValueType::Undefined => Ok(Self::Undefined),
            ValueType::External => {
                let external_ref =
                    unsafe { <&External<NativeHandle>>::from_napi_value(env.raw(), value.raw())? };
                Ok(Self::Object(NativeHandle::borrowed(external_ref.ptr())))
            }
            ValueType::Function => {
                let cb = Callback::from_js_value(env, value)?;
                Ok(Self::Callback(cb))
            }
            ValueType::Object => {
                if value.is_array()? {
                    let arr: Array = unsafe { Array::from_napi_value(env.raw(), value.raw())? };
                    Ok(Self::Array(map_js_array(env, &arr, Self::from_js_value)?))
                } else {
                    let r = Ref::from_js_value(env, value)?;
                    Ok(Self::Ref(r))
                }
            }
            other => Err(napi::Error::new(
                napi::Status::InvalidArg,
                format!("Unsupported JS value type: {other:?}"),
            )),
        }
    }

    #[cfg_attr(coverage_nightly, coverage(off))]
    pub fn to_js_value(self, env: &Env) -> napi::Result<Unknown<'_>> {
        match self {
            Self::Number(n) => unsafe {
                let raw = f64::to_napi_value(env.raw(), n)?;
                Ok(Unknown::from_raw_unchecked(env.raw(), raw))
            },
            Self::String(s) => unsafe {
                let raw = String::to_napi_value(env.raw(), s)?;
                Ok(Unknown::from_raw_unchecked(env.raw(), raw))
            },
            Self::Boolean(b) => unsafe {
                let raw = bool::to_napi_value(env.raw(), b)?;
                Ok(Unknown::from_raw_unchecked(env.raw(), raw))
            },
            Self::Object(handle) => unsafe {
                let size_hint = handle.size_hint();
                let external = External::new_with_size_hint(handle, size_hint);
                let raw = External::<NativeHandle>::to_napi_value(env.raw(), external)?;
                Ok(Unknown::from_raw_unchecked(env.raw(), raw))
            },
            Self::Array(arr) => {
                let mut js_array = env.create_array(arr.len() as u32)?;
                for (i, item) in arr.into_iter().enumerate() {
                    let js_item = item.to_js_value(env)?;
                    js_array.set(i as u32, js_item)?;
                }
                unsafe {
                    let raw = Array::to_napi_value(env.raw(), js_array)?;
                    Ok(Unknown::from_raw_unchecked(env.raw(), raw))
                }
            }
            Self::Null => unsafe {
                let raw = napi::bindgen_prelude::Null::to_napi_value(env.raw(), Null)?;
                Ok(Unknown::from_raw_unchecked(env.raw(), raw))
            },
            Self::Undefined => unsafe {
                let raw = napi::bindgen_prelude::Undefined::to_napi_value(env.raw(), ())?;
                Ok(Unknown::from_raw_unchecked(env.raw(), raw))
            },
            Self::Callback(_) | Self::Ref(_) => Err(napi::Error::new(
                napi::Status::InvalidArg,
                format!("Unsupported Value type for JS conversion: {self:?}"),
            )),
        }
    }
}

/// Maps each element of a JavaScript array through `convert`, collecting the
/// results in order.
///
/// Fails if any index is absent (a sparse hole), naming the offending index.
#[allow(clippy::trivially_copy_pass_by_ref)]
#[cfg_attr(coverage_nightly, coverage(off))]
pub(crate) fn map_js_array<T>(
    env: &Env,
    array: &Array,
    mut convert: impl FnMut(&Env, Unknown<'_>) -> napi::Result<T>,
) -> napi::Result<Vec<T>> {
    let len = array.len();
    let mut items = Vec::with_capacity(len as usize);
    for index in 0..len {
        let item: Unknown<'_> = array.get(index)?.ok_or_else(|| {
            napi::Error::new(
                napi::Status::GenericFailure,
                format!("array element {index} is missing"),
            )
        })?;
        items.push(convert(env, item)?);
    }
    Ok(items)
}

use std::ffi::c_void;
use std::marker::PhantomData;
use std::sync::Arc;
use std::thread::ThreadId;

use napi::bindgen_prelude::*;
use napi::sys;
use napi::{Env, JsFunction, JsObject, NapiRaw, NapiValue, ValueType};

use crate::dispatch::{JsReference, Mailbox};
use crate::managed::NativeHandle;
use crate::types::{FfiDecoder, Type};
use crate::{arg::Arg, ffi};

pub struct JsRef<T> {
    raw: sys::napi_ref,
    env: sys::napi_env,
    owner_thread: ThreadId,
    _marker: PhantomData<T>,
}

// SAFETY: `JsRef` only stores raw napi handles (`napi_ref`/`napi_env`) plus the id of the thread
// that created them. The handles are never dereferenced off their owning thread: cross-thread
// `Drop` routes the deletion back to that thread via `Mailbox::schedule_js_reference_delete`, and
// `get_value` is only called with an `Env` on the owning thread, so sharing/sending the handle
// across threads cannot touch napi state from the wrong thread.
unsafe impl<T> Send for JsRef<T> {}
// SAFETY: see the `Send` impl above — the raw napi handles are inert data and only acted upon on
// their owning thread, so concurrent `&JsRef` access never reaches napi from another thread.
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
        let reference = JsReference::new(self.env, self.raw);
        if std::thread::current().id() == self.owner_thread {
            reference.delete_on_js_thread();
        } else {
            Mailbox::global().schedule_js_reference_delete(reference);
        }
    }
}

#[cfg_attr(coverage_nightly, coverage(off))]
impl<T: NapiRaw + NapiValue> JsRef<T> {
    pub fn from_js_value(env: &Env, value: &T) -> napi::Result<Self> {
        // SAFETY: `value` is a live napi value belonging to `env`; `raw()` simply exposes its
        // underlying `napi_value` handle, which stays valid for the duration of this call.
        let raw_value = unsafe { value.raw() };
        let mut raw_ref = std::ptr::null_mut();
        // SAFETY: `env.raw()` is the live napi env, `raw_value` is a valid napi value from it, and
        // `raw_ref` points to a local out-pointer; `napi_create_reference` writes the new
        // reference handle there with an initial refcount of 1.
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
            owner_thread: std::thread::current().id(),
            _marker: PhantomData,
        })
    }

    pub fn get_value(&self, env: &Env) -> napi::Result<T> {
        let mut raw_value = std::ptr::null_mut();
        // SAFETY: this is called on the owning thread with that thread's live `env`; `self.raw` is
        // the reference created in `from_js_value`, so `napi_get_reference_value` resolves it into
        // `raw_value`, and `from_raw_unchecked` then wraps that valid `napi_value` as `T` (the
        // value was originally created as a `T`).
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
        // SAFETY: callers reach this path only after establishing `value` is a function
        // (`ValueType::Function`); reconstructing it as a `JsFunction` from `env` and its raw
        // handle is therefore well typed for the live `env`.
        let func: JsFunction = unsafe { JsFunction::from_raw_unchecked(env.raw(), value.raw()) };
        let func_ref = JsRef::from_js_value(env, &func)?;
        Ok(Self::new(Arc::new(func_ref)))
    }

    pub fn to_js_value<'env>(&self, env: &'env Env) -> napi::Result<Unknown<'env>> {
        let func = self.js_func.get_value(env)?;
        // SAFETY: `func` is a live `JsFunction` resolved from this `env`; `Unknown::from_raw_unchecked`
        // re-types its valid `napi_value` as an `Unknown` borrowing the same `env`.
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
        Self::from_js_value_at_depth(env, value, 0)
    }

    fn from_js_value_at_depth(env: &Env, value: Unknown<'_>, depth: usize) -> napi::Result<Self> {
        // SAFETY: this is reached from `Value::from_js_value_at_depth` only for the object branch
        // (after array/typed-array/dataview were ruled out), so `value` is an object of `env`;
        // reconstructing it as a `JsObject` from the raw pair is well typed.
        let obj: JsObject = unsafe { JsObject::from_raw_unchecked(env.raw(), value.raw()) };
        let value_prop: Unknown<'_> = obj.get_named_property("value")?;
        let inner = Value::from_js_value_at_depth(env, value_prop, depth)?;
        let js_obj_ref = JsRef::from_js_value(env, &obj)?;

        Ok(Self::new(inner, Arc::new(js_obj_ref)))
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[non_exhaustive]
pub enum BufferViewKind {
    Int8,
    Uint8,
    Uint8Clamped,
    Int16,
    Uint16,
    Int32,
    Uint32,
    Float32,
    Float64,
    BigInt64,
    BigUint64,
    DataView,
}

impl TryFrom<sys::napi_typedarray_type> for BufferViewKind {
    type Error = napi::Error;

    fn try_from(raw: sys::napi_typedarray_type) -> napi::Result<Self> {
        match raw {
            sys::TypedarrayType::int8_array => Ok(Self::Int8),
            sys::TypedarrayType::uint8_array => Ok(Self::Uint8),
            sys::TypedarrayType::uint8_clamped_array => Ok(Self::Uint8Clamped),
            sys::TypedarrayType::int16_array => Ok(Self::Int16),
            sys::TypedarrayType::uint16_array => Ok(Self::Uint16),
            sys::TypedarrayType::int32_array => Ok(Self::Int32),
            sys::TypedarrayType::uint32_array => Ok(Self::Uint32),
            sys::TypedarrayType::float32_array => Ok(Self::Float32),
            sys::TypedarrayType::float64_array => Ok(Self::Float64),
            sys::TypedarrayType::bigint64_array => Ok(Self::BigInt64),
            sys::TypedarrayType::biguint64_array => Ok(Self::BigUint64),
            other => Err(napi::Error::new(
                napi::Status::InvalidArg,
                format!("Unsupported typed-array type tag: {other}"),
            )),
        }
    }
}

impl BufferViewKind {
    #[must_use]
    pub fn element_size(self) -> usize {
        match self {
            Self::Int8 | Self::Uint8 | Self::Uint8Clamped | Self::DataView => 1,
            Self::Int16 | Self::Uint16 => 2,
            Self::Int32 | Self::Uint32 | Self::Float32 => 4,
            Self::Float64 | Self::BigInt64 | Self::BigUint64 => 8,
        }
    }
}

impl std::fmt::Display for BufferViewKind {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let name = match self {
            Self::Int8 => "Int8Array",
            Self::Uint8 => "Uint8Array",
            Self::Uint8Clamped => "Uint8ClampedArray",
            Self::Int16 => "Int16Array",
            Self::Uint16 => "Uint16Array",
            Self::Int32 => "Int32Array",
            Self::Uint32 => "Uint32Array",
            Self::Float32 => "Float32Array",
            Self::Float64 => "Float64Array",
            Self::BigInt64 => "BigInt64Array",
            Self::BigUint64 => "BigUint64Array",
            Self::DataView => "DataView",
        };
        write!(f, "{name}")
    }
}

#[derive(Debug, Clone, Copy)]
pub struct BufferView {
    ptr: *mut c_void,
    byte_length: usize,
    length: usize,
    kind: BufferViewKind,
    shared: bool,
}

// SAFETY: `BufferView` stores a raw data pointer into a JS ArrayBuffer plus plain `Copy` metadata.
// The pointer is treated as inert address data here; it is only dereferenced by the marshalling
// layer on the gtkx-glib thread while the backing buffer is kept alive, so moving the struct
// between threads does not by itself touch the buffer.
unsafe impl Send for BufferView {}
// SAFETY: see the `Send` impl above — the contained pointer is inert address data under shared
// access and never dereferenced through a shared `&BufferView`, so cross-thread sharing is sound.
unsafe impl Sync for BufferView {}

impl BufferView {
    #[must_use]
    pub fn new(
        ptr: *mut c_void,
        byte_length: usize,
        length: usize,
        kind: BufferViewKind,
        shared: bool,
    ) -> Self {
        Self {
            ptr,
            byte_length,
            length,
            kind,
            shared,
        }
    }

    #[must_use]
    pub fn ptr(&self) -> *mut c_void {
        self.ptr
    }

    #[must_use]
    pub fn byte_length(&self) -> usize {
        self.byte_length
    }

    #[must_use]
    pub fn length(&self) -> usize {
        self.length
    }

    #[must_use]
    pub fn kind(&self) -> BufferViewKind {
        self.kind
    }

    #[must_use]
    pub fn is_shared(&self) -> bool {
        self.shared
    }
}

#[cfg_attr(coverage_nightly, coverage(off))]
impl BufferView {
    fn from_typed_array(env: &Env, value: &Unknown<'_>) -> napi::Result<Self> {
        let mut raw_kind: sys::napi_typedarray_type = sys::TypedarrayType::int8_array;
        let mut length = 0usize;
        let mut data = std::ptr::null_mut();
        let mut array_buffer = std::ptr::null_mut();
        let mut byte_offset = 0usize;
        // SAFETY: callers reach this only after `value.is_typedarray()` succeeded, so `value` is a
        // typed array belonging to `env`; every out-parameter points to a live local of the type
        // `napi_get_typedarray_info` expects, which fills them in for that array.
        let status = unsafe {
            sys::napi_get_typedarray_info(
                env.raw(),
                value.raw(),
                &mut raw_kind,
                &mut length,
                &mut data,
                &mut array_buffer,
                &mut byte_offset,
            )
        };
        check_napi_status(status, "Failed to read typed-array info")?;
        let kind = BufferViewKind::try_from(raw_kind)?;
        let shared = Self::buffer_is_shared(env, array_buffer)?;
        Ok(Self::new(
            data,
            length * kind.element_size(),
            length,
            kind,
            shared,
        ))
    }

    fn from_data_view(env: &Env, value: &Unknown<'_>) -> napi::Result<Self> {
        let mut byte_length = 0usize;
        let mut data = std::ptr::null_mut();
        let mut array_buffer = std::ptr::null_mut();
        let mut byte_offset = 0usize;
        // SAFETY: callers reach this only after `value.is_dataview()` succeeded, so `value` is a
        // DataView belonging to `env`; every out-parameter points to a live local of the type
        // `napi_get_dataview_info` expects, which fills them in for that view.
        let status = unsafe {
            sys::napi_get_dataview_info(
                env.raw(),
                value.raw(),
                &mut byte_length,
                &mut data,
                &mut array_buffer,
                &mut byte_offset,
            )
        };
        check_napi_status(status, "Failed to read DataView info")?;
        let shared = Self::buffer_is_shared(env, array_buffer)?;
        Ok(Self::new(
            data,
            byte_length,
            byte_length,
            BufferViewKind::DataView,
            shared,
        ))
    }

    fn buffer_is_shared(env: &Env, buffer: sys::napi_value) -> napi::Result<bool> {
        let mut is_array_buffer = false;
        // SAFETY: `buffer` is the backing-buffer handle just returned by napi for a view of `env`,
        // and `is_array_buffer` is a live out-parameter; `napi_is_arraybuffer` writes the predicate
        // result there. A non-ArrayBuffer backing implies a SharedArrayBuffer.
        let status = unsafe { sys::napi_is_arraybuffer(env.raw(), buffer, &mut is_array_buffer) };
        check_napi_status(status, "Failed to inspect a view's backing buffer")?;
        Ok(!is_array_buffer)
    }
}

#[cfg_attr(coverage_nightly, coverage(off))]
fn check_napi_status(status: sys::napi_status, message: &str) -> napi::Result<()> {
    if status == sys::Status::napi_ok {
        Ok(())
    } else {
        Err(napi::Error::new(napi::Status::GenericFailure, message))
    }
}

#[derive(Debug, Clone)]
#[non_exhaustive]
pub enum Value {
    Number(f64),
    BigInt(i128),
    String(String),
    Boolean(bool),
    Object(NativeHandle),
    Null,
    Undefined,
    Array(Vec<Self>),
    BufferView(BufferView),
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

    #[must_use]
    pub fn as_number(&self) -> Option<f64> {
        match self {
            Self::Number(n) => Some(*n),
            _ => None,
        }
    }

    #[must_use]
    pub fn as_string(&self) -> Option<&str> {
        match self {
            Self::String(s) => Some(s),
            _ => None,
        }
    }

    #[must_use]
    pub fn as_array(&self) -> Option<&[Self]> {
        match self {
            Self::Array(items) => Some(items),
            _ => None,
        }
    }

    pub fn object_ptr(&self, type_name: &str) -> anyhow::Result<*mut c_void> {
        match self {
            Self::Object(handle) => Ok(handle.ptr()),
            Self::Null | Self::Undefined => Ok(std::ptr::null_mut()),
            Self::Number(_)
            | Self::BigInt(_)
            | Self::String(_)
            | Self::Boolean(_)
            | Self::Array(_)
            | Self::BufferView(_)
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
        Self::from_js_value_at_depth(env, value, 0)
    }

    #[cfg_attr(coverage_nightly, coverage(off))]
    fn from_js_value_at_depth(env: &Env, value: Unknown<'_>, depth: usize) -> napi::Result<Self> {
        const MAX_VALUE_DEPTH: usize = 64;
        if depth >= MAX_VALUE_DEPTH {
            return Err(napi::Error::new(
                napi::Status::InvalidArg,
                "value nesting exceeds the supported depth; is the input cyclic?",
            ));
        }

        let value_type = value.get_type()?;

        match value_type {
            ValueType::Number => {
                // SAFETY: `value_type` was confirmed `Number`, so `value` is a numeric napi value
                // of `env`; `f64::from_napi_value` reads it as a double.
                let n = unsafe { f64::from_napi_value(env.raw(), value.raw())? };
                Ok(Self::Number(n))
            }
            ValueType::String => {
                // SAFETY: `value_type` was confirmed `String`, so `value` is a string napi value of
                // `env`; `String::from_napi_value` decodes it.
                let s = unsafe { String::from_napi_value(env.raw(), value.raw())? };
                Ok(Self::String(s))
            }
            ValueType::Boolean => {
                // SAFETY: `value_type` was confirmed `Boolean`, so `value` is a boolean napi value
                // of `env`; `bool::from_napi_value` decodes it.
                let b = unsafe { bool::from_napi_value(env.raw(), value.raw())? };
                Ok(Self::Boolean(b))
            }
            ValueType::Null => Ok(Self::Null),
            ValueType::Undefined => Ok(Self::Undefined),
            ValueType::BigInt => {
                // SAFETY: `value_type` was confirmed `BigInt`, so `value` is a bigint napi value of
                // `env`; `BigInt::from_napi_value` decodes it.
                let big = unsafe { BigInt::from_napi_value(env.raw(), value.raw())? };
                let (int, lossless) = big.get_i128();
                if !lossless {
                    return Err(napi::Error::new(
                        napi::Status::InvalidArg,
                        "BigInt value exceeds the supported 128-bit range",
                    ));
                }
                Ok(Self::BigInt(int))
            }
            ValueType::External => {
                // SAFETY: `value_type` was confirmed `External`, so `value` is an external napi
                // value of `env`. These externals are only ever created by `to_js_value` wrapping a
                // `NativeHandle`, so decoding it back as `&External<NativeHandle>` matches the stored
                // type and borrows it for the duration of the call.
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
                    // SAFETY: `value.is_array()` just confirmed `value` is an array of `env`, so
                    // reconstructing an `Array` from the raw env/value pair is well typed.
                    let arr: Array = unsafe { Array::from_napi_value(env.raw(), value.raw())? };
                    Ok(Self::Array(map_js_array(env, &arr, |env, item| {
                        Self::from_js_value_at_depth(env, item, depth + 1)
                    })?))
                } else if value.is_typedarray()? {
                    Ok(Self::BufferView(BufferView::from_typed_array(env, &value)?))
                } else if value.is_dataview()? {
                    Ok(Self::BufferView(BufferView::from_data_view(env, &value)?))
                } else {
                    let r = Ref::from_js_value_at_depth(env, value, depth + 1)?;
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
            Self::Number(n) => n.into_unknown(env),
            Self::BigInt(v) => v.into_unknown(env),
            Self::String(s) => s.into_unknown(env),
            Self::Boolean(b) => b.into_unknown(env),
            Self::Object(handle) => {
                let size_hint = handle.size_hint();
                External::new_with_size_hint(handle, size_hint).into_unknown(env)
            }
            Self::Array(arr) => {
                let mut js_array = env.create_array(arr.len() as u32)?;
                for (i, item) in arr.into_iter().enumerate() {
                    let js_item = item.to_js_value(env)?;
                    js_array.set(i as u32, js_item)?;
                }
                js_array.into_unknown(env)
            }
            Self::Null => Null.into_unknown(env),
            Self::Undefined => ().into_unknown(env),
            Self::BufferView(_) | Self::Callback(_) | Self::Ref(_) => Err(napi::Error::new(
                napi::Status::InvalidArg,
                format!("Unsupported Value type for JS conversion: {self:?}"),
            )),
        }
    }
}

#[cfg_attr(coverage_nightly, coverage(off))]
pub(crate) fn unknown_as_object(env: &Env, value: &Unknown<'_>) -> napi::Result<JsObject> {
    // SAFETY: `value` is a live napi value of `env`; `JsObject::from_napi_value` validates that it
    // is an object and reconstructs it (or returns an error), so the raw pair is used soundly.
    unsafe { JsObject::from_napi_value(env.raw(), value.raw()) }
}

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

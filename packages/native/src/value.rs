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
use std::thread::ThreadId;

use napi::bindgen_prelude::*;
use napi::sys;
use napi::{Env, JsFunction, JsObject, NapiRaw, NapiValue, ValueType};

use crate::dispatch::{JsReference, Mailbox};
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
    owner_thread: ThreadId,
    _marker: PhantomData<T>,
}

// SAFETY: The contained napi_ref is an opaque token off the JS thread;
// only `get_value` dereferences it, on the JS thread, and Drop routes the
// deletion back there through the mailbox.
unsafe impl<T> Send for JsRef<T> {}
// SAFETY: Shared access never dereferences the raw pointers off the JS
// thread; see the Send justification above.
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
    /// Creates a reference that keeps `value` alive so it can outlive the JS
    /// call and be resolved later, possibly from another thread.
    pub fn from_js_value(env: &Env, value: &T) -> napi::Result<Self> {
        // SAFETY: `value` is a live JS value from the current callback's
        // `env`.
        let raw_value = unsafe { value.raw() };
        let mut raw_ref = std::ptr::null_mut();
        // SAFETY: This runs on the JS thread owning `env`, and `raw_value`
        // was just produced under it.
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

    /// Resolves the reference back to its JavaScript value on the JS thread.
    pub fn get_value(&self, env: &Env) -> napi::Result<T> {
        let mut raw_value = std::ptr::null_mut();
        // SAFETY: This runs on the JS thread owning `env`, and `self.raw`
        // is the live reference created alongside it.
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
        // SAFETY: `value` is a live JS value from the current callback's
        // `env`, dispatched here for the function value type.
        let func: JsFunction = unsafe { JsFunction::from_raw_unchecked(env.raw(), value.raw()) };
        let func_ref = JsRef::from_js_value(env, &func)?;
        Ok(Self::new(Arc::new(func_ref)))
    }

    pub fn to_js_value<'env>(&self, env: &'env Env) -> napi::Result<Unknown<'env>> {
        let func = self.js_func.get_value(env)?;
        // SAFETY: `func` is the live function just resolved under the
        // current callback's `env`.
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
        Self::from_js_value_at_depth(env, value, 0)
    }

    fn from_js_value_at_depth(env: &Env, value: Unknown<'_>, depth: usize) -> napi::Result<Self> {
        // SAFETY: `value` is a live JS value from the current callback's
        // `env`, dispatched here for the object value type.
        let obj: JsObject = unsafe { JsObject::from_raw_unchecked(env.raw(), value.raw()) };
        let value_prop: Unknown<'_> = obj.get_named_property("value")?;
        let inner = Value::from_js_value_at_depth(env, value_prop, depth)?;
        let js_obj_ref = JsRef::from_js_value(env, &obj)?;

        Ok(Self::new(inner, Arc::new(js_obj_ref)))
    }
}

/// Element kind of a JavaScript `ArrayBufferView`.
///
/// Mirrors the typed-array classes plus `DataView`, which views raw bytes
/// without an element type. The kind decides which array element types a view
/// may supply and how its element count converts to a byte length.
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

impl BufferViewKind {
    /// Resolves a napi typed-array type tag to its view kind.
    pub fn from_napi_typedarray_type(raw: sys::napi_typedarray_type) -> napi::Result<Self> {
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

    /// The size in bytes of one element of a view of this kind.
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

/// Zero-copy view over a JavaScript `ArrayBufferView`'s backing store.
///
/// Carries the view's data pointer (already offset to the view's first
/// element), its extent, its element kind, and whether the backing buffer is
/// a `SharedArrayBuffer`. Encoders hand the pointer to native code verbatim,
/// so callee writes land directly in the JavaScript buffer.
#[derive(Debug, Clone, Copy)]
pub struct BufferView {
    ptr: *mut c_void,
    byte_length: usize,
    length: usize,
    kind: BufferViewKind,
    shared: bool,
}

// SAFETY: The pointer is only dereferenced on the GLib thread while the JS
// thread parks inside the same call's dispatch
// (`Mailbox::dispatch_to_glib_and_wait`), so the backing store outlives every
// native access through it, and V8 never relocates ArrayBuffer backing
// stores.
unsafe impl Send for BufferView {}
// SAFETY: Shared access reads only the plain fields; see the Send
// justification for the pointer's thread discipline.
unsafe impl Sync for BufferView {}

impl BufferView {
    /// Wraps a backing-store window for FFI passthrough.
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

    /// Address of the view's first element.
    #[must_use]
    pub fn ptr(&self) -> *mut c_void {
        self.ptr
    }

    /// The view's extent in bytes.
    #[must_use]
    pub fn byte_length(&self) -> usize {
        self.byte_length
    }

    /// The view's element count (equal to [`Self::byte_length`] for
    /// `DataView`).
    #[must_use]
    pub fn length(&self) -> usize {
        self.length
    }

    /// The view's element kind.
    #[must_use]
    pub fn kind(&self) -> BufferViewKind {
        self.kind
    }

    /// Whether the backing buffer is a `SharedArrayBuffer`, which encoders
    /// reject: another agent could mutate or grow it mid-call.
    #[must_use]
    pub fn is_shared(&self) -> bool {
        self.shared
    }
}

/// The [`napi::Env`]-bound constructors wrap live JavaScript views, so — like
/// the other JS-reference conversions in this module — they are excluded from
/// coverage instrumentation.
#[cfg_attr(coverage_nightly, coverage(off))]
impl BufferView {
    fn from_typed_array(env: &Env, value: &Unknown<'_>) -> napi::Result<Self> {
        let mut raw_kind: sys::napi_typedarray_type = sys::TypedarrayType::int8_array;
        let mut length = 0usize;
        let mut data = std::ptr::null_mut();
        let mut array_buffer = std::ptr::null_mut();
        let mut byte_offset = 0usize;
        // SAFETY: `value` is a live JS value from the current callback's
        // `env`, verified to be a typed array by the caller; napi fills the
        // out slots, returning `data` already offset to the view's first
        // element.
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
        let kind = BufferViewKind::from_napi_typedarray_type(raw_kind)?;
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
        // SAFETY: `value` is a live JS value from the current callback's
        // `env`, verified to be a DataView by the caller; napi fills the out
        // slots, returning `data` already offset to the view's first byte.
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

    /// Whether `buffer` is a `SharedArrayBuffer`: napi reports the backing
    /// buffer of every view, but `napi_is_arraybuffer` is true only for a
    /// plain `ArrayBuffer`.
    fn buffer_is_shared(env: &Env, buffer: sys::napi_value) -> napi::Result<bool> {
        let mut is_array_buffer = false;
        // SAFETY: `buffer` is the live backing-buffer value napi just
        // produced under the current callback's `env`.
        let status = unsafe { sys::napi_is_arraybuffer(env.raw(), buffer, &mut is_array_buffer) };
        check_napi_status(status, "Failed to inspect a view's backing buffer")?;
        Ok(!is_array_buffer)
    }
}

/// Maps a non-ok napi status to an `Err` carrying `message`.
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

    /// Extracts the `f64` payload of a [`Value::Number`], mapping every other
    /// variant to `None`.
    #[must_use]
    pub fn as_number(&self) -> Option<f64> {
        match self {
            Self::Number(n) => Some(*n),
            _ => None,
        }
    }

    /// Extracts the string payload of a [`Value::String`], mapping every
    /// other variant to `None`.
    #[must_use]
    pub fn as_string(&self) -> Option<&str> {
        match self {
            Self::String(s) => Some(s),
            _ => None,
        }
    }

    /// Extracts the element slice of a [`Value::Array`], mapping every other
    /// variant to `None`.
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

    /// Recursive worker behind [`Self::from_js_value`], carrying the nesting
    /// depth so cyclic JS input (an array containing itself, a ref cell whose
    /// `value` is itself) surfaces as `InvalidArg` instead of overflowing the
    /// native stack and aborting the process.
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
                // SAFETY: `value` is a live JS value from the current
                // callback's `env`, type-checked as a number just above.
                let n = unsafe { f64::from_napi_value(env.raw(), value.raw())? };
                Ok(Self::Number(n))
            }
            ValueType::String => {
                // SAFETY: `value` is a live JS value from the current
                // callback's `env`, type-checked as a string just above.
                let s = unsafe { String::from_napi_value(env.raw(), value.raw())? };
                Ok(Self::String(s))
            }
            ValueType::Boolean => {
                // SAFETY: `value` is a live JS value from the current
                // callback's `env`, type-checked as a boolean just above.
                let b = unsafe { bool::from_napi_value(env.raw(), value.raw())? };
                Ok(Self::Boolean(b))
            }
            ValueType::Null => Ok(Self::Null),
            ValueType::Undefined => Ok(Self::Undefined),
            ValueType::External => {
                // SAFETY: `value` is a live JS value from the current
                // callback's `env`, type-checked as an external just
                // above.
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
                    // SAFETY: `value` is a live JS value from the current
                    // callback's `env`, verified to be an array just
                    // above.
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
            // SAFETY: The raw value is created and rewrapped under the
            // live `env` of the current JS-thread callback.
            Self::Number(n) => unsafe {
                let raw = f64::to_napi_value(env.raw(), n)?;
                Ok(Unknown::from_raw_unchecked(env.raw(), raw))
            },
            // SAFETY: The raw value is created and rewrapped under the
            // live `env` of the current JS-thread callback.
            Self::String(s) => unsafe {
                let raw = String::to_napi_value(env.raw(), s)?;
                Ok(Unknown::from_raw_unchecked(env.raw(), raw))
            },
            // SAFETY: The raw value is created and rewrapped under the
            // live `env` of the current JS-thread callback.
            Self::Boolean(b) => unsafe {
                let raw = bool::to_napi_value(env.raw(), b)?;
                Ok(Unknown::from_raw_unchecked(env.raw(), raw))
            },
            // SAFETY: The raw value is created and rewrapped under the
            // live `env` of the current JS-thread callback.
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
                // SAFETY: The raw value is created and rewrapped under the
                // live `env` of the current JS-thread callback.
                unsafe {
                    let raw = Array::to_napi_value(env.raw(), js_array)?;
                    Ok(Unknown::from_raw_unchecked(env.raw(), raw))
                }
            }
            // SAFETY: The raw value is created and rewrapped under the
            // live `env` of the current JS-thread callback.
            Self::Null => unsafe {
                let raw = napi::bindgen_prelude::Null::to_napi_value(env.raw(), Null)?;
                Ok(Unknown::from_raw_unchecked(env.raw(), raw))
            },
            // SAFETY: The raw value is created and rewrapped under the
            // live `env` of the current JS-thread callback.
            Self::Undefined => unsafe {
                let raw = napi::bindgen_prelude::Undefined::to_napi_value(env.raw(), ())?;
                Ok(Unknown::from_raw_unchecked(env.raw(), raw))
            },
            Self::BufferView(_) | Self::Callback(_) | Self::Ref(_) => Err(napi::Error::new(
                napi::Status::InvalidArg,
                format!("Unsupported Value type for JS conversion: {self:?}"),
            )),
        }
    }
}

/// Reinterprets `value`, an object-shaped JS value from the current
/// callback's `env`, as a [`JsObject`] — the shared prologue of every
/// descriptor parser.
#[cfg_attr(coverage_nightly, coverage(off))]
pub(crate) fn unknown_as_object(env: &Env, value: &Unknown<'_>) -> napi::Result<JsObject> {
    // SAFETY: `value` is a live JS value from the current callback's `env`,
    // so reinterpreting its raw handle as an object is sound.
    unsafe { JsObject::from_napi_value(env.raw(), value.raw()) }
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

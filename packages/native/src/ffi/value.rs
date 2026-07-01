use std::ffi::c_void;
use std::sync::Arc;
use std::thread::ThreadId;

use napi::bindgen_prelude::*;
use napi::sys;
use napi::{Env, ValueType};

use crate::handle::Handle;
use crate::messaging::{JsRefDeletion, Mailbox};

pub struct JsRef {
    raw: sys::napi_ref,
    env: sys::napi_env,
    owner_thread: ThreadId,
}

unsafe impl Send for JsRef {}
unsafe impl Sync for JsRef {}

impl std::fmt::Debug for JsRef {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("JsRef").finish_non_exhaustive()
    }
}

impl Drop for JsRef {
    fn drop(&mut self) {
        let reference = JsRefDeletion::new(self.env, self.raw);
        if std::thread::current().id() == self.owner_thread {
            reference.delete_on_node_thread();
        } else {
            Mailbox::global().schedule_js_reference_delete(reference);
        }
    }
}

impl JsRef {
    pub fn from_js_value<'a, V: JsValue<'a>>(env: &Env, value: &V) -> napi::Result<Self> {
        let raw_value = value.raw();
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
            owner_thread: std::thread::current().id(),
        })
    }

    pub fn get_raw(&self, env: &Env) -> napi::Result<sys::napi_value> {
        let mut raw_value = std::ptr::null_mut();
        unsafe {
            let status = sys::napi_get_reference_value(env.raw(), self.raw, &mut raw_value);
            if status != sys::Status::napi_ok {
                return Err(napi::Error::new(
                    napi::Status::GenericFailure,
                    "Failed to get reference value",
                ));
            }
        }
        Ok(raw_value)
    }

    pub fn get<T: FromNapiValue>(&self, env: &Env) -> napi::Result<T> {
        let raw_value = self.get_raw(env)?;
        unsafe { T::from_napi_value(env.raw(), raw_value) }
    }
}

pub struct Callback {
    pub js_fn: Arc<JsRef>,
}

impl std::fmt::Debug for Callback {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Callback").finish_non_exhaustive()
    }
}

impl Callback {
    pub fn new(js_fn: Arc<JsRef>) -> Self {
        Self { js_fn }
    }

    pub fn from_js_value(env: &Env, value: Unknown<'_>) -> napi::Result<Self> {
        let func_ref = JsRef::from_js_value(env, &value)?;
        Ok(Self::new(Arc::new(func_ref)))
    }
}

impl Clone for Callback {
    fn clone(&self) -> Self {
        Self {
            js_fn: self.js_fn.clone(),
        }
    }
}

pub struct Ref {
    pub value: Box<Value>,
    pub js_obj: Arc<JsRef>,
}

impl std::fmt::Debug for Ref {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Ref")
            .field("value", &self.value)
            .finish_non_exhaustive()
    }
}

impl Clone for Ref {
    fn clone(&self) -> Self {
        Self {
            value: self.value.clone(),
            js_obj: self.js_obj.clone(),
        }
    }
}

impl Ref {
    pub fn new(value: Value, js_obj: Arc<JsRef>) -> Self {
        Self {
            value: Box::new(value),
            js_obj,
        }
    }

    pub fn from_js_value(env: &Env, value: Unknown<'_>) -> napi::Result<Self> {
        Self::from_js_value_at_depth(env, value, 0)
    }

    fn from_js_value_at_depth(env: &Env, value: Unknown<'_>, depth: usize) -> napi::Result<Self> {
        let obj = Object::from_raw(env.raw(), value.raw());
        let value_prop: Unknown<'_> = obj.get_named_property("value")?;
        let inner = Value::from_js_value_at_depth(env, value_prop, depth)?;
        let js_obj_ref = JsRef::from_js_value(env, &obj)?;

        Ok(Self::new(inner, Arc::new(js_obj_ref)))
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
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

unsafe impl Send for BufferView {}
unsafe impl Sync for BufferView {}

impl BufferView {
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

    pub fn ptr(&self) -> *mut c_void {
        self.ptr
    }

    pub fn byte_length(&self) -> usize {
        self.byte_length
    }

    pub fn length(&self) -> usize {
        self.length
    }

    pub fn kind(&self) -> BufferViewKind {
        self.kind
    }

    pub fn is_shared(&self) -> bool {
        self.shared
    }
}

impl BufferView {
    fn from_typed_array(env: &Env, value: &Unknown<'_>) -> napi::Result<Self> {
        let mut raw_kind: sys::napi_typedarray_type = sys::TypedarrayType::int8_array;
        let mut length = 0usize;
        let mut data = std::ptr::null_mut();
        let mut array_buffer = std::ptr::null_mut();
        let mut byte_offset = 0usize;
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
        let status = unsafe { sys::napi_is_arraybuffer(env.raw(), buffer, &mut is_array_buffer) };
        check_napi_status(status, "Failed to inspect a view's backing buffer")?;
        Ok(!is_array_buffer)
    }
}

fn check_napi_status(status: sys::napi_status, message: &str) -> napi::Result<()> {
    if status == sys::Status::napi_ok {
        Ok(())
    } else {
        Err(napi::Error::new(napi::Status::GenericFailure, message))
    }
}

#[derive(Debug, Clone)]
pub enum Value {
    Number(f64),
    BigInt(i128),
    String(String),
    Boolean(bool),
    Object(Handle),
    Null,
    Undefined,
    Array(Vec<Self>),
    BufferView(BufferView),
    Callback(Callback),
    Ref(Ref),
}

impl Value {
    pub fn result_to_ptr(result: &std::result::Result<Self, ()>) -> *mut c_void {
        match result {
            Ok(Self::Object(handle)) => handle.ptr(),
            _ => std::ptr::null_mut(),
        }
    }

    pub fn as_number(&self) -> Option<f64> {
        match self {
            Self::Number(n) => Some(*n),
            _ => None,
        }
    }

    pub fn as_string(&self) -> Option<&str> {
        match self {
            Self::String(s) => Some(s),
            _ => None,
        }
    }

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

    pub fn from_js_value(env: &Env, value: Unknown<'_>) -> napi::Result<Self> {
        Self::from_js_value_at_depth(env, value, 0)
    }

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
            ValueType::BigInt => {
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
                let external_ref =
                    unsafe { <&External<Handle>>::from_napi_value(env.raw(), value.raw())? };
                Ok(Self::Object(Handle::borrowed(external_ref.ptr())))
            }
            ValueType::Function => {
                let cb = Callback::from_js_value(env, value)?;
                Ok(Self::Callback(cb))
            }
            ValueType::Object => {
                if value.is_array()? {
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

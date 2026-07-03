use std::ffi::c_void;

use napi::bindgen_prelude::*;
use napi::{Env, ValueType, sys};

use crate::handle::Handle;

fn from_napi<T: FromNapiValue>(env: &Env, raw: sys::napi_value) -> napi::Result<T> {
    unsafe { T::from_napi_value(env.raw(), raw) }
}

mod buffer_view;
mod callback;
mod js_ref;
mod r#ref;

pub use buffer_view::{BufferView, BufferViewKind};
pub use callback::Callback;
pub use js_ref::JsHandle;
pub(crate) use js_ref::release_registered_js_ref;
pub use r#ref::Ref;

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

impl From<crate::handle::Value> for Value {
    fn from(value: crate::handle::Value) -> Self {
        Self::Object(value.into())
    }
}

impl From<crate::handle::Boxed> for Value {
    fn from(boxed: crate::handle::Boxed) -> Self {
        crate::handle::Value::Boxed(boxed).into()
    }
}

impl From<crate::handle::Fundamental> for Value {
    fn from(fundamental: crate::handle::Fundamental) -> Self {
        crate::handle::Value::Fundamental(fundamental).into()
    }
}

impl Value {
    pub fn result_to_ptr(result: &std::result::Result<Self, ()>) -> *mut c_void {
        match result {
            Ok(Self::Object(handle)) => handle.as_ptr(),
            _ => std::ptr::null_mut(),
        }
    }

    pub fn object_ptr(&self, type_name: &str) -> anyhow::Result<*mut c_void> {
        match self {
            Self::Object(handle) => Ok(handle.as_ptr()),
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
                let n = from_napi::<f64>(env, value.raw())?;
                Ok(Self::Number(n))
            }
            ValueType::String => {
                let s = from_napi::<String>(env, value.raw())?;
                Ok(Self::String(s))
            }
            ValueType::Boolean => {
                let b = from_napi::<bool>(env, value.raw())?;
                Ok(Self::Boolean(b))
            }
            ValueType::Null => Ok(Self::Null),
            ValueType::Undefined => Ok(Self::Undefined),
            ValueType::BigInt => {
                let big = from_napi::<BigInt>(env, value.raw())?;
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
                let external_ref = from_napi::<&External<Handle>>(env, value.raw())?;
                Ok(Self::Object(Handle::from_glib_borrow(
                    external_ref.as_ptr(),
                )))
            }
            ValueType::Function => {
                let callback = Callback::from_js_value(env, value)?;
                Ok(Self::Callback(callback))
            }
            ValueType::Object => {
                if value.is_array()? {
                    let arr = from_napi::<Array>(env, value.raw())?;
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

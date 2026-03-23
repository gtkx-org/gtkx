//! JavaScript value representation for the native module.
//!
//! This module defines [`Value`], the intermediate representation for values
//! crossing between JavaScript and native code. Values are converted to/from
//! JavaScript objects via Neon and to/from FFI-compatible representations
//! via the [`ffi`] module.
//!
//! The [`Value`] enum supports all types that can be passed through the FFI:
//! - Primitives: numbers, strings, booleans
//! - Objects: GObjects, boxed types, structs
//! - Callbacks: JavaScript functions invocable from native code
//! - Arrays and references

use std::ffi::c_void;
use std::sync::Arc;

use anyhow::bail;
use gtk4::glib::{
    self,
    prelude::{ObjectExt as _, ObjectType as _},
    translate::{FromGlibPtrNone as _, ToGlibPtrMut as _},
    value::ToValue as _,
};
use neon::{handle::Root, object::Object as _, prelude::*};

use crate::managed::NativeHandle;
use crate::types::*;
use crate::{arg::Arg, ffi};

#[derive(Debug, Clone)]
pub struct Callback {
    pub js_func: Arc<Root<JsFunction>>,
    pub channel: Channel,
}

impl Callback {
    #[must_use]
    pub fn new(js_func: Arc<Root<JsFunction>>, channel: Channel) -> Self {
        Callback { js_func, channel }
    }

    pub fn from_js_value<'a, C: Context<'a>>(
        cx: &mut C,
        value: Handle<JsValue>,
    ) -> NeonResult<Self> {
        let js_func = value.downcast::<JsFunction, _>(cx).or_throw(cx)?;
        let js_func_root = js_func.root(cx);
        let mut channel = cx.channel();

        channel.unref(cx);

        Ok(Callback::new(Arc::new(js_func_root), channel))
    }

    pub fn to_js_value<'a, C: Context<'a>>(&self, cx: &mut C) -> NeonResult<Handle<'a, JsValue>> {
        let js_func = self.js_func.to_inner(cx);
        Ok(js_func.upcast())
    }
}

#[derive(Debug, Clone)]
pub struct Ref {
    pub value: Box<Value>,
    pub js_obj: Arc<Root<JsObject>>,
}

impl Ref {
    #[must_use]
    pub fn new(value: Value, js_obj: Arc<Root<JsObject>>) -> Self {
        Ref {
            value: Box::new(value),
            js_obj,
        }
    }

    pub fn from_js_value<'a, C: Context<'a>>(
        cx: &mut C,
        value: Handle<JsValue>,
    ) -> NeonResult<Self> {
        let obj = value.downcast::<JsObject, _>(cx).or_throw(cx)?;
        let js_obj_root = obj.root(cx);
        let value_prop: Handle<JsValue> = obj.get(cx, "value")?;
        let value = Value::from_js_value(cx, value_prop)?;

        Ok(Ref::new(value, Arc::new(js_obj_root)))
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
    Array(Vec<Value>),
    Callback(Callback),
    Ref(Ref),
}

impl Value {
    #[must_use]
    pub fn result_to_ptr(result: &Result<Self, ()>) -> *mut c_void {
        match result {
            Ok(Value::Object(handle)) => handle.get_ptr().unwrap_or(std::ptr::null_mut()),
            _ => std::ptr::null_mut(),
        }
    }

    pub fn object_ptr(&self, type_name: &str) -> anyhow::Result<*mut c_void> {
        match self {
            Value::Object(handle) => handle
                .get_ptr()
                .ok_or_else(|| anyhow::anyhow!("{} has been garbage collected", type_name)),
            Value::Null | Value::Undefined => Ok(std::ptr::null_mut()),
            Value::Number(_)
            | Value::String(_)
            | Value::Boolean(_)
            | Value::Array(_)
            | Value::Callback(_)
            | Value::Ref(_) => {
                anyhow::bail!("Expected an Object for {} type, got {:?}", type_name, self)
            }
        }
    }

    pub fn from_ffi_value(ffi_value: &ffi::FfiValue, ty: &Type) -> anyhow::Result<Self> {
        ty.decode(ffi_value)
    }

    pub fn from_ffi_value_with_args(
        ffi_value: &ffi::FfiValue,
        ty: &Type,
        ffi_args: &[ffi::FfiValue],
        args: &[Arg],
    ) -> anyhow::Result<Self> {
        ty.decode_with_context(ffi_value, ffi_args, args)
    }

    #[must_use]
    pub fn into_glib_value_with_default(self, return_type: Option<&Type>) -> Option<glib::Value> {
        match &self {
            Value::Undefined => {
                let ty = return_type?;
                let default = match ty {
                    Type::Boolean(_) => Value::Boolean(false),
                    Type::Integer(_) | Type::Enum(_) | Type::Flags(_) => Value::Number(0.0),
                    Type::Float(_) => Value::Number(0.0),
                    Type::String(_) | Type::GObject(_) => Value::Null,
                    Type::Void(_) => return None,
                    _ => return None,
                };
                ty.to_glib_value(&default).ok().flatten()
            }
            Value::Number(_)
            | Value::String(_)
            | Value::Boolean(_)
            | Value::Object(_)
            | Value::Null
            | Value::Array(_)
            | Value::Callback(_)
            | Value::Ref(_) => self.to_glib_value_typed(return_type).ok(),
        }
    }

    pub fn to_glib_value(self) -> anyhow::Result<glib::Value> {
        self.to_glib_value_typed(None)
    }

    pub fn to_glib_value_typed(self, expected_type: Option<&Type>) -> anyhow::Result<glib::Value> {
        if let Some(ty) = expected_type
            && let Some(gvalue) = ty.to_glib_value(&self)?
        {
            return Ok(gvalue);
        }
        match self {
            Value::Number(n) => Ok(n.into()),
            Value::String(s) => Ok(s.into()),
            Value::Boolean(b) => Ok(b.into()),
            Value::Object(handle) => {
                if let Some(ptr) = handle.get_ptr() {
                    let obj: glib::Object = unsafe {
                        glib::Object::from_glib_none(ptr as *mut glib::gobject_ffi::GObject)
                    };
                    let mut value = glib::Value::from_type(obj.type_());
                    unsafe {
                        glib::gobject_ffi::g_value_set_object(
                            value.to_glib_none_mut().0,
                            obj.as_ptr() as *mut _,
                        );
                    }
                    Ok(value)
                } else {
                    Ok(Option::<glib::Object>::None.to_value())
                }
            }
            Value::Null | Value::Undefined => {
                bail!("Cannot convert Null/Undefined to glib::Value without a type hint")
            }
            Value::Array(_) | Value::Callback(_) | Value::Ref(_) => bail!(
                "Unsupported Value type for glib::Value conversion: {:?}",
                self
            ),
        }
    }

    pub fn from_js_value<'a, C: Context<'a>>(
        cx: &mut C,
        value: Handle<JsValue>,
    ) -> NeonResult<Self> {
        if let Ok(number) = value.downcast::<JsNumber, _>(cx) {
            return Ok(Value::Number(number.value(cx)));
        }

        if let Ok(string) = value.downcast::<JsString, _>(cx) {
            return Ok(Value::String(string.value(cx)));
        }

        if let Ok(boolean) = value.downcast::<JsBoolean, _>(cx) {
            return Ok(Value::Boolean(boolean.value(cx)));
        }

        if value.downcast::<JsNull, _>(cx).is_ok() {
            return Ok(Value::Null);
        }

        if value.downcast::<JsUndefined, _>(cx).is_ok() {
            return Ok(Value::Undefined);
        }

        if let Ok(handle) = value.downcast::<JsBox<NativeHandle>, _>(cx) {
            return Ok(Value::Object(*handle.as_inner()));
        }

        if let Ok(callback) = value.downcast::<JsFunction, _>(cx) {
            return Ok(Value::Callback(Callback::from_js_value(
                cx,
                callback.upcast(),
            )?));
        }

        if let Ok(array) = value.downcast::<JsArray, _>(cx) {
            let values = array.to_vec(cx)?;
            let vec_values = values
                .into_iter()
                .map(|item| Self::from_js_value(cx, item))
                .collect::<NeonResult<Vec<_>>>()?;

            return Ok(Value::Array(vec_values));
        }

        if let Ok(obj) = value.downcast::<JsObject, _>(cx) {
            return Ok(Value::Ref(Ref::from_js_value(cx, obj.upcast())?));
        }

        cx.throw_type_error(format!("Unsupported JS value type: {:?}", *value))
    }

    pub fn to_js_value<'a, C: Context<'a>>(&self, cx: &mut C) -> NeonResult<Handle<'a, JsValue>> {
        match self {
            Value::Number(n) => Ok(cx.number(*n).upcast()),
            Value::String(s) => Ok(cx.string(s).upcast()),
            Value::Boolean(b) => Ok(cx.boolean(*b).upcast()),
            Value::Object(handle) => Ok(cx.boxed(*handle).upcast()),
            Value::Array(arr) => {
                let js_array = cx.empty_array();

                for (i, item) in arr.iter().enumerate() {
                    let js_item = item.to_js_value(cx)?;
                    js_array.set(cx, i as u32, js_item)?;
                }

                Ok(js_array.upcast())
            }
            Value::Null => Ok(cx.null().upcast()),
            Value::Undefined => Ok(cx.undefined().upcast()),
            Value::Callback(_) | Value::Ref(_) => cx.throw_type_error(format!(
                "Unsupported Value type for JS conversion: {:?}",
                self
            )),
        }
    }

    pub fn from_glib_value(gvalue: &glib::Value, ty: &Type) -> anyhow::Result<Self> {
        ty.from_glib_value(gvalue)
    }

    pub fn from_glib_values(args: &[glib::Value], arg_types: &[Type]) -> anyhow::Result<Vec<Self>> {
        args.iter()
            .zip(arg_types.iter())
            .map(|(gval, ty)| Self::from_glib_value(gval, ty))
            .collect()
    }
}

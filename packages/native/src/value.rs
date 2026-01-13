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
    translate::{FromGlibPtrNone as _, ToGlibPtr as _, ToGlibPtrMut as _},
    value::ToValue as _,
};
use neon::{handle::Root, object::Object as _, prelude::*};

use crate::ffi::FfiDecode;
use crate::managed::{Boxed, Fundamental, NativeHandle, NativeValue};
use crate::types::*;
use crate::{arg::Arg, ffi};

#[derive(Debug, Clone)]
pub struct Callback {
    pub js_func: Arc<Root<JsFunction>>,
    pub channel: Channel,
}

impl Callback {
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
    pub fn object_ptr(&self, type_name: &str) -> anyhow::Result<*mut c_void> {
        match self {
            Value::Object(id) => id
                .get_ptr()
                .ok_or_else(|| anyhow::anyhow!("{} has been garbage collected", type_name)),
            Value::Null | Value::Undefined => Ok(std::ptr::null_mut()),
            _ => anyhow::bail!("Expected an Object for {} type, got {:?}", type_name, self),
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

    pub fn into_glib_value_with_default(self, return_type: Option<&Type>) -> Option<glib::Value> {
        match &self {
            Value::Undefined => match return_type {
                Some(Type::Boolean) => Some(false.into()),
                Some(Type::Integer(_)) => Some(0i32.into()),
                Some(Type::Float(FloatKind::F32)) => Some(0.0f32.into()),
                Some(Type::Float(FloatKind::F64)) => Some(0.0f64.into()),
                Some(Type::String(_)) => Some(Option::<String>::None.into()),
                Some(Type::GObject(_)) => Some(Option::<glib::Object>::None.into()),
                Some(Type::Undefined) | None => None,
                _ => None,
            },
            _ => self.to_glib_value_typed(return_type).ok(),
        }
    }

    pub fn to_glib_value(self) -> anyhow::Result<glib::Value> {
        self.to_glib_value_typed(None)
    }

    pub fn to_glib_value_typed(self, expected_type: Option<&Type>) -> anyhow::Result<glib::Value> {
        match self {
            Value::Number(n) => {
                if let Some(Type::Integer(int_type)) = expected_type {
                    if int_type.is_enum_or_flags() {
                        return Self::number_to_enum_or_flags_value(n, int_type);
                    }
                    match int_type.kind {
                        IntegerKind::I8 => Ok((n as i8).into()),
                        IntegerKind::U8 => Ok((n as u8).into()),
                        IntegerKind::I16 => Ok((n as i16 as i32).into()),
                        IntegerKind::U16 => Ok((n as u16 as u32).into()),
                        IntegerKind::I32 => Ok((n as i32).into()),
                        IntegerKind::U32 => Ok((n as u32).into()),
                        IntegerKind::I64 => Ok((n as i64).into()),
                        IntegerKind::U64 => Ok((n as u64).into()),
                    }
                } else if let Some(Type::Float(float_kind)) = expected_type {
                    match float_kind {
                        FloatKind::F32 => Ok((n as f32).into()),
                        FloatKind::F64 => Ok(n.into()),
                    }
                } else {
                    Ok(n.into())
                }
            }
            Value::String(s) => Ok(s.into()),
            Value::Boolean(b) => Ok(b.into()),
            Value::Object(id) => {
                if let Some(ptr) = id.get_ptr() {
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
                bail!("Cannot convert Null/Undefined to glib::Value")
            }
            other => bail!(
                "Unsupported Value type for glib::Value conversion: {:?}",
                other
            ),
        }
    }

    fn number_to_enum_or_flags_value(
        n: f64,
        int_type: &IntegerType,
    ) -> anyhow::Result<glib::Value> {
        let lib_name = int_type
            .lib
            .as_ref()
            .ok_or_else(|| anyhow::anyhow!("Missing lib for enum/flags type"))?;
        let get_type_fn_name = int_type
            .get_type_fn
            .as_ref()
            .ok_or_else(|| anyhow::anyhow!("Missing get_type_fn for enum/flags type"))?;

        let gtype = crate::ffi::get_gtype_from_lib(lib_name, get_type_fn_name)?;

        let mut value = glib::Value::from_type(gtype);
        let is_flags = gtype.is_a(glib::types::Type::FLAGS);

        unsafe {
            if is_flags {
                glib::gobject_ffi::g_value_set_flags(value.to_glib_none_mut().0, n as u32);
            } else {
                glib::gobject_ffi::g_value_set_enum(value.to_glib_none_mut().0, n as i32);
            }
        }

        Ok(value)
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

        if let Ok(object_id) = value.downcast::<JsBox<NativeHandle>, _>(cx) {
            return Ok(Value::Object(*object_id.as_inner()));
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
            Value::Object(id) => Ok(cx.boxed(*id).upcast()),
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
            _ => cx.throw_type_error(format!(
                "Unsupported Value type for JS conversion: {:?}",
                self
            )),
        }
    }

    pub fn from_glib_value(gvalue: &glib::Value, ty: &Type) -> anyhow::Result<Self> {
        match ty {
            Type::Integer(int_type) => {
                let gtype = gvalue.type_();
                let is_enum = gtype.is_a(glib::types::Type::ENUM);
                let is_flags = gtype.is_a(glib::types::Type::FLAGS);

                let number = match int_type.kind {
                    IntegerKind::I8 => gvalue
                        .get::<i8>()
                        .map_err(|e| anyhow::anyhow!("Failed to get i8 from GValue: {}", e))?
                        as f64,
                    IntegerKind::U8 => gvalue
                        .get::<u8>()
                        .map_err(|e| anyhow::anyhow!("Failed to get u8 from GValue: {}", e))?
                        as f64,
                    IntegerKind::I16 => gvalue.get::<i32>().map_err(|e| {
                        anyhow::anyhow!("Failed to get i32 (as i16) from GValue: {}", e)
                    })? as i16 as f64,
                    IntegerKind::U16 => gvalue.get::<u32>().map_err(|e| {
                        anyhow::anyhow!("Failed to get u32 (as u16) from GValue: {}", e)
                    })? as u16 as f64,
                    IntegerKind::I32 => {
                        if is_enum {
                            // SAFETY: gvalue contains a valid enum type checked above
                            let enum_value = unsafe {
                                glib::gobject_ffi::g_value_get_enum(
                                    gvalue.to_glib_none().0 as *const _,
                                )
                            };
                            enum_value as f64
                        } else {
                            gvalue.get::<i32>().map_err(|e| {
                                anyhow::anyhow!("Failed to get i32 from GValue: {}", e)
                            })? as f64
                        }
                    }
                    IntegerKind::U32 => {
                        if is_flags {
                            // SAFETY: gvalue contains a valid flags type checked above
                            let flags_value = unsafe {
                                glib::gobject_ffi::g_value_get_flags(
                                    gvalue.to_glib_none().0 as *const _,
                                )
                            };
                            flags_value as f64
                        } else {
                            gvalue.get::<u32>().map_err(|e| {
                                anyhow::anyhow!("Failed to get u32 from GValue: {}", e)
                            })? as f64
                        }
                    }
                    IntegerKind::I64 => gvalue
                        .get::<i64>()
                        .map_err(|e| anyhow::anyhow!("Failed to get i64 from GValue: {}", e))?
                        as f64,
                    IntegerKind::U64 => gvalue
                        .get::<u64>()
                        .map_err(|e| anyhow::anyhow!("Failed to get u64 from GValue: {}", e))?
                        as f64,
                };
                Ok(Value::Number(number))
            }
            Type::Float(float_kind) => {
                let number = match float_kind {
                    FloatKind::F32 => gvalue
                        .get::<f32>()
                        .map_err(|e| anyhow::anyhow!("Failed to get f32 from GValue: {}", e))?
                        as f64,
                    FloatKind::F64 => gvalue
                        .get::<f64>()
                        .map_err(|e| anyhow::anyhow!("Failed to get f64 from GValue: {}", e))?,
                };
                Ok(Value::Number(number))
            }
            Type::String(_) => {
                let string: String = gvalue
                    .get()
                    .map_err(|e| anyhow::anyhow!("Failed to get String from GValue: {}", e))?;
                Ok(Value::String(string))
            }
            Type::Boolean => {
                let boolean: bool = gvalue
                    .get()
                    .map_err(|e| anyhow::anyhow!("Failed to get bool from GValue: {}", e))?;
                Ok(Value::Boolean(boolean))
            }
            Type::GObject(_) => Self::from_glib_gobject(gvalue),
            Type::Boxed(boxed_type) => {
                let gvalue_type = gvalue.type_();

                // SAFETY: gvalue contains a valid boxed type
                let boxed_ptr = unsafe {
                    glib::gobject_ffi::g_value_get_boxed(gvalue.to_glib_none().0 as *const _)
                };

                if boxed_ptr.is_null() {
                    return Ok(Value::Null);
                }

                let gtype = boxed_type.gtype().or(Some(gvalue_type));

                let boxed = if boxed_type.ownership.is_full() {
                    // SAFETY: gvalue contains a valid boxed type and we're duplicating ownership
                    let owned_ptr = unsafe {
                        glib::gobject_ffi::g_value_dup_boxed(gvalue.to_glib_none().0 as *const _)
                    };
                    Boxed::from_glib_full(gtype, owned_ptr)
                } else {
                    Boxed::from_glib_none(gtype, boxed_ptr)?
                };

                let object_id = NativeValue::Boxed(boxed).into();
                Ok(Value::Object(object_id))
            }
            Type::Null | Type::Undefined => Ok(Value::Null),
            Type::Struct(_) => {
                bail!(
                    "Plain struct type should not appear in glib value conversion - structs without GType cannot be stored in GValue"
                )
            }
            Type::Fundamental(fundamental_type) => {
                let gvalue_type = gvalue.type_();

                let ptr = if gvalue_type.is_a(glib::types::Type::VARIANT) {
                    // SAFETY: gvalue contains a valid variant type checked above
                    unsafe {
                        glib::gobject_ffi::g_value_get_variant(gvalue.to_glib_none().0 as *const _)
                            .cast::<c_void>()
                    }
                } else if gvalue_type.is_a(glib::types::Type::PARAM_SPEC) {
                    // SAFETY: gvalue contains a valid param spec type checked above
                    unsafe {
                        glib::gobject_ffi::g_value_get_param(gvalue.to_glib_none().0 as *const _)
                            .cast::<c_void>()
                    }
                } else {
                    bail!("Unsupported fundamental type in GValue: {:?}", gvalue_type)
                };

                if ptr.is_null() {
                    return Ok(Value::Null);
                }

                let (ref_fn, unref_fn) = fundamental_type.lookup_fns()?;
                let fundamental = if fundamental_type.ownership.is_full() {
                    Fundamental::from_glib_full(ptr, ref_fn, unref_fn)
                } else {
                    Fundamental::from_glib_none(ptr, ref_fn, unref_fn)
                };
                Ok(Value::Object(NativeValue::Fundamental(fundamental).into()))
            }
            Type::Array(_) | Type::HashTable(_) | Type::Ref(_) | Type::Callback(_) => {
                bail!(
                    "Type {:?} should not appear in glib value conversion - this indicates a bug in the type mapping",
                    ty
                )
            }
        }
    }

    pub fn from_glib_values(
        args: &[glib::Value],
        arg_types: &Option<Vec<Type>>,
    ) -> anyhow::Result<Vec<Self>> {
        match arg_types {
            Some(types) => args
                .iter()
                .zip(types.iter())
                .map(|(gval, ty)| Self::from_glib_value(gval, ty))
                .collect(),
            None if args.is_empty() => Ok(vec![]),
            None => bail!(
                "Callback received {} argument(s) but no argTypes were provided - \
                 this indicates a bug in the FFI binding definition",
                args.len()
            ),
        }
    }

    fn from_glib_gobject(gvalue: &glib::Value) -> anyhow::Result<Value> {
        // SAFETY: gvalue contains a valid GObject type
        let obj_ptr =
            unsafe { glib::gobject_ffi::g_value_get_object(gvalue.to_glib_none().0 as *const _) };

        if obj_ptr.is_null() {
            return Ok(Value::Null);
        }

        // SAFETY: obj_ptr is non-null and points to a valid GObject
        let type_class = unsafe { (*obj_ptr).g_type_instance.g_class };
        if type_class.is_null() {
            bail!("GObject has invalid type class (object may have been freed)");
        }

        // SAFETY: obj_ptr is a valid GObject with a valid type class
        let obj = unsafe { glib::Object::from_glib_none(obj_ptr) };
        Ok(Value::Object(NativeValue::GObject(obj).into()))
    }
}

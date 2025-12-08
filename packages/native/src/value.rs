use std::{
    ffi::{CStr, CString, c_void},
    sync::Arc,
};

use anyhow::bail;
use gtk4::{
    glib,
    glib::translate::{FromGlibPtrFull as _, FromGlibPtrNone as _, ToGlibPtr as _},
};
use neon::{handle::Root, object::Object as _, prelude::*};

use crate::{
    boxed::Boxed,
    cif,
    object::{Object, ObjectId},
    types::{Callback, FloatSize, IntegerSign, IntegerSize, Type},
};

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
    Object(ObjectId),
    Null,
    Undefined,
    Array(Vec<Value>),
    Callback(Callback),
    Ref(Ref),
}

impl Value {
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

        if let Ok(object_id) = value.downcast::<JsBox<ObjectId>, _>(cx) {
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

    pub fn from_cif_value(cif_value: &cif::Value, type_: &Type) -> anyhow::Result<Self> {
        match type_ {
            Type::Null => Ok(Value::Null),
            Type::Undefined => Ok(Value::Undefined),
            Type::Integer(_) | Type::Float(_) => {
                let number = match cif_value {
                    cif::Value::I8(v) => *v as f64,
                    cif::Value::U8(v) => *v as f64,
                    cif::Value::I16(v) => *v as f64,
                    cif::Value::U16(v) => *v as f64,
                    cif::Value::I32(v) => *v as f64,
                    cif::Value::U32(v) => *v as f64,
                    cif::Value::I64(v) => *v as f64,
                    cif::Value::U64(v) => *v as f64,
                    cif::Value::F32(v) => *v as f64,
                    cif::Value::F64(v) => *v,
                    _ => {
                        bail!("Expected a number cif::Value, got {:?}", cif_value)
                    }
                };

                Ok(Value::Number(number))
            }
            Type::String(string_type) => {
                let str_ptr = match cif_value {
                    cif::Value::Ptr(ptr) => *ptr,
                    _ => {
                        bail!(
                            "Expected a pointer cif::Value for string, got {:?}",
                            cif_value
                        )
                    }
                };

                if str_ptr.is_null() {
                    return Ok(Value::Null);
                }

                let string = if string_type.is_borrowed {
                    let c_str = unsafe { CStr::from_ptr(str_ptr as *const i8) };
                    c_str.to_str()?.to_string()
                } else {
                    let c_string = unsafe { CString::from_raw(str_ptr as *mut i8) };
                    c_string.into_string()?
                };

                Ok(Value::String(string))
            }
            Type::Boolean => {
                let bool = match cif_value {
                    cif::Value::U8(v) => *v != 0,
                    _ => {
                        bail!("Expected a boolean cif::Value, got {:?}", cif_value)
                    }
                };

                Ok(Value::Boolean(bool))
            }
            Type::GObject(type_) => {
                let object_ptr = match cif_value {
                    cif::Value::Ptr(ptr) => *ptr,
                    _ => {
                        bail!(
                            "Expected a pointer cif::Value for GObject, got {:?}",
                            cif_value
                        )
                    }
                };

                if object_ptr.is_null() {
                    return Ok(Value::Null);
                }

                let object = if type_.is_borrowed {
                    let object = unsafe {
                        glib::Object::from_glib_none(object_ptr as *mut glib::gobject_ffi::GObject)
                    };

                    Object::GObject(object)
                } else {
                    let object = unsafe {
                        glib::Object::from_glib_full(object_ptr as *mut glib::gobject_ffi::GObject)
                    };

                    Object::GObject(object)
                };

                Ok(Value::Object(ObjectId::new(object)))
            }
            Type::Boxed(type_) => {
                let boxed_ptr = match cif_value {
                    cif::Value::Ptr(ptr) => *ptr,
                    _ => {
                        bail!(
                            "Expected a pointer cif::Value for Boxed, got {:?}",
                            cif_value
                        )
                    }
                };

                if boxed_ptr.is_null() {
                    return Ok(Value::Null);
                }

                let gtype = type_.get_gtype();

                let boxed = if type_.is_borrowed {
                    let boxed = Boxed::from_glib_none(gtype, boxed_ptr);
                    Object::Boxed(boxed)
                } else {
                    let boxed = Boxed::from_glib_full(gtype, boxed_ptr);
                    Object::Boxed(boxed)
                };

                Ok(Value::Object(ObjectId::new(boxed)))
            }
            Type::Array(array_type) => {
                use crate::types::ListType;

                if array_type.list_type == ListType::GList
                    || array_type.list_type == ListType::GSList
                {
                    let list_ptr = match cif_value {
                        cif::Value::Ptr(ptr) => *ptr,
                        _ => {
                            bail!(
                                "Expected a pointer cif::Value for GList/GSList, got {:?}",
                                cif_value
                            )
                        }
                    };

                    if list_ptr.is_null() {
                        return Ok(Value::Array(vec![]));
                    }

                    let mut values = Vec::new();
                    let mut current = list_ptr as *mut glib::ffi::GList;

                    while !current.is_null() {
                        let data = unsafe { (*current).data };
                        let item_value = match &*array_type.item_type {
                            Type::GObject(_) => {
                                if data.is_null() {
                                    Value::Null
                                } else {
                                    let object = unsafe {
                                        glib::Object::from_glib_none(
                                            data as *mut glib::gobject_ffi::GObject,
                                        )
                                    };
                                    Value::Object(ObjectId::new(Object::GObject(object)))
                                }
                            }
                            Type::Boxed(boxed_type) => {
                                if data.is_null() {
                                    Value::Null
                                } else {
                                    let gtype = boxed_type.get_gtype();
                                    let boxed = Boxed::from_glib_none(gtype, data);
                                    Value::Object(ObjectId::new(Object::Boxed(boxed)))
                                }
                            }
                            Type::String(_) => {
                                if data.is_null() {
                                    Value::Null
                                } else {
                                    let c_str = unsafe { CStr::from_ptr(data as *const i8) };
                                    Value::String(c_str.to_str().unwrap_or("").to_string())
                                }
                            }
                            _ => {
                                bail!("Unsupported GList item type: {:?}", array_type.item_type);
                            }
                        };
                        values.push(item_value);
                        current = unsafe { (*current).next };
                    }

                    if !array_type.is_borrowed {
                        unsafe {
                            glib::ffi::g_list_free(list_ptr as *mut glib::ffi::GList);
                        }
                    }

                    return Ok(Value::Array(values));
                }

                if let cif::Value::Ptr(ptr) = cif_value {
                    if ptr.is_null() {
                        return Ok(Value::Array(vec![]));
                    }

                    match &*array_type.item_type {
                        Type::String(_) => {
                            let mut values = Vec::new();
                            let str_array = *ptr as *const *const i8;
                            let mut i = 0;
                            loop {
                                let str_ptr = unsafe { *str_array.offset(i) };
                                if str_ptr.is_null() {
                                    break;
                                }
                                let c_str = unsafe { CStr::from_ptr(str_ptr) };
                                values.push(Value::String(c_str.to_str().unwrap_or("").to_string()));
                                i += 1;
                            }

                            if !array_type.is_borrowed {
                                unsafe {
                                    glib::ffi::g_strfreev(*ptr as *mut *mut i8);
                                }
                            }

                            return Ok(Value::Array(values));
                        }
                        _ => {
                            bail!(
                                "Unsupported null-terminated array item type: {:?}",
                                array_type.item_type
                            );
                        }
                    }
                }

                let array_ptr = match cif_value {
                    cif::Value::OwnedPtr(ptr) => ptr,
                    _ => {
                        bail!(
                            "Expected an owned pointer cif::Value for Array, got {:?}",
                            cif_value
                        )
                    }
                };

                let values = match &*array_type.item_type {
                    Type::Integer(type_) => match (type_.size, type_.sign) {
                        (IntegerSize::_8, IntegerSign::Unsigned) => {
                            let u8_vec = array_ptr.value.downcast_ref::<Vec<u8>>().ok_or(
                                anyhow::anyhow!("Failed to downcast array items to Vec<u8>"),
                            )?;

                            u8_vec
                                .iter()
                                .map(|v| Value::Number(*v as f64))
                                .collect::<Vec<Value>>()
                        }
                        (IntegerSize::_8, IntegerSign::Signed) => {
                            let i8_vec = array_ptr.value.downcast_ref::<Vec<i8>>().ok_or(
                                anyhow::anyhow!("Failed to downcast array items to Vec<i8>"),
                            )?;

                            i8_vec
                                .iter()
                                .map(|v| Value::Number(*v as f64))
                                .collect::<Vec<Value>>()
                        }
                        (IntegerSize::_16, IntegerSign::Unsigned) => {
                            let u16_vec = array_ptr.value.downcast_ref::<Vec<u16>>().ok_or(
                                anyhow::anyhow!("Failed to downcast array items to Vec<u16>"),
                            )?;

                            u16_vec
                                .iter()
                                .map(|v| Value::Number(*v as f64))
                                .collect::<Vec<Value>>()
                        }
                        (IntegerSize::_16, IntegerSign::Signed) => {
                            let i16_vec = array_ptr.value.downcast_ref::<Vec<i16>>().ok_or(
                                anyhow::anyhow!("Failed to downcast array items to Vec<i16>"),
                            )?;

                            i16_vec
                                .iter()
                                .map(|v| Value::Number(*v as f64))
                                .collect::<Vec<Value>>()
                        }
                        (IntegerSize::_32, IntegerSign::Unsigned) => {
                            let u32_vec = array_ptr.value.downcast_ref::<Vec<u32>>().ok_or(
                                anyhow::anyhow!("Failed to downcast array items to Vec<u32>"),
                            )?;

                            u32_vec
                                .iter()
                                .map(|v| Value::Number(*v as f64))
                                .collect::<Vec<Value>>()
                        }
                        (IntegerSize::_32, IntegerSign::Signed) => {
                            let i32_vec = array_ptr.value.downcast_ref::<Vec<i32>>().ok_or(
                                anyhow::anyhow!("Failed to downcast array items to Vec<i32>"),
                            )?;

                            i32_vec
                                .iter()
                                .map(|v| Value::Number(*v as f64))
                                .collect::<Vec<Value>>()
                        }
                        (IntegerSize::_64, IntegerSign::Unsigned) => {
                            let u64_vec = array_ptr.value.downcast_ref::<Vec<u64>>().ok_or(
                                anyhow::anyhow!("Failed to downcast array items to Vec<u64>"),
                            )?;

                            u64_vec
                                .iter()
                                .map(|v| Value::Number(*v as f64))
                                .collect::<Vec<Value>>()
                        }
                        (IntegerSize::_64, IntegerSign::Signed) => {
                            let i64_vec = array_ptr.value.downcast_ref::<Vec<i64>>().ok_or(
                                anyhow::anyhow!("Failed to downcast array items to Vec<i64>"),
                            )?;

                            i64_vec
                                .iter()
                                .map(|v| Value::Number(*v as f64))
                                .collect::<Vec<Value>>()
                        }
                    },
                    Type::Float(float_type) => match float_type.size {
                        FloatSize::_32 => {
                            let f32_vec = array_ptr.value.downcast_ref::<Vec<f32>>().ok_or(
                                anyhow::anyhow!("Failed to downcast array items to Vec<f32>"),
                            )?;

                            f32_vec
                                .iter()
                                .map(|v| Value::Number(*v as f64))
                                .collect::<Vec<Value>>()
                        }
                        FloatSize::_64 => {
                            let f64_vec = array_ptr.value.downcast_ref::<Vec<f64>>().ok_or(
                                anyhow::anyhow!("Failed to downcast array items to Vec<f64>"),
                            )?;

                            f64_vec
                                .iter()
                                .map(|v| Value::Number(*v))
                                .collect::<Vec<Value>>()
                        }
                    },
                    Type::String(_) => {
                        let (cstrings, _) = array_ptr
                            .value
                            .downcast_ref::<(Vec<CString>, Vec<*mut c_void>)>()
                            .ok_or(anyhow::anyhow!(
                                "Failed to downcast array items to Vec<CString> tuple"
                            ))?;

                        cstrings
                            .iter()
                            .map(|cstr| Ok(Value::String(cstr.to_str()?.to_string())))
                            .collect::<anyhow::Result<Vec<Value>>>()?
                    }
                    Type::Boolean => {
                        let bool_vec = array_ptr
                            .value
                            .downcast_ref::<Vec<u8>>()
                            .ok_or(anyhow::anyhow!("Failed to downcast array items to Vec<u8>"))?;

                        bool_vec
                            .iter()
                            .map(|v| Value::Boolean(*v != 0))
                            .collect::<Vec<Value>>()
                    }
                    Type::GObject(_) | Type::Boxed(_) => {
                        let (ids, _) = array_ptr
                            .value
                            .downcast_ref::<(Vec<ObjectId>, Vec<*mut c_void>)>()
                            .ok_or(anyhow::anyhow!(
                                "Failed to downcast array items to Vec<ObjectId> tuple"
                            ))?;

                        ids.iter()
                            .map(|id| Value::Object(*id))
                            .collect::<Vec<Value>>()
                    }
                    _ => bail!(
                        "Unsupported array item type for cif value conversion: {:?}",
                        array_type.item_type
                    ),
                };

                Ok(Value::Array(values))
            }
            Type::Ref(type_) => {
                let ref_ptr = match cif_value {
                    cif::Value::OwnedPtr(ptr) => ptr,
                    _ => {
                        bail!(
                            "Expected an owned pointer cif::Value for Ref, got {:?}",
                            cif_value
                        )
                    }
                };

                match &*type_.inner_type {
                    Type::GObject(gobject_type) => {
                        let actual_ptr = unsafe { *(ref_ptr.ptr as *const *mut c_void) };

                        if actual_ptr.is_null() {
                            return Ok(Value::Null);
                        }

                        let object = if gobject_type.is_borrowed {
                            unsafe {
                                glib::Object::from_glib_none(
                                    actual_ptr as *mut glib::gobject_ffi::GObject,
                                )
                            }
                        } else {
                            unsafe {
                                glib::Object::from_glib_full(
                                    actual_ptr as *mut glib::gobject_ffi::GObject,
                                )
                            }
                        };

                        Ok(Value::Object(ObjectId::new(Object::GObject(object))))
                    }
                    Type::Boxed(boxed_type) => {
                        let actual_ptr = unsafe { *(ref_ptr.ptr as *const *mut c_void) };

                        if actual_ptr.is_null() {
                            return Ok(Value::Null);
                        }

                        let gtype = boxed_type.get_gtype();
                        let boxed = if boxed_type.is_borrowed {
                            Boxed::from_glib_none(gtype, actual_ptr)
                        } else {
                            Boxed::from_glib_full(gtype, actual_ptr)
                        };

                        Ok(Value::Object(ObjectId::new(Object::Boxed(boxed))))
                    }
                    Type::Integer(int_type) => {
                        let number = match (int_type.size, int_type.sign) {
                            (IntegerSize::_8, IntegerSign::Unsigned) => unsafe {
                                *(ref_ptr.ptr as *const u8) as f64
                            },
                            (IntegerSize::_8, IntegerSign::Signed) => unsafe {
                                *(ref_ptr.ptr as *const i8) as f64
                            },
                            (IntegerSize::_16, IntegerSign::Unsigned) => unsafe {
                                *(ref_ptr.ptr as *const u16) as f64
                            },
                            (IntegerSize::_16, IntegerSign::Signed) => unsafe {
                                *(ref_ptr.ptr as *const i16) as f64
                            },
                            (IntegerSize::_32, IntegerSign::Unsigned) => unsafe {
                                *(ref_ptr.ptr as *const u32) as f64
                            },
                            (IntegerSize::_32, IntegerSign::Signed) => unsafe {
                                *(ref_ptr.ptr as *const i32) as f64
                            },
                            (IntegerSize::_64, IntegerSign::Unsigned) => unsafe {
                                *(ref_ptr.ptr as *const u64) as f64
                            },
                            (IntegerSize::_64, IntegerSign::Signed) => unsafe {
                                *(ref_ptr.ptr as *const i64) as f64
                            },
                        };
                        Ok(Value::Number(number))
                    }
                    Type::Float(float_type) => {
                        let number = match float_type.size {
                            FloatSize::_32 => unsafe { *(ref_ptr.ptr as *const f32) as f64 },
                            FloatSize::_64 => unsafe { *(ref_ptr.ptr as *const f64) },
                        };
                        Ok(Value::Number(number))
                    }
                    _ => {
                        bail!(
                            "Unsupported ref inner type for reading: {:?}",
                            type_.inner_type
                        )
                    }
                }
            }
            _ => bail!("Unsupported type for cif value conversion: {:?}", type_),
        }
    }
}

impl Value {
    pub fn from_glib_value(gvalue: &glib::Value, type_: &Type) -> Self {
        match type_ {
            Type::Integer(int_type) => {
                let gtype = gvalue.type_();
                let is_enum = gtype.is_a(glib::types::Type::ENUM);
                let is_flags = gtype.is_a(glib::types::Type::FLAGS);

                match (int_type.size, int_type.sign) {
                    (IntegerSize::_8, IntegerSign::Signed) => {
                        Value::Number(gvalue.get::<i8>().unwrap() as f64)
                    }
                    (IntegerSize::_8, IntegerSign::Unsigned) => {
                        Value::Number(gvalue.get::<u8>().unwrap() as f64)
                    }
                    (IntegerSize::_16, IntegerSign::Signed) => {
                        Value::Number(gvalue.get::<i32>().unwrap() as i16 as f64)
                    }
                    (IntegerSize::_16, IntegerSign::Unsigned) => {
                        Value::Number(gvalue.get::<u32>().unwrap() as u16 as f64)
                    }
                    (IntegerSize::_32, IntegerSign::Signed) => {
                        if is_enum {
                            let enum_value = unsafe {
                                glib::gobject_ffi::g_value_get_enum(
                                    gvalue.to_glib_none().0 as *const _,
                                )
                            };
                            Value::Number(enum_value as f64)
                        } else {
                            Value::Number(gvalue.get::<i32>().unwrap() as f64)
                        }
                    }
                    (IntegerSize::_32, IntegerSign::Unsigned) => {
                        if is_flags {
                            let flags_value = unsafe {
                                glib::gobject_ffi::g_value_get_flags(
                                    gvalue.to_glib_none().0 as *const _,
                                )
                            };
                            Value::Number(flags_value as f64)
                        } else {
                            Value::Number(gvalue.get::<u32>().unwrap() as f64)
                        }
                    }
                    (IntegerSize::_64, IntegerSign::Signed) => {
                        Value::Number(gvalue.get::<i64>().unwrap() as f64)
                    }
                    (IntegerSize::_64, IntegerSign::Unsigned) => {
                        Value::Number(gvalue.get::<u64>().unwrap() as f64)
                    }
                }
            }
            Type::Float(float_type) => match float_type.size {
                FloatSize::_32 => Value::Number(gvalue.get::<f32>().unwrap() as f64),
                FloatSize::_64 => Value::Number(gvalue.get::<f64>().unwrap()),
            },
            Type::String(_) => {
                let string: String = gvalue.get().unwrap();
                Value::String(string)
            }
            Type::Boolean => {
                let boolean: bool = gvalue.get().unwrap();
                Value::Boolean(boolean)
            }
            Type::GObject(_) => gvalue
                .get::<Option<glib::Object>>()
                .unwrap()
                .map_or(Value::Null, |obj| {
                    Value::Object(ObjectId::new(Object::GObject(obj)))
                }),
            Type::Boxed(boxed_type) => {
                let boxed_ptr = gvalue.as_ptr();

                if boxed_ptr.is_null() {
                    return Value::Null;
                }

                let gtype = boxed_type.get_gtype().or_else(|| Some(gvalue.type_()));

                let boxed = if boxed_type.is_borrowed {
                    Boxed::from_glib_none(gtype, boxed_ptr as *mut c_void)
                } else {
                    Boxed::from_glib_full(gtype, boxed_ptr as *mut c_void)
                };

                let object_id = ObjectId::new(Object::Boxed(boxed));
                Value::Object(object_id)
            }
            Type::Null | Type::Undefined => Value::Null,
            Type::Array(_) | Type::Ref(_) | Type::Callback(_) => {
                unreachable!(
                    "Type {:?} should not appear in glib value conversion - this indicates a bug in the type mapping",
                    type_
                )
            }
        }
    }

    pub fn into_glib_value_with_default(self, return_type: Option<&Type>) -> Option<glib::Value> {
        match &self {
            Value::Undefined => match return_type {
                Some(Type::Boolean) => Some(false.into()),
                Some(Type::Integer(_)) => Some(0i32.into()),
                _ => None,
            },
            _ => self.into(),
        }
    }
}

impl From<&glib::Value> for Value {
    fn from(value: &glib::Value) -> Self {
        if value.is_type(glib::types::Type::I8) {
            Value::Number(value.get::<i8>().unwrap() as f64)
        } else if value.is_type(glib::types::Type::U8) {
            Value::Number(value.get::<u8>().unwrap() as f64)
        } else if value.is_type(glib::types::Type::I32) {
            Value::Number(value.get::<i32>().unwrap() as f64)
        } else if value.is_type(glib::types::Type::U32) {
            Value::Number(value.get::<u32>().unwrap() as f64)
        } else if value.is_type(glib::types::Type::I64) {
            Value::Number(value.get::<i64>().unwrap() as f64)
        } else if value.is_type(glib::types::Type::U64) {
            Value::Number(value.get::<u64>().unwrap() as f64)
        } else if value.is_type(glib::types::Type::F32) {
            Value::Number(value.get::<f32>().unwrap() as f64)
        } else if value.is_type(glib::types::Type::F64) {
            Value::Number(value.get::<f64>().unwrap())
        } else if value.is_type(glib::types::Type::STRING) {
            let string: String = value.get().unwrap();
            Value::String(string)
        } else if value.is_type(glib::types::Type::BOOL) {
            let boolean: bool = value.get().unwrap();
            Value::Boolean(boolean)
        } else if value.is_type(glib::types::Type::OBJECT) {
            let object: glib::Object = value.get().unwrap();
            let object_id = ObjectId::new(Object::GObject(object));
            Value::Object(object_id)
        } else if value.is_type(glib::types::Type::BOXED) {
            let boxed_ptr = value.as_ptr();

            if boxed_ptr.is_null() {
                Value::Null
            } else {
                let boxed = Boxed::from_glib_none(Some(value.type_()), boxed_ptr as *mut c_void);
                let object_id = ObjectId::new(Object::Boxed(boxed));
                Value::Object(object_id)
            }
        } else if value.type_().is_a(glib::types::Type::PARAM_SPEC) {
            let param_spec: glib::ParamSpec = value.get().unwrap();
            Value::String(param_spec.name().to_string())
        } else if value.type_().is_a(glib::types::Type::ENUM) {
            let enum_value = unsafe {
                glib::gobject_ffi::g_value_get_enum(
                    glib::translate::ToGlibPtr::to_glib_none(value).0 as *const _,
                )
            };
            Value::Number(enum_value as f64)
        } else if value.type_().is_a(glib::types::Type::FLAGS) {
            let flags_value = unsafe {
                glib::gobject_ffi::g_value_get_flags(
                    glib::translate::ToGlibPtr::to_glib_none(value).0 as *const _,
                )
            };
            Value::Number(flags_value as f64)
        } else if value.type_().is_a(glib::types::Type::OBJECT) {
            value
                .get::<Option<glib::Object>>()
                .ok()
                .flatten()
                .map_or(Value::Null, |obj| {
                    Value::Object(ObjectId::new(Object::GObject(obj)))
                })
        } else {
            Value::Null
        }
    }
}

impl From<Value> for Option<glib::Value> {
    fn from(value: Value) -> Self {
        match value {
            Value::Number(n) => Some(n.into()),
            Value::String(s) => Some(s.into()),
            Value::Boolean(b) => Some(b.into()),
            Value::Null | Value::Undefined => None,
            _ => None,
        }
    }
}

use std::{
    ffi::{CString, c_void},
    sync::Arc,
};

use anyhow::bail;
use gtk4::{
    glib,
    glib::translate::{FromGlibPtrFull as _, FromGlibPtrNone as _},
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

        if let Ok(_) = value.downcast::<JsNull, _>(cx) {
            return Ok(Value::Null);
        }

        if let Ok(_) = value.downcast::<JsUndefined, _>(cx) {
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
            let mut vec_values = Vec::with_capacity(values.len());

            for item in values {
                vec_values.push(Self::from_js_value(cx, item)?);
            }

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
            Type::String => {
                let str_ptr = match cif_value {
                    cif::Value::Ptr(ptr) => *ptr,
                    _ => {
                        bail!(
                            "Expected a pointer cif::Value for string, got {:?}",
                            cif_value
                        )
                    }
                };

                let c_str = unsafe { CString::from_raw(str_ptr as *mut i8) };
                let string = c_str.into_string()?;

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

                let boxed = if type_.is_borrowed {
                    let boxed = Boxed::from_glib_none(
                        glib::Type::from_name(&type_.type_).unwrap(),
                        boxed_ptr,
                    );

                    Object::Boxed(boxed)
                } else {
                    let boxed = Boxed::from_glib_full(
                        glib::Type::from_name(&type_.type_).unwrap(),
                        boxed_ptr,
                    );

                    Object::Boxed(boxed)
                };

                Ok(Value::Object(ObjectId::new(boxed)))
            }
            Type::Array(array_type) => {
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
                    Type::String => {
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
                            .map(|id| Value::Object(id.clone()))
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

                let inner_value =
                    ref_ptr
                        .value
                        .downcast_ref::<cif::Value>()
                        .ok_or(anyhow::anyhow!(
                            "Failed to downcast ref inner value to Box<cif::Value>"
                        ))?;

                Value::from_cif_value(inner_value, &type_.inner_type)
            }
            _ => bail!("Unsupported type for cif value conversion: {:?}", type_),
        }
    }
}

impl Value {
    pub fn from_glib_value(gvalue: &glib::Value, type_: &Type) -> Self {
        match type_ {
            Type::Integer(int_type) => match (int_type.size, int_type.sign) {
                (IntegerSize::_8, IntegerSign::Signed) => {
                    Value::Number(gvalue.get::<i8>().unwrap() as f64)
                }
                (IntegerSize::_8, IntegerSign::Unsigned) => {
                    Value::Number(gvalue.get::<u8>().unwrap() as f64)
                }
                (IntegerSize::_32, IntegerSign::Signed) => {
                    Value::Number(gvalue.get::<i32>().unwrap() as f64)
                }
                (IntegerSize::_32, IntegerSign::Unsigned) => {
                    Value::Number(gvalue.get::<u32>().unwrap() as f64)
                }
                (IntegerSize::_64, IntegerSign::Signed) => {
                    Value::Number(gvalue.get::<i64>().unwrap() as f64)
                }
                (IntegerSize::_64, IntegerSign::Unsigned) => {
                    Value::Number(gvalue.get::<u64>().unwrap() as f64)
                }
            },
            Type::Float(float_type) => match float_type.size {
                FloatSize::_32 => Value::Number(gvalue.get::<f32>().unwrap() as f64),
                FloatSize::_64 => Value::Number(gvalue.get::<f64>().unwrap()),
            },
            Type::String => {
                let string: String = gvalue.get().unwrap();
                Value::String(string)
            }
            Type::Boolean => {
                let boolean: bool = gvalue.get().unwrap();
                Value::Boolean(boolean)
            }
            Type::GObject(gobject_type) => {
                let object_ptr = gvalue.as_ptr() as *mut glib::gobject_ffi::GObject;
                let object = if gobject_type.is_borrowed {
                    unsafe { glib::Object::from_glib_none(object_ptr) }
                } else {
                    unsafe { glib::Object::from_glib_full(object_ptr) }
                };
                let object_id = ObjectId::new(Object::GObject(object));
                Value::Object(object_id)
            }
            Type::Boxed(boxed_type) => {
                let boxed_ptr = gvalue.as_ptr();
                let gtype = glib::Type::from_name(&boxed_type.type_).unwrap_or(gvalue.type_());
                let boxed = if boxed_type.is_borrowed {
                    Boxed::from_glib_none(gtype, boxed_ptr as *mut c_void)
                } else {
                    Boxed::from_glib_full(gtype, boxed_ptr as *mut c_void)
                };
                let object_id = ObjectId::new(Object::Boxed(boxed));
                Value::Object(object_id)
            }
            Type::Null | Type::Undefined => Value::Null,
            _ => panic!("Unsupported type for glib value conversion: {:?}", type_),
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
            let boxed = Boxed::from_glib_none(value.type_(), boxed_ptr as *mut c_void);
            let object_id = ObjectId::new(Object::Boxed(boxed));
            Value::Object(object_id)
        } else if value.type_().is_a(glib::types::Type::PARAM_SPEC) {
            let param_spec: glib::ParamSpec = value.get().unwrap();
            Value::String(param_spec.name().to_string())
        } else {
            panic!("Unsupported glib value type: {:?}", value.type_());
        }
    }
}

impl From<Value> for Option<glib::Value> {
    fn from(value: Value) -> Self {
        match value {
            Value::Number(n) => Some(n.into()),
            Value::String(s) => Some(s.into()),
            Value::Boolean(b) => Some(b.into()),
            Value::Null => None,
            Value::Undefined => None,
            _ => panic!("Unsupported Result type for glib::Value conversion"),
        }
    }
}

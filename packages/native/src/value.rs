//! Value types for bridging JavaScript and native GLib/GTK values.
//!
//! This module provides the [`Value`] enum which represents all possible values
//! that can be passed between JavaScript and native code, along with conversion
//! methods for translating between JavaScript, libffi, and GLib value representations.

use std::{
    ffi::{CStr, CString, c_void},
    sync::Arc,
};

use anyhow::bail;

struct GListGuard {
    ptr: *mut glib::ffi::GList,
    should_free: bool,
}

impl GListGuard {
    fn new(ptr: *mut c_void, should_free: bool) -> Self {
        Self {
            ptr: ptr as *mut glib::ffi::GList,
            should_free,
        }
    }
}

impl Drop for GListGuard {
    fn drop(&mut self) {
        if self.should_free && !self.ptr.is_null() {
            unsafe {
                glib::ffi::g_list_free(self.ptr);
            }
        }
    }
}
use gtk4::{
    glib,
    glib::translate::{FromGlibPtrFull as _, FromGlibPtrNone as _, ToGlibPtr as _},
};
use neon::{handle::Root, object::Object as _, prelude::*};

use crate::{
    boxed::Boxed,
    cif,
    gvariant::GVariant as GVariantWrapper,
    object::{Object, ObjectId},
    types::{Callback, FloatSize, IntegerSign, IntegerSize, Type},
};

/// A reference wrapper for out-parameters in FFI calls.
///
/// Holds a boxed value and a reference to the JavaScript object that will be
/// updated with the result after the FFI call completes.
#[derive(Debug, Clone)]
pub struct Ref {
    /// The inner value being referenced.
    pub value: Box<Value>,
    /// Reference to the JavaScript object for updating after FFI call.
    pub js_obj: Arc<Root<JsObject>>,
}

impl Ref {
    /// Creates a new reference wrapper.
    pub fn new(value: Value, js_obj: Arc<Root<JsObject>>) -> Self {
        Ref {
            value: Box::new(value),
            js_obj,
        }
    }

    /// Converts a JavaScript value to a Ref.
    ///
    /// Expects a JavaScript object with a `value` property containing the
    /// inner value to be wrapped.
    ///
    /// # Errors
    ///
    /// Returns a `NeonResult` error if the value cannot be converted.
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

/// Represents a value that can be passed between JavaScript and native code.
///
/// This enum covers all the value types that can cross the FFI boundary:
/// - Primitive types (numbers, strings, booleans)
/// - Null and undefined
/// - Native objects (GObject instances, boxed types)
/// - Arrays of values
/// - Callbacks (JavaScript functions callable from native code)
/// - References (for out-parameters)
#[derive(Debug, Clone)]
pub enum Value {
    /// A numeric value (all JavaScript numbers are f64).
    Number(f64),
    /// A UTF-8 string value.
    String(String),
    /// A boolean value.
    Boolean(bool),
    /// A reference to a native object by its ID.
    Object(ObjectId),
    /// Represents JavaScript null.
    Null,
    /// Represents JavaScript undefined.
    Undefined,
    /// An array of values.
    Array(Vec<Value>),
    /// A JavaScript callback function.
    Callback(Callback),
    /// A reference wrapper for out-parameters.
    Ref(Ref),
}

impl Value {
    /// Converts a JavaScript value to a [`Value`].
    ///
    /// Handles all JavaScript types including numbers, strings, booleans,
    /// null, undefined, arrays, boxed object IDs, functions (callbacks),
    /// and reference objects.
    ///
    /// # Errors
    ///
    /// Returns a `NeonResult` error if the JavaScript value type is not supported.
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

    /// Converts this value to a JavaScript value.
    ///
    /// # Errors
    ///
    /// Returns a `NeonResult` error if the value type cannot be converted to JavaScript
    /// (e.g., Callback or Ref types).
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

    /// Converts a libffi CIF value to a [`Value`] based on the expected type.
    ///
    /// This is used to convert return values and out-parameters from FFI calls
    /// back to JavaScript-compatible values.
    ///
    /// # Errors
    ///
    /// Returns an error if the CIF value doesn't match the expected type or
    /// if the type is not supported for conversion.
    ///
    /// # Safety
    ///
    /// This function performs unsafe pointer operations when reading string,
    /// object, and array data from raw pointers returned by FFI calls.
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

                let c_str = unsafe { CStr::from_ptr(str_ptr as *const i8) };
                let string = c_str.to_str()?.to_string();

                if !string_type.is_borrowed {
                    unsafe {
                        glib::ffi::g_free(str_ptr);
                    }
                }

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

                let gobject_ptr = object_ptr as *mut glib::gobject_ffi::GObject;

                let object = if type_.is_borrowed {
                    let object = unsafe { glib::Object::from_glib_none(gobject_ptr) };
                    Object::GObject(object)
                } else {
                    let is_floating =
                        unsafe { glib::gobject_ffi::g_object_is_floating(gobject_ptr) != 0 };
                    if is_floating {
                        unsafe { glib::gobject_ffi::g_object_ref_sink(gobject_ptr) };
                    }
                    let object = unsafe { glib::Object::from_glib_full(gobject_ptr) };
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
            Type::GVariant(type_) => {
                let variant_ptr = match cif_value {
                    cif::Value::Ptr(ptr) => *ptr,
                    _ => {
                        bail!(
                            "Expected a pointer cif::Value for GVariant, got {:?}",
                            cif_value
                        )
                    }
                };

                if variant_ptr.is_null() {
                    return Ok(Value::Null);
                }

                let variant = if type_.is_borrowed {
                    GVariantWrapper::from_glib_none(variant_ptr)
                } else {
                    GVariantWrapper::from_glib_full(variant_ptr)
                };

                Ok(Value::Object(ObjectId::new(Object::GVariant(variant))))
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

                    let list_guard = GListGuard::new(list_ptr, !array_type.is_borrowed);

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
                                    Value::String(c_str.to_string_lossy().into_owned())
                                }
                            }
                            _ => {
                                bail!("Unsupported GList item type: {:?}", array_type.item_type);
                            }
                        };
                        values.push(item_value);
                        current = unsafe { (*current).next };
                    }

                    drop(list_guard);

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
                                values.push(Value::String(c_str.to_string_lossy().into_owned()));
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
                    Type::GObject(_) | Type::Boxed(_) | Type::GVariant(_) => {
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
                    Type::GVariant(variant_type) => {
                        let actual_ptr = unsafe { *(ref_ptr.ptr as *const *mut c_void) };

                        if actual_ptr.is_null() {
                            return Ok(Value::Null);
                        }

                        let variant = if variant_type.is_borrowed {
                            GVariantWrapper::from_glib_none(actual_ptr)
                        } else {
                            GVariantWrapper::from_glib_full(actual_ptr)
                        };

                        Ok(Value::Object(ObjectId::new(Object::GVariant(variant))))
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
    /// Converts a GLib Value to a [`Value`] based on the expected type.
    ///
    /// This is used to convert callback arguments from GLib signals to
    /// JavaScript-compatible values.
    ///
    /// # Errors
    ///
    /// Returns an error if the GLib value type doesn't match the expected type descriptor,
    /// or if extraction from the GLib value fails.
    pub fn from_glib_value(gvalue: &glib::Value, type_: &Type) -> anyhow::Result<Self> {
        match type_ {
            Type::Integer(int_type) => {
                let gtype = gvalue.type_();
                let is_enum = gtype.is_a(glib::types::Type::ENUM);
                let is_flags = gtype.is_a(glib::types::Type::FLAGS);

                let number = match (int_type.size, int_type.sign) {
                    (IntegerSize::_8, IntegerSign::Signed) => gvalue
                        .get::<i8>()
                        .map_err(|e| anyhow::anyhow!("Failed to get i8 from GValue: {}", e))?
                        as f64,
                    (IntegerSize::_8, IntegerSign::Unsigned) => gvalue
                        .get::<u8>()
                        .map_err(|e| anyhow::anyhow!("Failed to get u8 from GValue: {}", e))?
                        as f64,
                    (IntegerSize::_16, IntegerSign::Signed) => gvalue.get::<i32>().map_err(|e| {
                        anyhow::anyhow!("Failed to get i32 (as i16) from GValue: {}", e)
                    })? as i16
                        as f64,
                    (IntegerSize::_16, IntegerSign::Unsigned) => {
                        gvalue.get::<u32>().map_err(|e| {
                            anyhow::anyhow!("Failed to get u32 (as u16) from GValue: {}", e)
                        })? as u16 as f64
                    }
                    (IntegerSize::_32, IntegerSign::Signed) => {
                        if is_enum {
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
                    (IntegerSize::_32, IntegerSign::Unsigned) => {
                        if is_flags {
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
                    (IntegerSize::_64, IntegerSign::Signed) => gvalue
                        .get::<i64>()
                        .map_err(|e| anyhow::anyhow!("Failed to get i64 from GValue: {}", e))?
                        as f64,
                    (IntegerSize::_64, IntegerSign::Unsigned) => gvalue
                        .get::<u64>()
                        .map_err(|e| anyhow::anyhow!("Failed to get u64 from GValue: {}", e))?
                        as f64,
                };
                Ok(Value::Number(number))
            }
            Type::Float(float_type) => {
                let number = match float_type.size {
                    FloatSize::_32 => gvalue
                        .get::<f32>()
                        .map_err(|e| anyhow::anyhow!("Failed to get f32 from GValue: {}", e))?
                        as f64,
                    FloatSize::_64 => gvalue
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
            Type::GObject(_) => {
                let obj_ptr = unsafe {
                    glib::gobject_ffi::g_value_get_object(gvalue.to_glib_none().0 as *const _)
                };

                if obj_ptr.is_null() {
                    return Ok(Value::Null);
                }

                let type_class = unsafe { (*obj_ptr).g_type_instance.g_class };
                if type_class.is_null() {
                    bail!("GObject has invalid type class (object may have been freed)");
                }

                let obj = unsafe { glib::Object::from_glib_none(obj_ptr) };

                Ok(Value::Object(ObjectId::new(Object::GObject(obj))))
            }
            Type::Boxed(boxed_type) => {
                let gvalue_type = gvalue.type_();

                let boxed_ptr = unsafe {
                    glib::gobject_ffi::g_value_get_boxed(gvalue.to_glib_none().0 as *const _)
                };

                if boxed_ptr.is_null() {
                    return Ok(Value::Null);
                }

                let gtype = boxed_type.get_gtype().or(Some(gvalue_type));

                let boxed = if boxed_type.is_borrowed {
                    Boxed::from_glib_none(gtype, boxed_ptr)
                } else {
                    Boxed::from_glib_full(gtype, boxed_ptr)
                };

                let object_id = ObjectId::new(Object::Boxed(boxed));
                Ok(Value::Object(object_id))
            }
            Type::GVariant(variant_type) => {
                let variant_ptr = unsafe {
                    glib::gobject_ffi::g_value_get_variant(gvalue.to_glib_none().0 as *const _)
                        .cast::<c_void>()
                };

                if variant_ptr.is_null() {
                    return Ok(Value::Null);
                }

                let variant = if variant_type.is_borrowed {
                    GVariantWrapper::from_glib_none(variant_ptr)
                } else {
                    GVariantWrapper::from_glib_full(variant_ptr)
                };

                Ok(Value::Object(ObjectId::new(Object::GVariant(variant))))
            }
            Type::Null | Type::Undefined => Ok(Value::Null),
            Type::Array(_) | Type::Ref(_) | Type::Callback(_) => {
                bail!(
                    "Type {:?} should not appear in glib value conversion - this indicates a bug in the type mapping",
                    type_
                )
            }
        }
    }

    /// Converts this value to a GLib Value, providing defaults for undefined values.
    ///
    /// When the value is `Undefined`, returns a sensible default based on the
    /// expected return type (false for booleans, 0 for integers). This is used
    /// for callback return values where JavaScript may return undefined.
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

impl TryFrom<&glib::Value> for Value {
    type Error = anyhow::Error;

    fn try_from(value: &glib::Value) -> anyhow::Result<Self> {
        if value.is_type(glib::types::Type::I8) {
            Ok(Value::Number(value.get::<i8>()? as f64))
        } else if value.is_type(glib::types::Type::U8) {
            Ok(Value::Number(value.get::<u8>()? as f64))
        } else if value.is_type(glib::types::Type::I32) {
            Ok(Value::Number(value.get::<i32>()? as f64))
        } else if value.is_type(glib::types::Type::U32) {
            Ok(Value::Number(value.get::<u32>()? as f64))
        } else if value.is_type(glib::types::Type::I64) {
            Ok(Value::Number(value.get::<i64>()? as f64))
        } else if value.is_type(glib::types::Type::U64) {
            Ok(Value::Number(value.get::<u64>()? as f64))
        } else if value.is_type(glib::types::Type::F32) {
            Ok(Value::Number(value.get::<f32>()? as f64))
        } else if value.is_type(glib::types::Type::F64) {
            Ok(Value::Number(value.get::<f64>()?))
        } else if value.is_type(glib::types::Type::STRING) {
            Ok(Value::String(value.get::<String>()?))
        } else if value.is_type(glib::types::Type::BOOL) {
            Ok(Value::Boolean(value.get::<bool>()?))
        } else if value.is_type(glib::types::Type::OBJECT) {
            let obj_ptr = unsafe {
                glib::gobject_ffi::g_value_get_object(value.to_glib_none().0 as *const _)
            };

            if obj_ptr.is_null() {
                return Ok(Value::Null);
            }

            let type_class = unsafe { (*obj_ptr).g_type_instance.g_class };
            if type_class.is_null() {
                bail!("GObject has invalid type class (object may have been freed)");
            }

            let obj = unsafe { glib::Object::from_glib_none(obj_ptr) };

            Ok(Value::Object(ObjectId::new(Object::GObject(obj))))
        } else if value.is_type(glib::types::Type::BOXED) {
            let boxed_ptr = unsafe {
                glib::gobject_ffi::g_value_get_boxed(value.to_glib_none().0 as *const _)
            };
            if boxed_ptr.is_null() {
                Ok(Value::Null)
            } else {
                let boxed = Boxed::from_glib_none(Some(value.type_()), boxed_ptr);
                let object_id = ObjectId::new(Object::Boxed(boxed));
                Ok(Value::Object(object_id))
            }
        } else if value.type_().is_a(glib::types::Type::PARAM_SPEC) {
            let ps = value.get::<glib::ParamSpec>()?;
            Ok(Value::String(ps.name().to_string()))
        } else if value.type_().is_a(glib::types::Type::ENUM) {
            let enum_value = unsafe {
                glib::gobject_ffi::g_value_get_enum(
                    glib::translate::ToGlibPtr::to_glib_none(value).0 as *const _,
                )
            };
            Ok(Value::Number(enum_value as f64))
        } else if value.type_().is_a(glib::types::Type::FLAGS) {
            let flags_value = unsafe {
                glib::gobject_ffi::g_value_get_flags(
                    glib::translate::ToGlibPtr::to_glib_none(value).0 as *const _,
                )
            };
            Ok(Value::Number(flags_value as f64))
        } else if value.type_().is_a(glib::types::Type::OBJECT) {
            let obj_ptr = unsafe {
                glib::gobject_ffi::g_value_get_object(value.to_glib_none().0 as *const _)
            };

            if obj_ptr.is_null() {
                return Ok(Value::Null);
            }

            let type_class = unsafe { (*obj_ptr).g_type_instance.g_class };
            if type_class.is_null() {
                bail!("GObject has invalid type class (object may have been freed)");
            }

            let obj = unsafe { glib::Object::from_glib_none(obj_ptr) };

            Ok(Value::Object(ObjectId::new(Object::GObject(obj))))
        } else {
            bail!("Unsupported glib::Value type: {:?}", value.type_())
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_utils;
    use crate::types::{ArrayType, BoxedType, GObjectType, ListType, StringType};
    use gtk4::gdk;
    use gtk4::glib::translate::IntoGlib as _;
    use gtk4::prelude::ObjectType as _;
    use gtk4::prelude::StaticType as _;

    fn get_gobject_refcount(ptr: *mut glib::gobject_ffi::GObject) -> u32 {
        if ptr.is_null() {
            return 0;
        }
        unsafe { (*ptr).ref_count }
    }

    #[test]
    fn gobject_borrowed_does_not_take_ownership() {
        test_utils::ensure_gtk_init();

        let obj = glib::Object::new::<glib::Object>();
        let obj_ptr = obj.as_ptr();

        let initial_ref = get_gobject_refcount(obj_ptr);

        let gobject_type = GObjectType { is_borrowed: true };
        let type_ = Type::GObject(gobject_type);

        let cif_value = cif::Value::Ptr(obj_ptr as *mut c_void);
        let result = Value::from_cif_value(&cif_value, &type_);

        assert!(result.is_ok());

        let after_ref = get_gobject_refcount(obj_ptr);

        assert!(after_ref >= initial_ref);
    }

    #[test]
    fn gobject_full_transfer_takes_ownership() {
        test_utils::ensure_gtk_init();

        let obj = glib::Object::new::<glib::Object>();
        let obj_ptr = obj.as_ptr();

        unsafe {
            glib::gobject_ffi::g_object_ref(obj_ptr);
        }

        let ref_before_transfer = get_gobject_refcount(obj_ptr);

        let gobject_type = GObjectType { is_borrowed: false };
        let type_ = Type::GObject(gobject_type);

        let cif_value = cif::Value::Ptr(obj_ptr as *mut c_void);
        let result = Value::from_cif_value(&cif_value, &type_);

        assert!(result.is_ok());

        let ref_after_transfer = get_gobject_refcount(obj_ptr);

        assert!(ref_after_transfer <= ref_before_transfer);
    }

    #[test]
    fn gobject_null_returns_null_value() {
        test_utils::ensure_gtk_init();

        let gobject_type = GObjectType { is_borrowed: false };
        let type_ = Type::GObject(gobject_type);

        let cif_value = cif::Value::Ptr(std::ptr::null_mut());
        let result = Value::from_cif_value(&cif_value, &type_);

        assert!(result.is_ok());
        assert!(matches!(result.unwrap(), Value::Null));
    }

    #[test]
    fn gobject_floating_ref_gets_sunk() {
        test_utils::ensure_gtk_init();

        let obj = glib::Object::new::<glib::Object>();
        let obj_ptr = obj.as_ptr();

        unsafe {
            glib::gobject_ffi::g_object_ref(obj_ptr);
            glib::gobject_ffi::g_object_force_floating(obj_ptr);
        }

        let is_floating_before = unsafe { glib::gobject_ffi::g_object_is_floating(obj_ptr) != 0 };
        assert!(is_floating_before);

        let gobject_type = GObjectType { is_borrowed: false };
        let type_ = Type::GObject(gobject_type);

        let cif_value = cif::Value::Ptr(obj_ptr as *mut c_void);
        let result = Value::from_cif_value(&cif_value, &type_);

        assert!(result.is_ok());

        let is_floating_after = unsafe { glib::gobject_ffi::g_object_is_floating(obj_ptr) != 0 };
        assert!(!is_floating_after);
    }

    #[test]
    fn string_borrowed_does_not_free() {
        test_utils::ensure_gtk_init();

        let test_string = "test string content";
        let c_string = std::ffi::CString::new(test_string).unwrap();
        let ptr = c_string.as_ptr() as *mut c_void;

        let string_type = StringType { is_borrowed: true };
        let type_ = Type::String(string_type);

        let cif_value = cif::Value::Ptr(ptr);
        let result = Value::from_cif_value(&cif_value, &type_);

        assert!(result.is_ok());
        if let Value::String(s) = result.unwrap() {
            assert_eq!(s, test_string);
        } else {
            panic!("Expected Value::String");
        }

        let still_valid = unsafe { std::ffi::CStr::from_ptr(c_string.as_ptr()) };
        assert_eq!(still_valid.to_str().unwrap(), test_string);
    }

    #[test]
    fn string_full_transfer_frees_memory() {
        test_utils::ensure_gtk_init();

        let test_string = "allocated string";
        let c_string = std::ffi::CString::new(test_string).unwrap();
        let allocated_ptr = unsafe { glib::ffi::g_strdup(c_string.as_ptr()) };

        let string_type = StringType { is_borrowed: false };
        let type_ = Type::String(string_type);

        let cif_value = cif::Value::Ptr(allocated_ptr as *mut c_void);
        let result = Value::from_cif_value(&cif_value, &type_);

        assert!(result.is_ok());
        if let Value::String(s) = result.unwrap() {
            assert_eq!(s, test_string);
        } else {
            panic!("Expected Value::String");
        }
    }

    #[test]
    fn string_null_returns_null_value() {
        test_utils::ensure_gtk_init();

        let string_type = StringType { is_borrowed: false };
        let type_ = Type::String(string_type);

        let cif_value = cif::Value::Ptr(std::ptr::null_mut());
        let result = Value::from_cif_value(&cif_value, &type_);

        assert!(result.is_ok());
        assert!(matches!(result.unwrap(), Value::Null));
    }

    #[test]
    fn boxed_borrowed_creates_copy() {
        test_utils::ensure_gtk_init();

        let gtype = gdk::RGBA::static_type();
        let original_ptr = test_utils::allocate_test_boxed(gtype);

        let boxed_type = BoxedType {
            is_borrowed: true,
            type_: "GdkRGBA".to_string(),
            lib: None,
            get_type_fn: None,
        };
        let type_ = Type::Boxed(boxed_type);

        let cif_value = cif::Value::Ptr(original_ptr);
        let result = Value::from_cif_value(&cif_value, &type_);

        assert!(result.is_ok());

        assert!(test_utils::is_valid_boxed_ptr(original_ptr, gtype));

        unsafe {
            glib::gobject_ffi::g_boxed_free(gtype.into_glib(), original_ptr);
        }
    }

    #[test]
    fn boxed_full_transfer_takes_ownership() {
        test_utils::ensure_gtk_init();

        let gtype = gdk::RGBA::static_type();
        let ptr = test_utils::allocate_test_boxed(gtype);

        let boxed_type = BoxedType {
            is_borrowed: false,
            type_: "GdkRGBA".to_string(),
            lib: None,
            get_type_fn: None,
        };
        let type_ = Type::Boxed(boxed_type);

        let cif_value = cif::Value::Ptr(ptr);
        let result = Value::from_cif_value(&cif_value, &type_);

        assert!(result.is_ok());
    }

    #[test]
    fn boxed_null_returns_null_value() {
        test_utils::ensure_gtk_init();

        let boxed_type = BoxedType {
            is_borrowed: false,
            type_: "GdkRGBA".to_string(),
            lib: None,
            get_type_fn: None,
        };
        let type_ = Type::Boxed(boxed_type);

        let cif_value = cif::Value::Ptr(std::ptr::null_mut());
        let result = Value::from_cif_value(&cif_value, &type_);

        assert!(result.is_ok());
        assert!(matches!(result.unwrap(), Value::Null));
    }

    #[test]
    fn glist_borrowed_does_not_free_list() {
        test_utils::ensure_gtk_init();

        let mut list: *mut glib::ffi::GList = std::ptr::null_mut();

        for _ in 0..3 {
            let obj = glib::Object::new::<glib::Object>();
            unsafe {
                glib::gobject_ffi::g_object_ref(obj.as_ptr());
            }
            list = unsafe { glib::ffi::g_list_append(list, obj.as_ptr() as *mut c_void) };
        }

        let gobject_type = GObjectType { is_borrowed: true };
        let array_type = ArrayType {
            item_type: Box::new(Type::GObject(gobject_type)),
            list_type: ListType::GList,
            is_borrowed: true,
        };
        let type_ = Type::Array(array_type);

        let cif_value = cif::Value::Ptr(list as *mut c_void);
        let result = Value::from_cif_value(&cif_value, &type_);

        assert!(result.is_ok());
        if let Value::Array(arr) = result.unwrap() {
            assert_eq!(arr.len(), 3);
        } else {
            panic!("Expected Value::Array");
        }

        assert!(!list.is_null());

        let mut current = list;
        while !current.is_null() {
            let data = unsafe { (*current).data };
            if !data.is_null() {
                unsafe {
                    glib::gobject_ffi::g_object_unref(data as *mut glib::gobject_ffi::GObject);
                }
            }
            current = unsafe { (*current).next };
        }
        unsafe {
            glib::ffi::g_list_free(list);
        }
    }

    #[test]
    fn glist_full_transfer_frees_list() {
        test_utils::ensure_gtk_init();

        let mut list: *mut glib::ffi::GList = std::ptr::null_mut();

        for _ in 0..3 {
            let obj = glib::Object::new::<glib::Object>();
            unsafe {
                glib::gobject_ffi::g_object_ref(obj.as_ptr());
            }
            list = unsafe { glib::ffi::g_list_append(list, obj.as_ptr() as *mut c_void) };
        }

        let gobject_type = GObjectType { is_borrowed: true };
        let array_type = ArrayType {
            item_type: Box::new(Type::GObject(gobject_type)),
            list_type: ListType::GList,
            is_borrowed: false,
        };
        let type_ = Type::Array(array_type);

        let cif_value = cif::Value::Ptr(list as *mut c_void);
        let result = Value::from_cif_value(&cif_value, &type_);

        assert!(result.is_ok());
        if let Value::Array(arr) = result.unwrap() {
            assert_eq!(arr.len(), 3);
        } else {
            panic!("Expected Value::Array");
        }
    }

    #[test]
    fn glist_null_returns_empty_array() {
        test_utils::ensure_gtk_init();

        let gobject_type = GObjectType { is_borrowed: true };
        let array_type = ArrayType {
            item_type: Box::new(Type::GObject(gobject_type)),
            list_type: ListType::GList,
            is_borrowed: false,
        };
        let type_ = Type::Array(array_type);

        let cif_value = cif::Value::Ptr(std::ptr::null_mut());
        let result = Value::from_cif_value(&cif_value, &type_);

        assert!(result.is_ok());
        if let Value::Array(arr) = result.unwrap() {
            assert!(arr.is_empty());
        } else {
            panic!("Expected Value::Array");
        }
    }

    #[test]
    fn strv_borrowed_does_not_free() {
        test_utils::ensure_gtk_init();

        let strings = vec![
            std::ffi::CString::new("hello").unwrap(),
            std::ffi::CString::new("world").unwrap(),
        ];
        let mut ptrs: Vec<*const i8> = strings.iter().map(|s| s.as_ptr()).collect();
        ptrs.push(std::ptr::null());

        let strv_ptr = ptrs.as_ptr() as *mut c_void;

        let string_type = StringType { is_borrowed: true };
        let array_type = ArrayType {
            item_type: Box::new(Type::String(string_type)),
            list_type: ListType::Array,
            is_borrowed: true,
        };
        let type_ = Type::Array(array_type);

        let cif_value = cif::Value::Ptr(strv_ptr);
        let result = Value::from_cif_value(&cif_value, &type_);

        assert!(result.is_ok());
        if let Value::Array(arr) = result.unwrap() {
            assert_eq!(arr.len(), 2);
            if let Value::String(s) = &arr[0] {
                assert_eq!(s, "hello");
            }
            if let Value::String(s) = &arr[1] {
                assert_eq!(s, "world");
            }
        } else {
            panic!("Expected Value::Array");
        }

        assert_eq!(
            unsafe { std::ffi::CStr::from_ptr(strings[0].as_ptr()) }
                .to_str()
                .unwrap(),
            "hello"
        );
    }

    #[test]
    fn strv_full_transfer_frees_strings() {
        test_utils::ensure_gtk_init();

        let s1 = unsafe { glib::ffi::g_strdup("hello\0".as_ptr() as *const i8) };
        let s2 = unsafe { glib::ffi::g_strdup("world\0".as_ptr() as *const i8) };

        let strv = unsafe {
            let ptr = glib::ffi::g_malloc(3 * std::mem::size_of::<*mut i8>()) as *mut *mut i8;
            *ptr = s1;
            *ptr.add(1) = s2;
            *ptr.add(2) = std::ptr::null_mut();
            ptr
        };

        let string_type = StringType { is_borrowed: false };
        let array_type = ArrayType {
            item_type: Box::new(Type::String(string_type)),
            list_type: ListType::Array,
            is_borrowed: false,
        };
        let type_ = Type::Array(array_type);

        let cif_value = cif::Value::Ptr(strv as *mut c_void);
        let result = Value::from_cif_value(&cif_value, &type_);

        assert!(result.is_ok());
        if let Value::Array(arr) = result.unwrap() {
            assert_eq!(arr.len(), 2);
        } else {
            panic!("Expected Value::Array");
        }
    }

    #[test]
    fn from_glib_value_gobject_borrowed() {
        test_utils::ensure_gtk_init();

        let obj = glib::Object::new::<glib::Object>();
        let obj_ptr = obj.as_ptr();
        let initial_ref = get_gobject_refcount(obj_ptr);

        let gvalue: glib::Value = obj.clone().into();

        let gobject_type = GObjectType { is_borrowed: true };
        let type_ = Type::GObject(gobject_type);

        let result = Value::from_glib_value(&gvalue, &type_);

        assert!(result.is_ok());

        let after_ref = get_gobject_refcount(obj_ptr);
        assert!(after_ref >= initial_ref);
    }

    #[test]
    fn from_glib_value_string() {
        test_utils::ensure_gtk_init();

        let test_string = "test value";
        let gvalue: glib::Value = test_string.into();

        let string_type = StringType { is_borrowed: true };
        let type_ = Type::String(string_type);

        let result = Value::from_glib_value(&gvalue, &type_);

        assert!(result.is_ok());
        if let Value::String(s) = result.unwrap() {
            assert_eq!(s, test_string);
        } else {
            panic!("Expected Value::String");
        }
    }

    #[test]
    fn from_glib_value_boolean() {
        test_utils::ensure_gtk_init();

        let gvalue_true: glib::Value = true.into();
        let gvalue_false: glib::Value = false.into();

        let type_ = Type::Boolean;

        let result_true = Value::from_glib_value(&gvalue_true, &type_);
        let result_false = Value::from_glib_value(&gvalue_false, &type_);

        assert!(result_true.is_ok());
        assert!(result_false.is_ok());

        assert!(matches!(result_true.unwrap(), Value::Boolean(true)));
        assert!(matches!(result_false.unwrap(), Value::Boolean(false)));
    }

    #[test]
    fn from_glib_value_integers() {
        test_utils::ensure_gtk_init();

        let gvalue_i32: glib::Value = 42i32.into();

        let int_type = crate::types::IntegerType {
            size: crate::types::IntegerSize::_32,
            sign: crate::types::IntegerSign::Signed,
        };
        let type_ = Type::Integer(int_type);

        let result = Value::from_glib_value(&gvalue_i32, &type_);

        assert!(result.is_ok());
        if let Value::Number(n) = result.unwrap() {
            assert_eq!(n, 42.0);
        } else {
            panic!("Expected Value::Number");
        }
    }

    #[test]
    fn from_glib_value_floats() {
        test_utils::ensure_gtk_init();

        let gvalue_f64: glib::Value = 3.14159f64.into();

        let float_type = crate::types::FloatType {
            size: crate::types::FloatSize::_64,
        };
        let type_ = Type::Float(float_type);

        let result = Value::from_glib_value(&gvalue_f64, &type_);

        assert!(result.is_ok());
        if let Value::Number(n) = result.unwrap() {
            assert!((n - 3.14159).abs() < 0.0001);
        } else {
            panic!("Expected Value::Number");
        }
    }
}

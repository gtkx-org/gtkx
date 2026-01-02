use std::ffi::{CStr, CString, c_void};

use anyhow::bail;
use gtk4::glib::{self, translate::FromGlibPtrFull as _, translate::FromGlibPtrNone as _};

use super::helpers::{GListGuard, cif_to_number, extract_ptr_from_cif, glist_item_to_value};
use super::Value;
use crate::{
    boxed::Boxed,
    cif,
    integer,
    object::{Object, ObjectId},
    types::*,
    variant::GVariant as GVariantWrapper,
};

fn from_cif_glist(
    cif_value: &cif::Value,
    array_type: &ArrayType,
) -> anyhow::Result<Value> {
    let list_ptr = extract_ptr_from_cif(cif_value, "GList/GSList")?;
    if list_ptr.is_null() {
        return Ok(Value::Array(vec![]));
    }

    let list_guard = GListGuard::new(list_ptr, array_type.is_transfer_full);

    let mut values = Vec::new();
    let mut current = list_ptr as *mut glib::ffi::GList;

    while !current.is_null() {
        let data = unsafe { (*current).data };
        let item_value = glist_item_to_value(data, &array_type.item_type)?;
        values.push(item_value);
        current = unsafe { (*current).next };
    }

    drop(list_guard);
    Ok(Value::Array(values))
}

fn from_cif_null_terminated_string_array(
    ptr: *mut c_void,
    is_transfer_full: bool,
) -> anyhow::Result<Value> {
    let mut values = Vec::new();
    let str_array = ptr as *const *const i8;
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

    if is_transfer_full {
        unsafe { glib::ffi::g_strfreev(ptr as *mut *mut i8) };
    }

    Ok(Value::Array(values))
}

fn from_cif_owned_array(
    array_ptr: &cif::OwnedPtr,
    array_type: &ArrayType,
) -> anyhow::Result<Value> {
    let values = match &*array_type.item_type {
        Type::Integer(int_type) => {
            let f64_vec = integer::vec_to_f64(int_type, array_ptr)?;
            f64_vec.into_iter().map(Value::Number).collect()
        }
        Type::Float(float_type) => match float_type.size {
            FloatSize::_32 => {
                let f32_vec = array_ptr
                    .value
                    .downcast_ref::<Vec<f32>>()
                    .ok_or(anyhow::anyhow!("Failed to downcast array items to Vec<f32>"))?;
                f32_vec.iter().map(|v| Value::Number(*v as f64)).collect()
            }
            FloatSize::_64 => {
                let f64_vec = array_ptr
                    .value
                    .downcast_ref::<Vec<f64>>()
                    .ok_or(anyhow::anyhow!("Failed to downcast array items to Vec<f64>"))?;
                f64_vec.iter().map(|v| Value::Number(*v)).collect()
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
            bool_vec.iter().map(|v| Value::Boolean(*v != 0)).collect()
        }
        Type::GObject(_) | Type::Boxed(_) | Type::Struct(_) | Type::GVariant(_) => {
            let (ids, _) = array_ptr
                .value
                .downcast_ref::<(Vec<ObjectId>, Vec<*mut c_void>)>()
                .ok_or(anyhow::anyhow!(
                    "Failed to downcast array items to Vec<ObjectId> tuple"
                ))?;
            ids.iter().map(|id| Value::Object(*id)).collect()
        }
        _ => bail!(
            "Unsupported array item type for cif value conversion: {:?}",
            array_type.item_type
        ),
    };

    Ok(Value::Array(values))
}

fn from_cif_ref(
    cif_value: &cif::Value,
    ref_type: &RefType,
) -> anyhow::Result<Value> {
    let ref_ptr = match cif_value {
        cif::Value::OwnedPtr(ptr) => ptr,
        _ => bail!("Expected an owned pointer cif::Value for Ref, got {:?}", cif_value),
    };

    match &*ref_type.inner_type {
        Type::GObject(gobject_type) => {
            let actual_ptr = unsafe { *(ref_ptr.ptr as *const *mut c_void) };
            if actual_ptr.is_null() {
                return Ok(Value::Null);
            }
            let object = if !gobject_type.is_transfer_full {
                unsafe { glib::Object::from_glib_none(actual_ptr as *mut glib::gobject_ffi::GObject) }
            } else {
                unsafe { glib::Object::from_glib_full(actual_ptr as *mut glib::gobject_ffi::GObject) }
            };
            Ok(Value::Object(Object::GObject(object).into()))
        }
        Type::Boxed(boxed_type) => {
            let actual_ptr = unsafe { *(ref_ptr.ptr as *const *mut c_void) };
            if actual_ptr.is_null() {
                return Ok(Value::Null);
            }
            let gtype = boxed_type.get_gtype();
            let boxed = if !boxed_type.is_transfer_full {
                Boxed::from_glib_none(gtype, actual_ptr)
            } else {
                Boxed::from_glib_full(gtype, actual_ptr)
            };
            Ok(Value::Object(Object::Boxed(boxed).into()))
        }
        Type::GVariant(variant_type) => {
            let actual_ptr = unsafe { *(ref_ptr.ptr as *const *mut c_void) };
            if actual_ptr.is_null() {
                return Ok(Value::Null);
            }
            let variant = if !variant_type.is_transfer_full {
                GVariantWrapper::from_glib_none(actual_ptr)
            } else {
                GVariantWrapper::from_glib_full(actual_ptr)
            };
            Ok(Value::Object(Object::GVariant(variant).into()))
        }
        Type::Integer(int_type) => {
            let number = integer::read(int_type, ref_ptr.ptr as *const u8);
            Ok(Value::Number(number))
        }
        Type::Float(float_type) => {
            let number = match float_type.size {
                FloatSize::_32 => unsafe { *(ref_ptr.ptr as *const f32) as f64 },
                FloatSize::_64 => unsafe { *(ref_ptr.ptr as *const f64) },
            };
            Ok(Value::Number(number))
        }
        Type::String(string_type) => from_cif_ref_string(ref_ptr, string_type),
        _ => bail!("Unsupported ref inner type for reading: {:?}", ref_type.inner_type),
    }
}

fn from_cif_ref_string(
    ref_ptr: &cif::OwnedPtr,
    string_type: &StringType,
) -> anyhow::Result<Value> {
    if ref_ptr.ptr.is_null() {
        return Ok(Value::Null);
    }

    if ref_ptr.value.downcast_ref::<Vec<u8>>().is_some() {
        let c_str = unsafe { CStr::from_ptr(ref_ptr.ptr as *const i8) };
        let string = c_str.to_str()?.to_string();
        Ok(Value::String(string))
    } else {
        let str_ptr = unsafe { *(ref_ptr.ptr as *const *const i8) };
        if str_ptr.is_null() {
            return Ok(Value::Null);
        }
        let c_str = unsafe { CStr::from_ptr(str_ptr) };
        let string = c_str.to_str()?.to_string();

        if string_type.is_transfer_full {
            unsafe { glib::ffi::g_free(str_ptr as *mut c_void) };
        }

        Ok(Value::String(string))
    }
}

impl Value {
    pub fn from_cif_value(cif_value: &cif::Value, type_: &Type) -> anyhow::Result<Self> {
        match type_ {
            Type::Null => Ok(Value::Null),
            Type::Undefined => Ok(Value::Undefined),
            Type::Integer(_) | Type::Float(_) => Ok(Value::Number(cif_to_number(cif_value)?)),
            Type::String(string_type) => {
                let str_ptr = extract_ptr_from_cif(cif_value, "string")?;
                if str_ptr.is_null() {
                    return Ok(Value::Null);
                }

                let c_str = unsafe { CStr::from_ptr(str_ptr as *const i8) };
                let string = c_str.to_str()?.to_string();

                if string_type.is_transfer_full {
                    unsafe { glib::ffi::g_free(str_ptr) };
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
                let object_ptr = extract_ptr_from_cif(cif_value, "GObject")?;
                if object_ptr.is_null() {
                    return Ok(Value::Null);
                }

                let gobject_ptr = object_ptr as *mut glib::gobject_ffi::GObject;

                let object = if !type_.is_transfer_full {
                    Object::GObject(unsafe { glib::Object::from_glib_none(gobject_ptr) })
                } else {
                    let is_floating =
                        unsafe { glib::gobject_ffi::g_object_is_floating(gobject_ptr) != 0 };
                    if is_floating {
                        unsafe { glib::gobject_ffi::g_object_ref_sink(gobject_ptr) };
                    }
                    Object::GObject(unsafe { glib::Object::from_glib_full(gobject_ptr) })
                };

                Ok(Value::Object(object.into()))
            }
            Type::Boxed(type_) => {
                let boxed_ptr = extract_ptr_from_cif(cif_value, "Boxed")?;
                if boxed_ptr.is_null() {
                    return Ok(Value::Null);
                }

                let gtype = type_.get_gtype();
                let boxed = if !type_.is_transfer_full {
                    Object::Boxed(Boxed::from_glib_none_with_size(
                        gtype,
                        boxed_ptr,
                        None,
                        Some(&type_.type_),
                    ))
                } else {
                    Object::Boxed(Boxed::from_glib_full(gtype, boxed_ptr))
                };

                Ok(Value::Object(boxed.into()))
            }
            Type::Struct(type_) => {
                let struct_ptr = extract_ptr_from_cif(cif_value, "Struct")?;
                if struct_ptr.is_null() {
                    return Ok(Value::Null);
                }

                let boxed = if !type_.is_transfer_full {
                    Boxed::from_glib_none_with_size(None, struct_ptr, type_.size, Some(&type_.type_))
                } else {
                    Boxed::from_glib_full(None, struct_ptr)
                };

                Ok(Value::Object(Object::Boxed(boxed).into()))
            }
            Type::GVariant(type_) => {
                let variant_ptr = extract_ptr_from_cif(cif_value, "GVariant")?;
                if variant_ptr.is_null() {
                    return Ok(Value::Null);
                }

                let variant = if !type_.is_transfer_full {
                    GVariantWrapper::from_glib_none(variant_ptr)
                } else {
                    GVariantWrapper::from_glib_full(variant_ptr)
                };

                Ok(Value::Object(Object::GVariant(variant).into()))
            }
            Type::Array(array_type) => {
                if array_type.list_type == ListType::GList
                    || array_type.list_type == ListType::GSList
                {
                    return from_cif_glist(cif_value, array_type);
                }

                if let cif::Value::Ptr(ptr) = cif_value {
                    if ptr.is_null() {
                        return Ok(Value::Array(vec![]));
                    }

                    if matches!(&*array_type.item_type, Type::String(_)) {
                        return from_cif_null_terminated_string_array(
                            *ptr,
                            array_type.is_transfer_full,
                        );
                    }

                    bail!(
                        "Unsupported null-terminated array item type: {:?}",
                        array_type.item_type
                    );
                }

                let array_ptr = match cif_value {
                    cif::Value::OwnedPtr(ptr) => ptr,
                    _ => bail!(
                        "Expected an owned pointer cif::Value for Array, got {:?}",
                        cif_value
                    ),
                };

                from_cif_owned_array(array_ptr, array_type)
            }
            Type::Ref(type_) => from_cif_ref(cif_value, type_),
            _ => bail!("Unsupported type for cif value conversion: {:?}", type_),
        }
    }
}

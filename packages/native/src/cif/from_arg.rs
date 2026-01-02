use std::ffi::{CString, c_void};

use anyhow::bail;
use gtk4::glib::{self, translate::IntoGlib as _};

use super::array::try_from_array;
use super::callback::try_from_callback;
use super::helpers::extract_object_ptr;
use super::owned_ptr::OwnedPtr;
use super::r#ref::try_from_ref;
use super::Value;
use crate::{arg::Arg, types::*, value};

impl TryFrom<Arg> for Value {
    type Error = anyhow::Error;

    fn try_from(arg: Arg) -> anyhow::Result<Value> {
        match &arg.type_ {
            Type::Integer(int_type) => {
                let number = match arg.value {
                    value::Value::Number(n) => n,
                    value::Value::Null | value::Value::Undefined if arg.optional => 0.0,
                    _ => bail!("Expected a Number for integer type, got {:?}", arg.value),
                };

                Ok(crate::integer::to_cif(int_type, number))
            }
            Type::Float(type_) => {
                let number = match arg.value {
                    value::Value::Number(n) => n,
                    _ => bail!("Expected a Number for float type, got {:?}", arg.value),
                };

                match type_.size {
                    FloatSize::_32 => Ok(Value::F32(number as f32)),
                    FloatSize::_64 => Ok(Value::F64(number)),
                }
            }
            Type::String(_) => match &arg.value {
                value::Value::String(s) => {
                    let cstring = CString::new(s.as_bytes())?;
                    let ptr = cstring.as_ptr() as *mut c_void;
                    Ok(Value::OwnedPtr(OwnedPtr::new(cstring, ptr)))
                }
                value::Value::Null | value::Value::Undefined => {
                    Ok(Value::Ptr(std::ptr::null_mut()))
                }
                _ => bail!("Expected a String for string type, got {:?}", arg.value),
            },
            Type::Boolean => {
                let boolean = match arg.value {
                    value::Value::Boolean(b) => b,
                    _ => bail!("Expected a Boolean for boolean type, got {:?}", arg.value),
                };

                Ok(Value::U8(u8::from(boolean)))
            }
            Type::Null => Ok(Value::Ptr(std::ptr::null_mut())),
            Type::Undefined => Ok(Value::Ptr(std::ptr::null_mut())),
            Type::GObject(type_) => {
                let ptr = extract_object_ptr(&arg.value, "GObject")?;

                if type_.is_transfer_full && !ptr.is_null() {
                    unsafe { glib::gobject_ffi::g_object_ref(ptr as *mut _) };
                }

                Ok(Value::Ptr(ptr))
            }
            Type::GParam(type_) => {
                let ptr = extract_object_ptr(&arg.value, "GParamSpec")?;

                if type_.is_transfer_full && !ptr.is_null() {
                    unsafe { glib::gobject_ffi::g_param_spec_ref(ptr as *mut _) };
                }

                Ok(Value::Ptr(ptr))
            }
            Type::Boxed(type_) => {
                let ptr = extract_object_ptr(&arg.value, "Boxed object")?;

                if type_.is_transfer_full && !ptr.is_null() && type_.get_gtype().is_some() {
                    let gtype = type_.get_gtype().unwrap();
                    let copied = unsafe {
                        glib::gobject_ffi::g_boxed_copy(gtype.into_glib(), ptr as *const _)
                    };
                    return Ok(Value::Ptr(copied));
                }

                Ok(Value::Ptr(ptr))
            }
            Type::Struct(_) => {
                let ptr = extract_object_ptr(&arg.value, "Struct object")?;
                Ok(Value::Ptr(ptr))
            }
            Type::GVariant(type_) => {
                let ptr = extract_object_ptr(&arg.value, "GVariant")?;

                if type_.is_transfer_full && !ptr.is_null() {
                    unsafe { glib::ffi::g_variant_ref(ptr as *mut glib::ffi::GVariant) };
                }

                Ok(Value::Ptr(ptr))
            }
            Type::Array(type_) => match &arg.value {
                value::Value::Null | value::Value::Undefined if arg.optional => {
                    Ok(Value::Ptr(std::ptr::null_mut()))
                }
                _ => try_from_array(&arg, type_),
            },
            Type::Callback(type_) => try_from_callback(&arg, type_),
            Type::Ref(type_) => try_from_ref(&arg, type_),
        }
    }
}

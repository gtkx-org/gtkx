use std::ffi::{CString, c_void};

use anyhow::bail;

use super::owned_ptr::OwnedPtr;
use super::Value;
use crate::{arg, types::*, value};

pub(super) fn try_from_array(arg: &arg::Arg, type_: &ArrayType) -> anyhow::Result<Value> {
    let array = match &arg.value {
        value::Value::Array(arr) => arr,
        _ => bail!("Expected an Array for array type, got {:?}", arg.value),
    };

    match *type_.item_type {
        Type::Integer(ref int_type) => {
            let mut values = Vec::new();

            for value in array {
                match value {
                    value::Value::Number(n) => values.push(*n),
                    _ => bail!("Expected a Number for integer item type, got {:?}", value),
                }
            }

            Ok(Value::OwnedPtr(crate::integer::f64_to_vec(int_type, &values)))
        }
        Type::Float(ref float_type) => {
            let mut values = Vec::new();

            for value in array {
                match value {
                    value::Value::Number(n) => values.push(n),
                    _ => bail!("Expected a Number for float item type, got {:?}", value),
                }
            }

            match float_type.size {
                FloatSize::_32 => {
                    let values: Vec<f32> = values.iter().map(|&v| *v as f32).collect();
                    Ok(Value::OwnedPtr(OwnedPtr::from_vec(values)))
                }
                FloatSize::_64 => {
                    let values: Vec<f64> = values.iter().map(|&v| *v).collect();
                    Ok(Value::OwnedPtr(OwnedPtr::from_vec(values)))
                }
            }
        }
        Type::String(_) => {
            let mut cstrings = Vec::new();

            for v in array {
                match v {
                    value::Value::String(s) => {
                        cstrings.push(CString::new(s.as_bytes())?);
                    }
                    _ => bail!("Expected a String for string item type, got {:?}", v),
                }
            }

            let mut ptrs: Vec<*mut c_void> =
                cstrings.iter().map(|s| s.as_ptr() as *mut c_void).collect();

            ptrs.push(std::ptr::null_mut());

            let ptr = ptrs.as_ptr() as *mut c_void;

            Ok(Value::OwnedPtr(OwnedPtr::new((cstrings, ptrs), ptr)))
        }
        Type::GObject(_) | Type::Boxed(_) | Type::Struct(_) | Type::GVariant(_) => {
            let mut ids = Vec::new();

            for value in array {
                match value {
                    value::Value::Object(id) => ids.push(*id),
                    _ => bail!("Expected an Object for gobject item type, got {:?}", value),
                }
            }

            let mut ptrs: Vec<*mut c_void> = Vec::with_capacity(ids.len());
            for id in &ids {
                match id.as_ptr() {
                    Some(ptr) => ptrs.push(ptr),
                    None => bail!("GObject in array has been garbage collected"),
                }
            }
            let ptr = ptrs.as_ptr() as *mut c_void;

            Ok(Value::OwnedPtr(OwnedPtr::new((ids, ptrs), ptr)))
        }
        Type::Boolean => {
            let mut values = Vec::new();

            for value in array {
                match value {
                    value::Value::Boolean(b) => values.push(u8::from(*b)),
                    _ => bail!("Expected a Boolean for boolean item type, got {:?}", value),
                }
            }

            Ok(Value::OwnedPtr(OwnedPtr::from_vec(values)))
        }
        _ => bail!("Unsupported array item type: {:?}", type_.item_type),
    }
}

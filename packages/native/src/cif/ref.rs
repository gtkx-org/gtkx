use std::ffi::c_void;

use anyhow::bail;

use super::owned_ptr::OwnedPtr;
use super::Value;
use crate::{arg::Arg, types::*, value};

pub(super) fn try_from_ref(arg: &Arg, type_: &RefType) -> anyhow::Result<Value> {
    let r#ref = match &arg.value {
        value::Value::Ref(r#ref) => r#ref,
        value::Value::Null | value::Value::Undefined => {
            return Ok(Value::Ptr(std::ptr::null_mut()));
        }
        _ => bail!("Expected a Ref for ref type, got {:?}", arg.value),
    };

    match &*type_.inner_type {
        Type::Boxed(_) | Type::Struct(_) | Type::GObject(_) | Type::GVariant(_) => {
            match &*r#ref.value {
                value::Value::Object(id) => {
                    let ptr = id.as_ptr().ok_or_else(|| {
                        anyhow::anyhow!("Ref object has been garbage collected")
                    })?;
                    Ok(Value::Ptr(ptr))
                }
                value::Value::Null | value::Value::Undefined => {
                    let ptr_storage: Box<*mut c_void> = Box::new(std::ptr::null_mut());
                    let ptr = ptr_storage.as_ref() as *const *mut c_void as *mut c_void;
                    Ok(Value::OwnedPtr(OwnedPtr {
                        ptr,
                        value: ptr_storage,
                    }))
                }
                _ => bail!(
                    "Expected an Object or Null for Ref<Boxed/GObject>, got {:?}",
                    r#ref.value
                ),
            }
        }
        Type::String(string_type) => {
            let (buffer_size, initial_content) = match (&string_type.length, &*r#ref.value) {
                (Some(len), value::Value::String(s)) => (*len, Some(s.as_bytes())),
                (Some(len), value::Value::Null | value::Value::Undefined) => (*len, None),
                (None, value::Value::String(s)) => (s.len() + 1, Some(s.as_bytes())),
                (None, value::Value::Null | value::Value::Undefined) => {
                    let ptr_storage: Box<*mut c_void> = Box::new(std::ptr::null_mut());
                    let ptr = ptr_storage.as_ref() as *const *mut c_void as *mut c_void;
                    return Ok(Value::OwnedPtr(OwnedPtr {
                        ptr,
                        value: ptr_storage,
                    }));
                }
                _ => bail!(
                    "Expected a String, Null, or length for Ref<String>, got {:?}",
                    r#ref.value
                ),
            };

            let mut buffer: Vec<u8> = vec![0u8; buffer_size];

            if let Some(content) = initial_content {
                let copy_len = content.len().min(buffer_size.saturating_sub(1));
                buffer[..copy_len].copy_from_slice(&content[..copy_len]);
            }

            let ptr = buffer.as_mut_ptr() as *mut c_void;

            Ok(Value::OwnedPtr(OwnedPtr {
                ptr,
                value: Box::new(buffer),
            }))
        }
        _ => {
            let ref_arg = Arg::new(*type_.inner_type.clone(), *r#ref.value.clone());
            let ref_value = Box::new(Value::try_from(ref_arg)?);
            let ref_ptr = ref_value.as_ptr();

            Ok(Value::OwnedPtr(OwnedPtr {
                value: ref_value,
                ptr: ref_ptr,
            }))
        }
    }
}

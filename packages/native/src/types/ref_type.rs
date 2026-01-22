use std::ffi::{CStr, c_char, c_void};

use anyhow::bail;
use gtk4::glib::{self, translate::FromGlibPtrFull as _, translate::FromGlibPtrNone as _};
use libffi::middle as libffi;
use neon::object::Object as _;
use neon::prelude::*;

use crate::arg::Arg;
use crate::ffi::{FfiStorage, FfiStorageKind};
use crate::managed::{Boxed, Fundamental, NativeValue};
use crate::{ffi, types::Type, value};

#[derive(Debug, Clone)]
pub struct RefType {
    pub inner_type: Box<Type>,
}

impl RefType {
    pub fn new(inner_type: Type) -> Self {
        RefType {
            inner_type: Box::new(inner_type),
        }
    }

    pub fn from_js_value(cx: &mut FunctionContext, value: Handle<JsValue>) -> NeonResult<Self> {
        let obj = value.downcast::<JsObject, _>(cx).or_throw(cx)?;
        let inner_type_value: Handle<'_, JsValue> = obj.prop(cx, "innerType").get()?;
        let inner_type = Type::from_js_value(cx, inner_type_value)?;

        Ok(Self::new(inner_type))
    }
}

impl From<&RefType> for libffi::Type {
    fn from(_: &RefType) -> Self {
        libffi::Type::pointer()
    }
}

impl ffi::FfiEncode for RefType {
    fn encode(&self, val: &value::Value, _optional: bool) -> anyhow::Result<ffi::FfiValue> {
        let ref_val = match val {
            value::Value::Ref(r) => r,
            value::Value::Null | value::Value::Undefined => {
                return Ok(ffi::FfiValue::Ptr(std::ptr::null_mut()));
            }
            _ => bail!("Expected a Ref for ref type, got {:?}", val),
        };

        match &*self.inner_type {
            Type::Boxed(_) | Type::Struct(_) | Type::GObject(_) | Type::Fundamental(_) => {
                match &*ref_val.value {
                    value::Value::Null | value::Value::Undefined => {
                        let ptr_storage: Box<*mut c_void> = Box::new(std::ptr::null_mut());
                        let ptr = ptr_storage.as_ref() as *const *mut c_void as *mut c_void;
                        Ok(ffi::FfiValue::Storage(FfiStorage::new(
                            ptr,
                            FfiStorageKind::PtrStorage(ptr_storage),
                        )))
                    }
                    _ => bail!(
                        "Expected Null for Ref<Boxed/Struct/GObject/Fundamental>, got {:?}",
                        ref_val.value
                    ),
                }
            }
            Type::Array(array_type) => match &*ref_val.value {
                value::Value::Array(arr) if !arr.is_empty() => {
                    let encoded = array_type.encode(&ref_val.value, false)?;
                    match encoded {
                        ffi::FfiValue::Storage(storage) => Ok(ffi::FfiValue::Storage(storage)),
                        _ => bail!("Expected Storage from array encode for Ref<Array>"),
                    }
                }
                value::Value::Null | value::Value::Undefined | value::Value::Array(_) => {
                    let ptr_storage: Box<*mut c_void> = Box::new(std::ptr::null_mut());
                    let ptr = ptr_storage.as_ref() as *const *mut c_void as *mut c_void;
                    Ok(ffi::FfiValue::Storage(FfiStorage::new(
                        ptr,
                        FfiStorageKind::PtrStorage(ptr_storage),
                    )))
                }
                _ => bail!(
                    "Expected Array, Null, or Undefined for Ref<Array>, got {:?}",
                    ref_val.value
                ),
            },
            Type::String(string_type) => {
                let (buffer_size, initial_content) = match (&string_type.length, &*ref_val.value) {
                    (Some(len), value::Value::String(s)) => (*len, Some(s.as_bytes())),
                    (Some(len), value::Value::Null | value::Value::Undefined) => (*len, None),
                    (None, value::Value::String(s)) => (s.len() + 1, Some(s.as_bytes())),
                    (None, value::Value::Null | value::Value::Undefined) => {
                        let ptr_storage: Box<*mut c_void> = Box::new(std::ptr::null_mut());
                        let ptr = ptr_storage.as_ref() as *const *mut c_void as *mut c_void;
                        return Ok(ffi::FfiValue::Storage(FfiStorage::new(
                            ptr,
                            FfiStorageKind::PtrStorage(ptr_storage),
                        )));
                    }
                    _ => bail!(
                        "Expected a String, Null, or length for Ref<String>, got {:?}",
                        ref_val.value
                    ),
                };

                let mut buffer: Vec<u8> = vec![0u8; buffer_size];

                if let Some(content) = initial_content {
                    let copy_len = content.len().min(buffer_size.saturating_sub(1));
                    buffer[..copy_len].copy_from_slice(&content[..copy_len]);
                }

                let ptr = buffer.as_mut_ptr() as *mut c_void;
                Ok(ffi::FfiValue::Storage(FfiStorage::new(
                    ptr,
                    FfiStorageKind::Buffer(buffer),
                )))
            }
            _ => {
                let ref_arg = Arg::new(*self.inner_type.clone(), *ref_val.value.clone());
                let ref_value = Box::new(ffi::FfiValue::try_from(ref_arg)?);
                let ref_ptr = ref_value.as_raw_ptr();

                Ok(ffi::FfiValue::Storage(FfiStorage::new(
                    ref_ptr,
                    FfiStorageKind::BoxedValue(ref_value),
                )))
            }
        }
    }
}

impl ffi::FfiDecode for RefType {
    fn decode(&self, ffi_value: &ffi::FfiValue) -> anyhow::Result<value::Value> {
        let storage = match ffi_value {
            ffi::FfiValue::Storage(s) => s,
            ffi::FfiValue::Ptr(ptr) if ptr.is_null() => return Ok(value::Value::Null),
            _ => bail!(
                "Expected a Storage ffi::FfiValue for Ref, got {:?}",
                ffi_value
            ),
        };

        match &*self.inner_type {
            Type::GObject(gobject_type) => {
                // SAFETY: storage.ptr() points to a pointer-to-GObject allocated by encode
                let actual_ptr = unsafe { *(storage.ptr() as *const *mut c_void) };
                if actual_ptr.is_null() {
                    return Ok(value::Value::Null);
                }
                let object = if gobject_type.ownership.is_full() {
                    unsafe {
                        glib::Object::from_glib_full(actual_ptr as *mut glib::gobject_ffi::GObject)
                    }
                } else {
                    unsafe {
                        glib::Object::from_glib_none(actual_ptr as *mut glib::gobject_ffi::GObject)
                    }
                };
                Ok(value::Value::Object(NativeValue::GObject(object).into()))
            }
            Type::Boxed(boxed_type) => {
                // SAFETY: storage.ptr() points to a pointer-to-boxed allocated by encode
                let actual_ptr = unsafe { *(storage.ptr() as *const *mut c_void) };
                if actual_ptr.is_null() {
                    return Ok(value::Value::Null);
                }
                let gtype = boxed_type.gtype();
                let boxed = if boxed_type.ownership.is_full() {
                    Boxed::from_glib_full(gtype, actual_ptr)
                } else {
                    Boxed::from_glib_none(gtype, actual_ptr)?
                };
                Ok(value::Value::Object(NativeValue::Boxed(boxed).into()))
            }
            Type::Fundamental(fundamental_type) => {
                // SAFETY: storage.ptr() points to a pointer-to-fundamental allocated by encode
                let actual_ptr = unsafe { *(storage.ptr() as *const *mut c_void) };
                if actual_ptr.is_null() {
                    return Ok(value::Value::Null);
                }

                let (ref_fn, unref_fn) = fundamental_type.lookup_fns()?;
                let fundamental = if fundamental_type.ownership.is_full() {
                    Fundamental::from_glib_full(actual_ptr, ref_fn, unref_fn)
                } else {
                    Fundamental::from_glib_none(actual_ptr, ref_fn, unref_fn)
                };
                Ok(value::Value::Object(
                    NativeValue::Fundamental(fundamental).into(),
                ))
            }
            Type::Integer(int_type) => {
                let number = int_type.kind.read_ptr(storage.ptr() as *const u8);
                Ok(value::Value::Number(number))
            }
            Type::Float(float_kind) => {
                let number = float_kind.read_ptr(storage.ptr() as *const u8);
                Ok(value::Value::Number(number))
            }
            Type::String(string_type) => self.decode_ref_string(storage, string_type),
            Type::Array(_) => {
                bail!("Ref<Array> requires decode_with_context to get size from another parameter")
            }
            _ => bail!(
                "Unsupported ref inner type for reading: {:?}",
                self.inner_type
            ),
        }
    }

    fn decode_with_context(
        &self,
        ffi_value: &ffi::FfiValue,
        ffi_args: &[ffi::FfiValue],
        args: &[Arg],
    ) -> anyhow::Result<value::Value> {
        if let Type::Array(array_type) = &*self.inner_type {
            let storage = match ffi_value {
                ffi::FfiValue::Storage(s) => s,
                ffi::FfiValue::Ptr(ptr) if ptr.is_null() => return Ok(value::Value::Null),
                _ => bail!(
                    "Expected a Storage ffi::FfiValue for Ref<Array>, got {:?}",
                    ffi_value
                ),
            };

            let actual_ptr = match storage.kind() {
                FfiStorageKind::PtrStorage(_) => {
                    unsafe { *(storage.ptr() as *const *mut c_void) }
                }
                _ => storage.ptr(),
            };

            if actual_ptr.is_null() {
                return Ok(value::Value::Array(vec![]));
            }

            let ptr_ffi_value = ffi::FfiValue::Ptr(actual_ptr);
            let result = array_type.decode_with_context(&ptr_ffi_value, ffi_args, args)?;

            if matches!(storage.kind(), FfiStorageKind::PtrStorage(_)) && array_type.ownership.is_full() {
                unsafe { glib::ffi::g_free(actual_ptr) };
            }

            return Ok(result);
        }

        self.decode(ffi_value)
    }
}

impl RefType {
    fn decode_ref_string(
        &self,
        storage: &FfiStorage,
        string_type: &super::StringType,
    ) -> anyhow::Result<value::Value> {
        if storage.ptr().is_null() {
            return Ok(value::Value::Null);
        }

        match storage.kind() {
            FfiStorageKind::Buffer(_) => {
                // SAFETY: storage.ptr() points to a null-terminated C string in our buffer
                let c_str = unsafe { CStr::from_ptr(storage.ptr() as *const c_char) };
                let string = c_str.to_str()?.to_string();
                Ok(value::Value::String(string))
            }
            _ => {
                // SAFETY: storage.ptr() points to a pointer-to-string
                let str_ptr = unsafe { *(storage.ptr() as *const *const c_char) };
                if str_ptr.is_null() {
                    return Ok(value::Value::Null);
                }
                let c_str = unsafe { CStr::from_ptr(str_ptr) };
                let string = c_str.to_str()?.to_string();

                if string_type.ownership.is_full() {
                    // SAFETY: str_ptr was allocated by GLib and we have owned ownership
                    unsafe { glib::ffi::g_free(str_ptr as *mut c_void) };
                }

                Ok(value::Value::String(string))
            }
        }
    }
}

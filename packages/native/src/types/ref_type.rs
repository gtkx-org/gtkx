use std::ffi::{CStr, c_char};

use anyhow::bail;
use gtk4::glib;
use napi::bindgen_prelude::*;
use napi::{Env, JsObject};

use super::prelude::*;
use crate::arg::Arg;
use crate::ffi::{FfiStorage, FfiStorageKind};
use crate::types::{ArrayKind, Type};

#[derive(Debug, Clone)]
pub struct RefType {
    pub inner_type: Box<Type>,
}

impl RefType {
    #[must_use]
    pub fn new(inner_type: Type) -> Self {
        Self {
            inner_type: Box::new(inner_type),
        }
    }

    #[cfg_attr(coverage_nightly, coverage(off))]
    pub fn from_js_value(env: &Env, obj: &JsObject) -> napi::Result<Self> {
        let inner_type_value: Unknown<'_> = obj.get_named_property("innerType")?;
        let inner_type = Type::from_js_value(env, inner_type_value)?;

        Ok(Self::new(inner_type))
    }
}

impl FfiEncoder for RefType {
    #[cfg_attr(coverage_nightly, coverage(off))]
    fn encode(&self, val: &value::Value, _optional: bool) -> anyhow::Result<ffi::FfiValue> {
        let ref_val = match val {
            value::Value::Ref(r) => r,
            value::Value::Null | value::Value::Undefined => {
                return Ok(ffi::FfiValue::Ptr(std::ptr::null_mut()));
            }
            _ => bail!("Expected a Ref for ref type, got {val:?}"),
        };

        match &*self.inner_type {
            Type::Boxed(_) | Type::Struct(_) | Type::GObject(_) | Type::Fundamental(_) => {
                match &*ref_val.value {
                    value::Value::Null | value::Value::Undefined => Ok(Self::null_ptr_storage()),
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
                    Ok(Self::null_ptr_storage())
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
                        return Ok(Self::null_ptr_storage());
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

    arg_only_call_cif!("Ref types");
}

/// Extracts the [`FfiStorage`] backing a `Ref` decode.
///
/// Returns `None` for the null-pointer fast path so the caller can short
/// circuit to [`value::Value::Null`]. `kind` (e.g. `"Ref"` or `"Ref<Array>"`)
/// names the expected shape in the bail message when the variant is unexpected.
fn ref_storage_or_null<'a>(
    ffi_value: &'a ffi::FfiValue,
    kind: &str,
) -> anyhow::Result<Option<&'a FfiStorage>> {
    match ffi_value {
        ffi::FfiValue::Storage(s) => Ok(Some(s)),
        ffi::FfiValue::Ptr(ptr) if ptr.is_null() => Ok(None),
        _ => bail!("Expected a Storage ffi::FfiValue for {kind}, got {ffi_value:?}"),
    }
}

impl FfiDecoder for RefType {
    fn decode(&self, ffi_value: &ffi::FfiValue) -> anyhow::Result<value::Value> {
        let Some(storage) = ref_storage_or_null(ffi_value, "Ref")? else {
            return Ok(value::Value::Null);
        };

        match &*self.inner_type {
            Type::GObject(_) | Type::Boxed(_) | Type::Fundamental(_) | Type::Struct(_) => {
                let actual_ptr = unsafe { *(storage.ptr() as *const *mut c_void) };
                self.inner_type.decode(&ffi::FfiValue::Ptr(actual_ptr))
            }
            Type::Integer(int_type) => {
                let number = int_type.read_ptr(storage.ptr() as *const u8);
                Ok(value::Value::Number(number))
            }
            Type::Tagged(tagged) => {
                let number = tagged.storage.read_ptr(storage.ptr() as *const u8);
                Ok(value::Value::Number(number))
            }
            Type::Float(float_kind) => {
                let number = float_kind.read_ptr(storage.ptr() as *const u8);
                Ok(value::Value::Number(number))
            }
            Type::String(string_type) => Ok(Self::decode_ref_string(storage, string_type)),
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
        Self::decode_with_context(self, ffi_value, ffi_args, args)
    }
}

impl RawPtrCodec for RefType {
    fn read_from_raw_ptr(
        &self,
        ptr: *const c_void,
        _context: &str,
    ) -> anyhow::Result<value::Value> {
        let inner_ptr = unsafe { *(ptr as *const *mut c_void) };
        if inner_ptr.is_null() {
            return Ok(value::Value::Null);
        }
        self.inner_type.read_from_raw_ptr(inner_ptr, "ref inner")
    }
}

impl RefType {
    pub fn decode_with_context(
        &self,
        ffi_value: &ffi::FfiValue,
        ffi_args: &[ffi::FfiValue],
        args: &[Arg],
    ) -> anyhow::Result<value::Value> {
        if let Type::Array(array_type) = &*self.inner_type {
            let Some(storage) = ref_storage_or_null(ffi_value, "Ref<Array>")? else {
                return Ok(value::Value::Null);
            };

            let actual_ptr = match storage.kind() {
                FfiStorageKind::PtrStorage(_) => unsafe { *(storage.ptr() as *const *mut c_void) },
                _ => storage.ptr(),
            };

            if actual_ptr.is_null() {
                return Ok(value::Value::Array(vec![]));
            }

            let ptr_ffi_value = ffi::FfiValue::Ptr(actual_ptr);
            let result = array_type.decode_with_context(&ptr_ffi_value, ffi_args, args)?;

            if matches!(storage.kind(), FfiStorageKind::PtrStorage(_))
                && array_type.ownership.is_full()
            {
                let freed_by_decode =
                    matches!(array_type.kind, ArrayKind::GList | ArrayKind::GSList)
                        || (array_type.kind == ArrayKind::Array
                            && matches!(&*array_type.item_type, Type::String(_)));

                if !freed_by_decode {
                    unsafe { glib::ffi::g_free(actual_ptr) };
                }
            }

            return Ok(result);
        }

        self.decode(ffi_value)
    }

    /// Builds an [`ffi::FfiValue::Storage`] holding a heap-allocated null
    /// pointer, the out-parameter slot a native callee writes a result pointer
    /// into.
    #[cfg_attr(coverage_nightly, coverage(off))]
    fn null_ptr_storage() -> ffi::FfiValue {
        let ptr_storage: Box<*mut c_void> = Box::new(std::ptr::null_mut());
        let ptr = ptr_storage.as_ref() as *const *mut c_void as *mut c_void;
        ffi::FfiValue::Storage(FfiStorage::new(
            ptr,
            FfiStorageKind::PtrStorage(ptr_storage),
        ))
    }

    fn decode_ref_string(storage: &FfiStorage, string_type: &super::StringType) -> value::Value {
        if storage.ptr().is_null() {
            return value::Value::Null;
        }

        if let FfiStorageKind::Buffer(_) = storage.kind() {
            let c_str = unsafe { CStr::from_ptr(storage.ptr() as *const c_char) };
            let string = c_str.to_string_lossy().into_owned();
            value::Value::String(string)
        } else {
            let str_ptr = unsafe { *(storage.ptr() as *const *const c_char) };
            if str_ptr.is_null() {
                return value::Value::Null;
            }
            let c_str = unsafe { CStr::from_ptr(str_ptr) };
            let string = c_str.to_string_lossy().into_owned();

            if string_type.ownership.is_full() {
                unsafe { glib::ffi::g_free(str_ptr as *mut c_void) };
            }

            value::Value::String(string)
        }
    }
}

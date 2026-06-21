use std::ffi::c_char;

use anyhow::bail;
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

    #[must_use]
    pub fn supports_inner(inner: &Type) -> bool {
        !matches!(
            inner,
            Type::HashTable(_) | Type::Callback(_) | Type::Void(_) | Type::Blob(_) | Type::Ref(_)
        )
    }
}

impl FromDescriptor for RefType {
    #[cfg_attr(coverage_nightly, coverage(off))]
    fn from_descriptor(env: &Env, obj: &JsObject) -> napi::Result<Self> {
        let inner_type_value: Unknown<'_> = obj.get_named_property("innerType")?;
        let inner_type = Type::from_js_value(env, inner_type_value)?;

        if !Self::supports_inner(&inner_type) {
            return Err(napi::Error::new(
                napi::Status::InvalidArg,
                format!("'{inner_type}' cannot be used as a Ref inner type"),
            ));
        }

        Ok(Self::new(inner_type))
    }
}

impl FfiEncoder for RefType {
    #[cfg_attr(coverage_nightly, coverage(off))]
    fn encode(&self, val: &value::Value) -> anyhow::Result<ffi::FfiValue> {
        anyhow::ensure!(
            Self::supports_inner(&self.inner_type),
            "'{}' cannot be used as a Ref inner type",
            self.inner_type
        );

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
                    let encoded = array_type.encode(&ref_val.value)?;
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
            _ => match &*ref_val.value {
                value::Value::Null | value::Value::Undefined => Ok(Self::zeroed_scalar_slot()),
                _ => {
                    let ref_arg = Arg::new(*self.inner_type.clone(), *ref_val.value.clone());
                    let encoded = ffi::FfiValue::try_from(ref_arg)?;
                    Self::scalar_out_slot(&encoded)
                }
            },
        }
    }

    arg_only_call_cif!("Ref types");
}

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
    unsafe fn read(&self, src: ReadSource<'_>) -> anyhow::Result<value::Value> {
        let storage = match src {
            ReadSource::Call(ffi_value) => {
                let Some(storage) = ref_storage_or_null(ffi_value, "Ref")? else {
                    return Ok(value::Value::Null);
                };
                storage
            }
            ReadSource::Slot(ptr, _context) => {
                // SAFETY: per the `ReadSource::Slot` contract `ptr` addresses a pointer-sized slot;
                // dereferencing it yields the inner pointer the ref points at.
                let inner_ptr = unsafe { *(ptr as *const *mut c_void) };
                if inner_ptr.is_null() {
                    return Ok(value::Value::Null);
                }
                // SAFETY: `inner_ptr` is the non-null pointee read above, a valid slot for the
                // inner type to read from.
                return unsafe {
                    self.inner_type
                        .read(ReadSource::Slot(inner_ptr, "ref inner"))
                };
            }
            ReadSource::Value(..) => bail!("This type cannot be read from pointer"),
        };

        match &*self.inner_type {
            Type::GObject(_) | Type::Boxed(_) | Type::Fundamental(_) | Type::Struct(_) => {
                // SAFETY: for pointer inner types the out-slot `storage.ptr()` holds a pointer to
                // the produced value; dereferencing it loads that pointer for the inner decoder.
                let actual_ptr = unsafe { *(storage.ptr() as *const *mut c_void) };
                self.inner_type.decode(&ffi::FfiValue::Ptr(actual_ptr))
            }
            Type::Integer(int_type) => {
                // SAFETY: `storage.ptr()` is the scalar out-slot sized for this integer kind;
                // `read_ptr` reads the integer that was written into it by the callee.
                let number = unsafe { int_type.read_ptr(storage.ptr() as *const u8) };
                Ok(value::Value::Number(number))
            }
            Type::Tagged(tagged) => {
                // SAFETY: `storage.ptr()` is the scalar out-slot sized for the tagged enum/flags
                // backing integer; `read_ptr` reads that integer.
                let number = unsafe { tagged.storage.read_ptr(storage.ptr() as *const u8) };
                Ok(value::Value::Number(number))
            }
            Type::Float(float_kind) => {
                // SAFETY: `storage.ptr()` is the scalar out-slot sized for this float kind;
                // `read_ptr` reads the float that was written into it.
                let number = unsafe { float_kind.read_ptr(storage.ptr() as *const u8) };
                Ok(value::Value::Number(number))
            }
            // SAFETY: `storage.ptr()` is the boolean out-slot the callee wrote; the inner boolean
            // codec reads it as a pointer slot.
            Type::Boolean(boolean) => unsafe {
                boolean.read(ReadSource::Slot(storage.ptr(), "Ref<Boolean>"))
            },
            // SAFETY: `storage.ptr()` is the unichar out-slot the callee wrote; the inner unichar
            // codec reads it as a pointer slot.
            Type::Unichar(unichar) => unsafe {
                unichar.read(ReadSource::Slot(storage.ptr(), "Ref<Unichar>"))
            },
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
        if let Type::Array(array_type) = &*self.inner_type {
            let Some(storage) = ref_storage_or_null(ffi_value, "Ref<Array>")? else {
                return Ok(value::Value::Null);
            };

            let actual_ptr = match storage.kind() {
                // SAFETY: a `PtrStorage` out-slot holds a pointer to the produced array; the slot
                // is pointer-sized, so dereferencing it loads that array pointer.
                FfiStorageKind::PtrStorage(_) => unsafe { *(storage.ptr() as *const *mut c_void) },
                _ => storage.ptr(),
            };

            if actual_ptr.is_null() {
                return Ok(value::Value::Array(vec![]));
            }

            let ptr_ffi_value = ffi::FfiValue::Ptr(actual_ptr);
            let result = array_type.decode_with_context(&ptr_ffi_value, ffi_args, args);

            if matches!(storage.kind(), FfiStorageKind::PtrStorage(_))
                && array_type.ownership.is_full()
                && matches!(
                    &array_type.kind,
                    ArrayKind::Sized { .. } | ArrayKind::Fixed { .. }
                )
            {
                // SAFETY: full ownership of a sized/fixed array written through a `PtrStorage`
                // out-parameter means the callee allocated `actual_ptr` with `g_malloc`; the
                // elements were copied out during decode, so freeing the buffer once is correct.
                unsafe { glib::ffi::g_free(actual_ptr) };
            }

            return result;
        }

        self.decode(ffi_value)
    }
}

impl RawPtrCodec for RefType {}

impl RefType {
    #[cfg_attr(coverage_nightly, coverage(off))]
    fn null_ptr_storage() -> ffi::FfiValue {
        let mut slot: Vec<*mut c_void> = vec![std::ptr::null_mut()];
        let ptr = slot.as_mut_ptr() as *mut c_void;
        ffi::FfiValue::Storage(FfiStorage::new(ptr, FfiStorageKind::PtrStorage(slot)))
    }

    fn scalar_out_slot(encoded: &ffi::FfiValue) -> anyhow::Result<ffi::FfiValue> {
        let storage = FfiStorage::from(vec![0u64]);
        // SAFETY: `storage` owns an 8-byte `u64` buffer, large enough for any scalar payload of
        // `encoded`; `write_scalar_to` writes that payload into the slot.
        unsafe { encoded.write_scalar_to(storage.ptr())? };
        Ok(ffi::FfiValue::Storage(storage))
    }

    fn zeroed_scalar_slot() -> ffi::FfiValue {
        ffi::FfiValue::Storage(FfiStorage::from(vec![0u64]))
    }

    fn decode_ref_string(storage: &FfiStorage, string_type: &super::StringType) -> value::Value {
        if storage.ptr().is_null() {
            return value::Value::Null;
        }

        if let FfiStorageKind::Buffer(_) = storage.kind() {
            // SAFETY: a `Buffer` out-slot is the NUL-terminated byte buffer the callee filled in
            // place; `from_ptr_lossy` reads it up to the terminator as a string.
            let string =
                unsafe { glib::GStr::from_ptr_lossy(storage.ptr() as *const c_char) }.to_string();
            value::Value::String(string)
        } else {
            // SAFETY: a non-buffer string out-slot is pointer-sized and holds the callee's
            // `char*`; dereferencing it loads that pointer (checked for null below).
            let str_ptr = unsafe { *(storage.ptr() as *const *const c_char) };
            if str_ptr.is_null() {
                return value::Value::Null;
            }
            // SAFETY: `str_ptr` is the non-null NUL-terminated C string written by the callee;
            // `from_ptr_lossy` reads it up to the terminator.
            let string = unsafe { glib::GStr::from_ptr_lossy(str_ptr) }.to_string();

            if string_type.ownership.is_full() {
                // SAFETY: full ownership means the callee transferred the `g_malloc`-allocated
                // string to us; after copying it out, freeing `str_ptr` once releases it.
                unsafe { glib::ffi::g_free(str_ptr as *mut c_void) };
            }

            value::Value::String(string)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{FloatKind, IntegerKind};

    fn slot_storage(encoded: &ffi::FfiValue) -> &FfiStorage {
        ref_storage_or_null(encoded, "scalar out slot")
            .expect("scalar out slot should be a Storage value")
            .expect("scalar out slot should be non-null")
    }

    #[test]
    fn scalar_out_slot_seeds_integer_payload() {
        let slot = RefType::scalar_out_slot(&ffi::FfiValue::I32(7))
            .expect("i32 payload should produce a slot");
        let storage = slot_storage(&slot);
        // SAFETY: `storage.ptr()` is the 8-byte scalar slot seeded with an i32 above; `read_ptr`
        // reads it back as an i32.
        let seeded = unsafe { IntegerKind::I32.read_ptr(storage.ptr() as *const u8) };
        assert_eq!(seeded, 7.0);
    }

    #[test]
    fn scalar_out_slot_seeds_float_payload() {
        let slot = RefType::scalar_out_slot(&ffi::FfiValue::F64(1.5))
            .expect("f64 payload should produce a slot");
        let storage = slot_storage(&slot);
        // SAFETY: `storage.ptr()` is the 8-byte scalar slot seeded with an f64 above; `read_ptr`
        // reads it back as an f64.
        let seeded = unsafe { FloatKind::F64.read_ptr(storage.ptr() as *const u8) };
        assert_eq!(seeded, 1.5);
    }

    #[test]
    fn zeroed_scalar_slot_is_zero_initialized() {
        let slot = RefType::zeroed_scalar_slot();
        let storage = slot_storage(&slot);
        // SAFETY: `storage.ptr()` is the zero-initialized 8-byte scalar slot; `read_ptr` reads it
        // back as an i32 (expected to be zero).
        let seeded = unsafe { IntegerKind::I32.read_ptr(storage.ptr() as *const u8) };
        assert_eq!(seeded, 0.0);
    }
}

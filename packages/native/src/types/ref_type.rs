use std::ffi::c_char;

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

        if !Self::supports_inner(&inner_type) {
            return Err(napi::Error::new(
                napi::Status::InvalidArg,
                format!("'{inner_type}' cannot be used as a Ref inner type"),
            ));
        }

        Ok(Self::new(inner_type))
    }

    /// Whether `inner` describes a shape `Ref` can carry as an out-parameter.
    ///
    /// `HashTable`, `Trampoline`, `Void`, `Blob`, and nested `Ref` have no
    /// out-parameter slot representation: a hash table encodes to its payload
    /// pointer (not a writable slot), a trampoline encodes to multiple libffi
    /// arguments, a blob is an argument-only raw memory window with no
    /// decodable result, and void/nested refs describe no storable value.
    /// Both the descriptor-parsing boundary and [`FfiEncoder::encode`]
    /// consult this so a malformed descriptor surfaces as a precise error
    /// instead of corrupting memory.
    #[must_use]
    pub fn supports_inner(inner: &Type) -> bool {
        !matches!(
            inner,
            Type::HashTable(_) | Type::Trampoline(_) | Type::Void(_) | Type::Blob(_) | Type::Ref(_)
        )
    }
}

impl FfiEncoder for RefType {
    #[cfg_attr(coverage_nightly, coverage(off))]
    fn encode(&self, val: &value::Value, _optional: bool) -> anyhow::Result<ffi::FfiValue> {
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
                let encoded = ffi::FfiValue::try_from(ref_arg)?;
                Self::scalar_out_slot(&encoded)
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
                // SAFETY: The storage is the live out-parameter slot this
                // encode allocated, holding the pointer the callee wrote.
                let actual_ptr = unsafe { *(storage.ptr() as *const *mut c_void) };
                self.inner_type.decode(&ffi::FfiValue::Ptr(actual_ptr))
            }
            Type::Integer(int_type) => {
                // SAFETY: The storage is the live, aligned scalar out slot
                // this encode allocated.
                let number = unsafe { int_type.read_ptr(storage.ptr() as *const u8) };
                Ok(value::Value::Number(number))
            }
            Type::Tagged(tagged) => {
                // SAFETY: The storage is the live, aligned scalar out slot
                // this encode allocated.
                let number = unsafe { tagged.storage.read_ptr(storage.ptr() as *const u8) };
                Ok(value::Value::Number(number))
            }
            Type::Float(float_kind) => {
                // SAFETY: The storage is the live, aligned scalar out slot
                // this encode allocated.
                let number = unsafe { float_kind.read_ptr(storage.ptr() as *const u8) };
                Ok(value::Value::Number(number))
            }
            // SAFETY: The storage is the live, aligned scalar out slot this
            // encode allocated.
            Type::Boolean(boolean) => unsafe {
                boolean.read_from_raw_ptr(storage.ptr(), "Ref<Boolean>")
            },
            // SAFETY: The storage is the live, aligned scalar out slot this
            // encode allocated.
            Type::Unichar(unichar) => unsafe {
                unichar.read_from_raw_ptr(storage.ptr(), "Ref<Unichar>")
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
        Self::decode_with_context(self, ffi_value, ffi_args, args)
    }
}

impl RawPtrCodec for RefType {
    unsafe fn read_from_raw_ptr(
        &self,
        ptr: *const c_void,
        _context: &str,
    ) -> anyhow::Result<value::Value> {
        // SAFETY: The caller guarantees `ptr` is a readable pointer-sized
        // slot.
        let inner_ptr = unsafe { *(ptr as *const *mut c_void) };
        if inner_ptr.is_null() {
            return Ok(value::Value::Null);
        }
        // SAFETY: The non-null dereferenced pointer is the ref's target
        // slot, valid for the inner codec's read per the caller's contract.
        unsafe { self.inner_type.read_from_raw_ptr(inner_ptr, "ref inner") }
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
                // SAFETY: A PtrStorage is the live out-parameter slot this
                // encode allocated, holding the pointer the callee wrote.
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
                // SAFETY: A transfer-full sized/fixed array out-parameter
                // hands this decode the one owned buffer, released here
                // exactly once after copying.
                unsafe { glib::ffi::g_free(actual_ptr) };
            }

            return result;
        }

        self.decode(ffi_value)
    }

    /// Builds an [`ffi::FfiValue::Storage`] holding a heap-allocated null
    /// pointer, the out-parameter slot a native callee writes a result pointer
    /// into. The slot address is derived mutably so the callee's write carries
    /// valid provenance.
    #[cfg_attr(coverage_nightly, coverage(off))]
    fn null_ptr_storage() -> ffi::FfiValue {
        let mut slot: Vec<*mut c_void> = vec![std::ptr::null_mut()];
        let ptr = slot.as_mut_ptr() as *mut c_void;
        ffi::FfiValue::Storage(FfiStorage::new(ptr, FfiStorageKind::PtrStorage(slot)))
    }

    /// Builds an aligned, writable out-parameter slot seeded with the scalar
    /// payload of `encoded` — the slot a native callee writes a scalar
    /// out-parameter through. The backing allocation is a `Vec<u64>`, giving
    /// every scalar width an aligned home and a write-capable pointer.
    fn scalar_out_slot(encoded: &ffi::FfiValue) -> anyhow::Result<ffi::FfiValue> {
        let storage = FfiStorage::from(vec![0u64]);
        // SAFETY: The storage is a live, aligned 8-byte slot, wide enough
        // for every scalar payload.
        unsafe { encoded.write_scalar_to(storage.ptr())? };
        Ok(ffi::FfiValue::Storage(storage))
    }

    fn decode_ref_string(storage: &FfiStorage, string_type: &super::StringType) -> value::Value {
        if storage.ptr().is_null() {
            return value::Value::Null;
        }

        if let FfiStorageKind::Buffer(_) = storage.kind() {
            // SAFETY: The buffer is the live, NUL-initialized scratch
            // allocation this encode created for the callee to fill.
            let string =
                unsafe { glib::GStr::from_ptr_lossy(storage.ptr() as *const c_char) }.to_string();
            value::Value::String(string)
        } else {
            // SAFETY: The storage is the live out-parameter slot this
            // encode allocated, holding the pointer the callee wrote.
            let str_ptr = unsafe { *(storage.ptr() as *const *const c_char) };
            if str_ptr.is_null() {
                return value::Value::Null;
            }
            // SAFETY: A non-null string out-parameter is a live
            // NUL-terminated C string.
            let string = unsafe { glib::GStr::from_ptr_lossy(str_ptr) }.to_string();

            if string_type.ownership.is_full() {
                // SAFETY: A transfer-full out-parameter hands this decode
                // the one owned allocation, released here exactly once
                // after copying.
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
        // SAFETY: The slot's storage is a live, aligned 8-byte allocation,
        // wide enough for an i32 read.
        let seeded = unsafe { IntegerKind::I32.read_ptr(storage.ptr() as *const u8) };
        assert_eq!(seeded, 7.0);
    }

    #[test]
    fn scalar_out_slot_seeds_float_payload() {
        let slot = RefType::scalar_out_slot(&ffi::FfiValue::F64(1.5))
            .expect("f64 payload should produce a slot");
        let storage = slot_storage(&slot);
        // SAFETY: The slot's storage is a live, aligned 8-byte allocation,
        // wide enough for an f64 read.
        let seeded = unsafe { FloatKind::F64.read_ptr(storage.ptr() as *const u8) };
        assert_eq!(seeded, 1.5);
    }

    #[test]
    fn scalar_out_slot_rejects_payload_less_value() {
        let error = RefType::scalar_out_slot(&ffi::FfiValue::Ptr(std::ptr::null_mut()))
            .expect_err("a pointer value has no scalar payload");
        assert!(error.to_string().contains("has no scalar payload"));
    }
}

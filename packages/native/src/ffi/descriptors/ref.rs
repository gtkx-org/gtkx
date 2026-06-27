use std::ffi::c_char;

use anyhow::bail;
use napi::bindgen_prelude::*;
use napi::{Env, JsObject};

use super::prelude::*;
use crate::ffi::arg::Arg;
use crate::ffi::descriptors::{ArrayKind, Descriptor};
use crate::ffi::{Stash, StashKind};

#[derive(Debug, Clone)]
pub struct RefDescriptor {
    pub inner_type: Box<Descriptor>,
}

impl RefDescriptor {
    pub fn new(inner_type: Descriptor) -> napi::Result<Self> {
        if !Self::supports_inner(&inner_type) {
            return Err(napi::Error::new(
                napi::Status::InvalidArg,
                format!("'{inner_type}' cannot be used as a Ref inner type"),
            ));
        }
        Ok(Self {
            inner_type: Box::new(inner_type),
        })
    }

    #[must_use]
    pub fn supports_inner(inner: &Descriptor) -> bool {
        !matches!(
            inner,
            Descriptor::HashTable(_)
                | Descriptor::Callback(_)
                | Descriptor::Void(_)
                | Descriptor::Buffer(_)
                | Descriptor::Ref(_)
        )
    }

    #[allow(clippy::trivially_copy_pass_by_ref)]
    #[cfg_attr(coverage_nightly, coverage(off))]
    pub(crate) fn from_descriptor(env: &Env, obj: &JsObject) -> napi::Result<Self> {
        let inner_type_value: Unknown<'_> = obj.get_named_property("innerType")?;
        let inner_type = Descriptor::from_descriptor(env, inner_type_value)?;
        Self::new(inner_type)
    }
}

impl FfiEncoder for RefDescriptor {
    #[cfg_attr(coverage_nightly, coverage(off))]
    fn encode(&self, val: &value::Value) -> anyhow::Result<ffi::StashedValue> {
        let ref_val = match val {
            value::Value::Ref(r) => r,
            value::Value::Null | value::Value::Undefined => {
                return Ok(ffi::StashedValue::Ptr(std::ptr::null_mut()));
            }
            _ => bail!("Expected a Ref for ref type, got {val:?}"),
        };

        match &*self.inner_type {
            Descriptor::Boxed(_)
            | Descriptor::Struct(_)
            | Descriptor::GObject(_)
            | Descriptor::Fundamental(_) => match &*ref_val.value {
                value::Value::Null | value::Value::Undefined => Ok(Self::null_ptr_storage()),
                _ => bail!(
                    "Expected Null for Ref<Boxed/Struct/GObject/Fundamental>, got {:?}",
                    ref_val.value
                ),
            },
            Descriptor::Array(array_type) => match &*ref_val.value {
                value::Value::Array(arr) if !arr.is_empty() => {
                    let encoded = array_type.encode(&ref_val.value)?;
                    match encoded {
                        ffi::StashedValue::Storage(storage) => {
                            Ok(ffi::StashedValue::Storage(storage))
                        }
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
            Descriptor::String(string_type) => {
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
                Ok(ffi::StashedValue::Storage(Stash::new(
                    ptr,
                    StashKind::Buffer(buffer),
                )))
            }
            _ => match &*ref_val.value {
                value::Value::Null | value::Value::Undefined => Ok(Self::zeroed_scalar_slot()),
                _ => {
                    let ref_arg = Arg::new(*self.inner_type.clone(), *ref_val.value.clone());
                    let encoded = ffi::StashedValue::try_from(ref_arg)?;
                    Self::scalar_out_slot(&encoded)
                }
            },
        }
    }

    arg_only_call_cif!("Ref types");
}

fn ref_storage_or_null<'a>(
    stashed_value: &'a ffi::StashedValue,
    kind: &str,
) -> anyhow::Result<Option<&'a Stash>> {
    match stashed_value {
        ffi::StashedValue::Storage(s) => Ok(Some(s)),
        ffi::StashedValue::Ptr(ptr) if ptr.is_null() => Ok(None),
        _ => bail!("Expected a Storage ffi::StashedValue for {kind}, got {stashed_value:?}"),
    }
}

impl FfiDecoder for RefDescriptor {
    unsafe fn read(&self, src: ReadSource<'_>) -> anyhow::Result<value::Value> {
        let storage = match src {
            ReadSource::Call(stashed_value) => {
                let Some(storage) = ref_storage_or_null(stashed_value, "Ref")? else {
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
            Descriptor::GObject(_)
            | Descriptor::Boxed(_)
            | Descriptor::Fundamental(_)
            | Descriptor::Struct(_) => {
                // SAFETY: for pointer inner types the out-slot `storage.ptr()` holds a pointer to
                // the produced value; dereferencing it loads that pointer for the inner decoder.
                let actual_ptr = unsafe { *(storage.ptr() as *const *mut c_void) };
                self.inner_type.decode(&ffi::StashedValue::Ptr(actual_ptr))
            }
            // SAFETY: `storage.ptr()` is the scalar out-slot the callee wrote; the inner integer
            // codec reads it as a pointer slot, range-checking for lossless f64 conversion.
            Descriptor::Integer(_) => unsafe {
                self.inner_type
                    .read(ReadSource::Slot(storage.ptr(), "Ref<Integer>"))
            },
            // SAFETY: `storage.ptr()` is the scalar out-slot the callee wrote; the inner enum/flags
            // codec reads it as a pointer slot.
            Descriptor::EnumFlags(_) => unsafe {
                self.inner_type
                    .read(ReadSource::Slot(storage.ptr(), "Ref<EnumFlags>"))
            },
            // SAFETY: `storage.ptr()` is the scalar out-slot the callee wrote; the inner float codec
            // reads it as a pointer slot.
            Descriptor::Float(_) => unsafe {
                self.inner_type
                    .read(ReadSource::Slot(storage.ptr(), "Ref<Float>"))
            },
            // SAFETY: `storage.ptr()` is the boolean out-slot the callee wrote; the inner boolean
            // codec reads it as a pointer slot.
            Descriptor::Boolean(boolean) => unsafe {
                boolean.read(ReadSource::Slot(storage.ptr(), "Ref<Boolean>"))
            },
            // SAFETY: `storage.ptr()` is the unichar out-slot the callee wrote; the inner unichar
            // codec reads it as a pointer slot.
            Descriptor::Unichar(unichar) => unsafe {
                unichar.read(ReadSource::Slot(storage.ptr(), "Ref<Unichar>"))
            },
            Descriptor::String(string_type) => Ok(Self::decode_ref_string(storage, string_type)),
            Descriptor::Array(_) => {
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
        stashed_value: &ffi::StashedValue,
        ffi_args: &[ffi::StashedValue],
        args: &[Arg],
    ) -> anyhow::Result<value::Value> {
        if let Descriptor::Array(array_type) = &*self.inner_type {
            let Some(storage) = ref_storage_or_null(stashed_value, "Ref<Array>")? else {
                return Ok(value::Value::Null);
            };

            let actual_ptr = match storage.kind() {
                // SAFETY: a `PtrStorage` out-slot holds a pointer to the produced array; the slot
                // is pointer-sized, so dereferencing it loads that array pointer.
                StashKind::PtrStorage(_) => unsafe { *(storage.ptr() as *const *mut c_void) },
                _ => storage.ptr(),
            };

            if actual_ptr.is_null() {
                return Ok(value::Value::Array(vec![]));
            }

            let ptr_stashed_value = ffi::StashedValue::Ptr(actual_ptr);
            let result = array_type.decode_with_context(&ptr_stashed_value, ffi_args, args);

            if matches!(storage.kind(), StashKind::PtrStorage(_))
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

        self.decode(stashed_value)
    }
}

impl PointerWriter for RefDescriptor {}

impl RefDescriptor {
    #[cfg_attr(coverage_nightly, coverage(off))]
    fn null_ptr_storage() -> ffi::StashedValue {
        let mut slot: Vec<*mut c_void> = vec![std::ptr::null_mut()];
        let ptr = slot.as_mut_ptr() as *mut c_void;
        ffi::StashedValue::Storage(Stash::new(ptr, StashKind::PtrStorage(slot)))
    }

    fn scalar_out_slot(encoded: &ffi::StashedValue) -> anyhow::Result<ffi::StashedValue> {
        let storage = Stash::from(vec![0u64]);
        // SAFETY: `storage` owns an 8-byte `u64` buffer, large enough for any scalar payload of
        // `encoded`; `write_scalar_to` writes that payload into the slot.
        unsafe { encoded.write_scalar_to(storage.ptr())? };
        Ok(ffi::StashedValue::Storage(storage))
    }

    fn zeroed_scalar_slot() -> ffi::StashedValue {
        ffi::StashedValue::Storage(Stash::from(vec![0u64]))
    }

    fn decode_ref_string(storage: &Stash, string_type: &super::StringDescriptor) -> value::Value {
        if storage.ptr().is_null() {
            return value::Value::Null;
        }

        if let StashKind::Buffer(_) = storage.kind() {
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
    use crate::ffi::descriptors::{FloatKind, IntegerKind};

    fn slot_storage(encoded: &ffi::StashedValue) -> &Stash {
        ref_storage_or_null(encoded, "scalar out slot")
            .expect("scalar out slot should be a Storage value")
            .expect("scalar out slot should be non-null")
    }

    #[test]
    fn scalar_out_slot_seeds_integer_payload() {
        let slot = RefDescriptor::scalar_out_slot(&ffi::StashedValue::I32(7))
            .expect("i32 payload should produce a slot");
        let storage = slot_storage(&slot);
        // SAFETY: `storage.ptr()` is the 8-byte scalar slot seeded with an i32 above; `read_ptr`
        // reads it back as an i32.
        let seeded = unsafe { IntegerKind::I32.read_ptr(storage.ptr() as *const u8) };
        assert_eq!(seeded, 7.0);
    }

    #[test]
    fn scalar_out_slot_seeds_float_payload() {
        let slot = RefDescriptor::scalar_out_slot(&ffi::StashedValue::F64(1.5))
            .expect("f64 payload should produce a slot");
        let storage = slot_storage(&slot);
        // SAFETY: `storage.ptr()` is the 8-byte scalar slot seeded with an f64 above; `read_ptr`
        // reads it back as an f64.
        let seeded = unsafe { FloatKind::F64.read_ptr(storage.ptr() as *const u8) };
        assert_eq!(seeded, 1.5);
    }

    #[test]
    fn zeroed_scalar_slot_is_zero_initialized() {
        let slot = RefDescriptor::zeroed_scalar_slot();
        let storage = slot_storage(&slot);
        // SAFETY: `storage.ptr()` is the zero-initialized 8-byte scalar slot; `read_ptr` reads it
        // back as an i32 (expected to be zero).
        let seeded = unsafe { IntegerKind::I32.read_ptr(storage.ptr() as *const u8) };
        assert_eq!(seeded, 0.0);
    }
}

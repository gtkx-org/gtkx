use std::ffi::c_char;

use anyhow::bail;
use libffi::middle as libffi;

use super::prelude::*;
use crate::ffi::Arg;
use crate::ffi::codec::{ArrayKind, Codec};
use crate::ffi::{Stash, StashKind};

#[derive(Debug, Clone)]
pub struct RefCodec {
    pub inner_codec: Box<Codec>,
}

impl RefCodec {
    pub fn new(inner_codec: Codec) -> napi::Result<Self> {
        if !Self::supports_inner(&inner_codec) {
            return Err(napi::Error::new(
                napi::Status::InvalidArg,
                format!("'{inner_codec}' cannot be used as a Ref inner codec"),
            ));
        }
        Ok(Self {
            inner_codec: Box::new(inner_codec),
        })
    }

    pub fn supports_inner(inner: &Codec) -> bool {
        !matches!(
            inner,
            Codec::HashTable(_)
                | Codec::Callback(_)
                | Codec::Void(_)
                | Codec::Buffer(_)
                | Codec::Ref(_)
        )
    }
}

impl Encoder for RefCodec {
    fn encode(&self, val: &value::Value) -> anyhow::Result<ffi::StashedValue> {
        let ref_val = match val {
            value::Value::Ref(r) => r,
            value::Value::Null | value::Value::Undefined => {
                return Ok(ffi::StashedValue::Ptr(std::ptr::null_mut()));
            }
            _ => bail!("Expected a Ref for ref codec, got {val:?}"),
        };

        match &*self.inner_codec {
            Codec::Boxed(_) | Codec::Struct(_) | Codec::Object(_) | Codec::Fundamental(_) => {
                match &*ref_val.value {
                    value::Value::Null | value::Value::Undefined => Ok(Self::null_ptr_storage()),
                    _ => bail!(
                        "Expected Null for Ref<Boxed/Struct/Object/Fundamental>, got {:?}",
                        ref_val.value
                    ),
                }
            }
            Codec::Array(array_codec) => match &*ref_val.value {
                value::Value::Array(arr) if !arr.is_empty() => {
                    let encoded = array_codec.encode(&ref_val.value)?;
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
            Codec::String(string_codec) => {
                let (buffer_size, initial_content) = match (&string_codec.length, &*ref_val.value) {
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
                    let ref_arg = Arg::new(*self.inner_codec.clone(), *ref_val.value.clone());
                    let encoded = ffi::StashedValue::try_from(ref_arg)?;
                    Self::scalar_out_slot(&encoded)
                }
            },
        }
    }

    fn call_cif(
        &self,
        _cif: &libffi::Cif,
        _ptr: libffi::CodePtr,
        _args: &[libffi::Arg],
    ) -> anyhow::Result<ffi::StashedValue> {
        bail!("Ref codecs cannot be return codecs")
    }
}

impl Decoder for RefCodec {
    unsafe fn read(&self, src: ReadSource<'_>) -> anyhow::Result<value::Value> {
        let storage = match src {
            ReadSource::Call(stashed_value) => {
                let Some(storage) = stashed_value.as_storage_or_null("Ref")? else {
                    return Ok(value::Value::Null);
                };
                storage
            }
            ReadSource::Slot(ptr, _context) => {
                let inner_ptr = unsafe { *(ptr as *const *mut c_void) };
                if inner_ptr.is_null() {
                    return Ok(value::Value::Null);
                }
                return unsafe {
                    self.inner_codec
                        .read(ReadSource::Slot(inner_ptr, "ref inner"))
                };
            }
            ReadSource::Value(..) => bail!("This codec cannot be read from pointer"),
        };

        match &*self.inner_codec {
            Codec::Object(_) | Codec::Boxed(_) | Codec::Fundamental(_) | Codec::Struct(_) => {
                let actual_ptr = unsafe { *(storage.ptr() as *const *mut c_void) };
                self.inner_codec.decode(&ffi::StashedValue::Ptr(actual_ptr))
            }
            Codec::Integer(_) => unsafe {
                self.inner_codec
                    .read(ReadSource::Slot(storage.ptr(), "Ref<Integer>"))
            },
            Codec::EnumFlags(_) => unsafe {
                self.inner_codec
                    .read(ReadSource::Slot(storage.ptr(), "Ref<EnumFlags>"))
            },
            Codec::Float(_) => unsafe {
                self.inner_codec
                    .read(ReadSource::Slot(storage.ptr(), "Ref<Float>"))
            },
            Codec::Boolean(boolean) => unsafe {
                boolean.read(ReadSource::Slot(storage.ptr(), "Ref<Boolean>"))
            },
            Codec::Unichar(unichar) => unsafe {
                unichar.read(ReadSource::Slot(storage.ptr(), "Ref<Unichar>"))
            },
            Codec::String(string_codec) => Ok(Self::decode_ref_string(storage, string_codec)),
            Codec::Array(_) => {
                bail!("Ref<Array> requires decode_with_context to get size from another parameter")
            }
            _ => bail!(
                "Unsupported ref inner codec for reading: {:?}",
                self.inner_codec
            ),
        }
    }

    fn decode_with_context(
        &self,
        stashed_value: &ffi::StashedValue,
        ffi_args: &[ffi::StashedValue],
        args: &[Arg],
    ) -> anyhow::Result<value::Value> {
        if let Codec::Array(array_codec) = &*self.inner_codec {
            let Some(storage) = stashed_value.as_storage_or_null("Ref<Array>")? else {
                return Ok(value::Value::Null);
            };

            let actual_ptr = match storage.kind() {
                StashKind::PtrStorage(_) => unsafe { *(storage.ptr() as *const *mut c_void) },
                _ => storage.ptr(),
            };

            if actual_ptr.is_null() {
                return Ok(value::Value::Array(vec![]));
            }

            let ptr_stashed_value = ffi::StashedValue::Ptr(actual_ptr);
            let result = array_codec.decode_with_context(&ptr_stashed_value, ffi_args, args);

            if matches!(storage.kind(), StashKind::PtrStorage(_))
                && array_codec.ownership.is_full()
                && matches!(array_codec.kind, ArrayKind::Sized | ArrayKind::Fixed)
            {
                unsafe { glib::ffi::g_free(actual_ptr) };
            }

            return result;
        }

        self.decode(stashed_value)
    }
}

impl PointerWriter for RefCodec {}

impl RefCodec {
    fn null_ptr_storage() -> ffi::StashedValue {
        let mut slot: Vec<*mut c_void> = vec![std::ptr::null_mut()];
        let ptr = slot.as_mut_ptr() as *mut c_void;
        ffi::StashedValue::Storage(Stash::new(ptr, StashKind::PtrStorage(slot)))
    }

    fn scalar_out_slot(encoded: &ffi::StashedValue) -> anyhow::Result<ffi::StashedValue> {
        let storage = Stash::from(vec![0u64]);
        unsafe { encoded.write_scalar_to(storage.ptr())? };
        Ok(ffi::StashedValue::Storage(storage))
    }

    fn zeroed_scalar_slot() -> ffi::StashedValue {
        ffi::StashedValue::Storage(Stash::from(vec![0u64]))
    }

    fn decode_ref_string(storage: &Stash, string_codec: &super::StringCodec) -> value::Value {
        if storage.ptr().is_null() {
            return value::Value::Null;
        }

        if let StashKind::Buffer(_) = storage.kind() {
            let string =
                unsafe { glib::GStr::from_ptr_lossy(storage.ptr() as *const c_char) }.to_string();
            value::Value::String(string)
        } else {
            let str_ptr = unsafe { *(storage.ptr() as *const *const c_char) };
            if str_ptr.is_null() {
                return value::Value::Null;
            }
            let string = unsafe { glib::GStr::from_ptr_lossy(str_ptr) }.to_string();

            if string_codec.ownership.is_full() {
                unsafe { glib::ffi::g_free(str_ptr as *mut c_void) };
            }

            value::Value::String(string)
        }
    }
}

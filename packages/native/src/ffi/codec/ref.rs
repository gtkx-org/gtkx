use std::ffi::c_char;

use anyhow::bail;
use libffi::middle as libffi;

use super::prelude::*;
use crate::ffi::codec::Codec;
use crate::ffi::{StashData, StashStorage};

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
        match inner {
            Codec::Callback(_) | Codec::Void(_) | Codec::Buffer(_) | Codec::Ref(_) => false,
            Codec::Integer(_)
            | Codec::BigInt(_)
            | Codec::Float(_)
            | Codec::EnumFlags(_)
            | Codec::String(_)
            | Codec::Boolean(_)
            | Codec::Object(_)
            | Codec::Boxed(_)
            | Codec::Struct(_)
            | Codec::Fundamental(_)
            | Codec::Array(_)
            | Codec::HashTable(_)
            | Codec::Unichar(_) => true,
        }
    }
}

impl Encoder for RefCodec {
    fn encode(&self, value: &value::Value) -> anyhow::Result<ffi::Stash> {
        let ref_val = match value {
            value::Value::Ref(r) => r,
            value::Value::Null | value::Value::Undefined => {
                return Ok(ffi::Stash::Ptr(std::ptr::null_mut()));
            }
            _ => bail_expected!("a Ref", "ref", value),
        };

        if self.inner_codec.is_handle_backed() {
            return match &*ref_val.value {
                value::Value::Null | value::Value::Undefined => Ok(Self::null_ptr_stash()),
                _ => bail!(
                    "Expected Null for Ref<Boxed/Struct/Object/Fundamental>, got {:?}",
                    ref_val.value
                ),
            };
        }

        match &*self.inner_codec {
            Codec::Array(array_codec) => match &*ref_val.value {
                value::Value::Array(arr) if !arr.is_empty() => {
                    let encoded = array_codec.encode(&ref_val.value)?;
                    anyhow::ensure!(
                        matches!(encoded, ffi::Stash::Storage(_)),
                        "Expected Storage from array encode for Ref<Array>"
                    );
                    Ok(encoded)
                }
                value::Value::Null | value::Value::Undefined | value::Value::Array(_) => {
                    Ok(Self::null_ptr_stash())
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
                        return Ok(Self::null_ptr_stash());
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
                Ok(ffi::Stash::Storage(StashStorage::new(
                    ptr,
                    StashData::Buffer(buffer),
                )))
            }
            _ => match &*ref_val.value {
                value::Value::Null | value::Value::Undefined => Ok(Self::zeroed_scalar_stash()),
                _ => {
                    let encoded = self.inner_codec.encode(&ref_val.value)?;
                    Self::scalar_out_stash(&encoded)
                }
            },
        }
    }

    fn call_cif(
        &self,
        _cif: &libffi::Cif,
        _ptr: libffi::CodePtr,
        _args: &[libffi::Arg],
    ) -> anyhow::Result<ffi::Stash> {
        bail!("Ref codecs cannot be return codecs")
    }
}

impl Decoder for RefCodec {
    unsafe fn read(&self, src: ReadSource<'_>) -> anyhow::Result<value::Value> {
        let storage = match src {
            ReadSource::Call(stash) => {
                let Some(storage) = stash.as_storage_or_null("Ref")? else {
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

        if self.inner_codec.is_handle_backed() {
            let actual_ptr = unsafe { *(storage.ptr() as *const *mut c_void) };
            return self.inner_codec.decode(&ffi::Stash::Ptr(actual_ptr));
        }

        match &*self.inner_codec {
            Codec::Integer(_)
            | Codec::EnumFlags(_)
            | Codec::Float(_)
            | Codec::Boolean(_)
            | Codec::Unichar(_) => unsafe {
                self.inner_codec
                    .read(ReadSource::Slot(storage.ptr(), "Ref inner"))
            },
            Codec::String(string_codec) => Ok(Self::decode_ref_string(storage, string_codec)),
            Codec::HashTable(_) => {
                let actual_ptr = unsafe { *(storage.ptr() as *const *mut c_void) };
                self.inner_codec.decode(&ffi::Stash::Ptr(actual_ptr))
            }
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
        stash: &ffi::Stash,
        ffi_args: &[ffi::Stash],
        arg_codecs: &[Codec],
    ) -> anyhow::Result<value::Value> {
        if let Codec::Array(array_codec) = &*self.inner_codec {
            let Some(storage) = stash.as_storage_or_null("Ref<Array>")? else {
                return Ok(value::Value::Null);
            };

            let actual_ptr = match storage.data() {
                StashData::PtrSlot(_) => unsafe { *(storage.ptr() as *const *mut c_void) },
                _ => storage.ptr(),
            };

            if actual_ptr.is_null() {
                return Ok(value::Value::Array(vec![]));
            }

            let ptr_stash = ffi::Stash::Ptr(actual_ptr);
            let result = array_codec.decode_with_context(&ptr_stash, ffi_args, arg_codecs);

            if matches!(storage.data(), StashData::PtrSlot(_))
                && array_codec.ownership.is_full()
                && array_codec.is_length_bounded()
            {
                unsafe { glib::ffi::g_free(actual_ptr) };
            }

            return result;
        }

        self.decode(stash)
    }
}

impl PtrWriter for RefCodec {}

impl RefCodec {
    fn null_ptr_stash() -> ffi::Stash {
        let mut slot: Vec<*mut c_void> = vec![std::ptr::null_mut()];
        let ptr = slot.as_mut_ptr() as *mut c_void;
        ffi::Stash::Storage(StashStorage::new(ptr, StashData::PtrSlot(slot)))
    }

    fn scalar_out_stash(encoded: &ffi::Stash) -> anyhow::Result<ffi::Stash> {
        let storage = StashStorage::from(vec![0u64]);
        unsafe { encoded.write_scalar_to_ptr(storage.ptr())? };
        Ok(ffi::Stash::Storage(storage))
    }

    fn zeroed_scalar_stash() -> ffi::Stash {
        ffi::Stash::Storage(StashStorage::from(vec![0u64]))
    }

    fn decode_ref_string(
        storage: &StashStorage,
        string_codec: &super::StringCodec,
    ) -> value::Value {
        if storage.ptr().is_null() {
            return value::Value::Null;
        }

        if let StashData::Buffer(_) = storage.data() {
            let string = unsafe { lossy_c_string(storage.ptr() as *const c_char) };
            value::Value::String(string)
        } else {
            let str_ptr = unsafe { *(storage.ptr() as *const *const c_char) };
            if str_ptr.is_null() {
                return value::Value::Null;
            }
            let string = unsafe { lossy_c_string(str_ptr) };

            if string_codec.ownership.is_full() {
                unsafe { glib::ffi::g_free(str_ptr as *mut c_void) };
            }

            value::Value::String(string)
        }
    }
}

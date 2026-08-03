use std::ffi::c_char;

use anyhow::bail;

use super::prelude::*;
use crate::ffi::codec::Codec;
use crate::ffi::{StashData, StashStorage};

#[derive(Debug, Clone)]
pub struct RefCodec {
    pub inner_codec: Box<Codec>,
    pub inout: bool,
}

impl RefCodec {
    pub fn new(inner_codec: Codec, inout: bool) -> Result<Self> {
        if !Self::supports_inner(&inner_codec) {
            return Err(Error::new(
                Status::InvalidArg,
                format!("'{inner_codec}' cannot be used as a Ref inner codec"),
            ));
        }
        Ok(Self {
            inner_codec: Box::new(inner_codec),
            inout,
        })
    }

    #[must_use]
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

    fn inner_value<'e>(env: &'e Env, value: Unknown<'e>) -> anyhow::Result<Option<Unknown<'e>>> {
        match value.get_type()? {
            ValueType::Null | ValueType::Undefined => Ok(None),
            ValueType::Object => {
                let obj = Object::from_raw(env.raw(), value.raw());
                Ok(Some(obj.get_named_property::<Unknown<'_>>("value")?))
            }
            _ => bail_expected!("a Ref", "ref"),
        }
    }
}

impl Encoder for RefCodec {
    fn encode(&self, env: &Env, value: Unknown<'_>) -> anyhow::Result<ffi::Stash> {
        let Some(inner) = Self::inner_value(env, value)? else {
            return Ok(ffi::Stash::Ptr(std::ptr::null_mut()));
        };
        let inner_type = inner.get_type()?;
        let is_nullish = matches!(inner_type, ValueType::Null | ValueType::Undefined);

        if self.inner_codec.is_handle_backed() {
            return if is_nullish {
                Ok(Self::null_ptr_stash())
            } else {
                bail!("Expected Null for Ref<Boxed/Struct/Object/Fundamental>")
            };
        }

        match &*self.inner_codec {
            Codec::Array(array_codec) => {
                if inner_type == ValueType::Object
                    && inner.is_array()?
                    && Array::from_unknown(inner)?.len() > 0
                {
                    let ffi::Stash::Storage(storage) = array_codec.encode(env, inner)? else {
                        bail!("Expected Storage from array encode for Ref<Array>")
                    };

                    if array_codec.is_length_bounded() {
                        return Ok(ffi::Stash::Storage(storage));
                    }

                    Ok(Self::ptr_slot_stash(storage))
                } else if is_nullish || (inner_type == ValueType::Object && inner.is_array()?) {
                    Ok(Self::null_ptr_stash())
                } else {
                    bail!("Expected Array, Null, or Undefined for Ref<Array>")
                }
            }
            Codec::String(string_codec) => {
                let inner_string = if is_nullish {
                    None
                } else if inner_type == ValueType::String {
                    Some(value::read_napi::<String>(inner)?)
                } else {
                    bail!("Expected a String, Null, or length for Ref<String>")
                };

                let buffer_size = match (&string_codec.length, &inner_string) {
                    (Some(len), _) => {
                        anyhow::ensure!(
                            *len > 0,
                            "A Ref<String> buffer length must be at least 1 to hold the trailing NUL byte"
                        );
                        *len
                    }
                    (None, Some(s)) => s.len() + 1,
                    (None, None) => return Ok(Self::null_ptr_stash()),
                };

                let mut buffer: Vec<u8> = Self::zeroed_buffer(buffer_size)?;
                if let Some(content) = inner_string.as_deref() {
                    let bytes = content.as_bytes();
                    let copy_len = bytes.len().min(buffer_size.saturating_sub(1));
                    buffer[..copy_len].copy_from_slice(&bytes[..copy_len]);
                }

                let ptr = buffer.as_mut_ptr().cast::<c_void>();
                Ok(ffi::Stash::Storage(StashStorage::new(
                    ptr,
                    StashData::Buffer(buffer),
                )))
            }
            _ => {
                if is_nullish {
                    Ok(Self::zeroed_scalar_stash())
                } else {
                    let encoded = self.inner_codec.encode(env, inner)?;
                    Self::scalar_out_stash(&encoded)
                }
            }
        }
    }

    reject_return_codec!("Ref");
}

impl Decoder for RefCodec {
    unsafe fn read<'e>(&self, env: &'e Env, ctx: ReadCtx<'_>) -> anyhow::Result<Unknown<'e>> {
        let storage = match ctx.source {
            ReadSource::Call(stash) => {
                let Some(storage) = stash.as_storage_or_null("Ref")? else {
                    return Ok(value::js_null(env)?);
                };
                storage
            }
            ReadSource::Slot(ptr, _context) => {
                let inner_ptr = unsafe { ptr.cast::<*mut c_void>().read_unaligned() };
                if inner_ptr.is_null() {
                    return Ok(value::js_null(env)?);
                }
                return unsafe {
                    self.inner_codec.read(
                        env,
                        ReadCtx::slot(inner_ptr, "ref inner")
                            .with_transfer(self.inner_codec.transfer()),
                    )
                };
            }
            ReadSource::Value(..) => bail!("This codec cannot be read from pointer"),
        };

        if self.inner_codec.is_handle_backed() {
            let actual_ptr = unsafe { *(storage.ptr() as *const *mut c_void) };
            return self.inner_codec.decode(env, &ffi::Stash::Ptr(actual_ptr));
        }

        match &*self.inner_codec {
            Codec::Integer(_)
            | Codec::EnumFlags(_)
            | Codec::Float(_)
            | Codec::Boolean(_)
            | Codec::Unichar(_) => unsafe {
                self.inner_codec.read(
                    env,
                    ReadCtx::slot(storage.ptr(), "Ref inner")
                        .with_transfer(self.inner_codec.transfer()),
                )
            },
            Codec::String(string_codec) => Self::decode_ref_string(env, storage, string_codec),
            Codec::HashTable(_) => {
                let actual_ptr = unsafe { *(storage.ptr() as *const *mut c_void) };
                self.inner_codec.decode(env, &ffi::Stash::Ptr(actual_ptr))
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

    fn decode_with_context<'e>(
        &self,
        env: &'e Env,
        stash: &ffi::Stash,
        ffi_args: &[ffi::Stash],
        arg_codecs: &[Codec],
    ) -> anyhow::Result<Unknown<'e>> {
        if let Codec::Array(array_codec) = &*self.inner_codec {
            let Some(storage) = stash.as_storage_or_null("Ref<Array>")? else {
                return Ok(value::js_null(env)?);
            };

            let actual_ptr = match storage.data() {
                StashData::PtrSlot(_, _) => unsafe { *(storage.ptr() as *const *mut c_void) },
                _ => storage.ptr(),
            };

            if actual_ptr.is_null() {
                return Ok(env.create_array(0)?.coerce_to_object()?.to_unknown());
            }

            let ptr_stash = ffi::Stash::Ptr(actual_ptr);
            let result = array_codec.decode_with_context(env, &ptr_stash, ffi_args, arg_codecs);

            if matches!(storage.data(), StashData::PtrSlot(_, _))
                && array_codec.ownership.is_full()
                && array_codec.is_length_bounded()
            {
                unsafe { glib::ffi::g_free(actual_ptr) };
            }

            return result;
        }

        self.decode(env, stash)
    }
}

impl PtrWriter for RefCodec {}

impl RefCodec {
    fn zeroed_buffer(size: usize) -> anyhow::Result<Vec<u8>> {
        let mut buffer: Vec<u8> = Vec::new();
        buffer
            .try_reserve_exact(size)
            .map_err(|_| anyhow::anyhow!("Cannot allocate a {size}-byte Ref<String> buffer"))?;
        buffer.resize(size, 0);

        Ok(buffer)
    }

    fn null_ptr_stash() -> ffi::Stash {
        Self::slot_stash(std::ptr::null_mut(), None)
    }

    fn ptr_slot_stash(inner: StashStorage) -> ffi::Stash {
        Self::slot_stash(inner.ptr(), Some(Box::new(inner)))
    }

    fn slot_stash(target: *mut c_void, inner: Option<Box<StashStorage>>) -> ffi::Stash {
        let mut slot: Vec<*mut c_void> = vec![target];
        let ptr = slot.as_mut_ptr().cast::<c_void>();
        ffi::Stash::Storage(StashStorage::new(ptr, StashData::PtrSlot(slot, inner)))
    }

    fn scalar_out_stash(encoded: &ffi::Stash) -> anyhow::Result<ffi::Stash> {
        let storage = StashStorage::from(vec![0u64]);
        unsafe { encoded.write_scalar_to_ptr(storage.ptr())? };
        Ok(ffi::Stash::Storage(storage))
    }

    fn zeroed_scalar_stash() -> ffi::Stash {
        ffi::Stash::Storage(StashStorage::from(vec![0u64]))
    }

    fn decode_ref_string<'e>(
        env: &'e Env,
        storage: &StashStorage,
        string_codec: &super::StringCodec,
    ) -> anyhow::Result<Unknown<'e>> {
        if storage.ptr().is_null() {
            return Ok(value::js_null(env)?);
        }

        if let StashData::Buffer(_) = storage.data() {
            let string = unsafe { lossy_c_string(storage.ptr() as *const c_char) };
            Ok(string.into_unknown(env)?)
        } else {
            let str_ptr = unsafe { *(storage.ptr() as *const *const c_char) };
            if str_ptr.is_null() {
                return Ok(value::js_null(env)?);
            }
            let string = unsafe { lossy_c_string(str_ptr) };

            if string_codec.ownership.is_full() {
                unsafe { glib::ffi::g_free(str_ptr as *mut c_void) };
            }

            Ok(string.into_unknown(env)?)
        }
    }
}

use std::ffi::{CStr, c_char};

use anyhow::bail;

use super::prelude::*;
use crate::ffi::codec::Codec;
use crate::ffi::{StashData, StashStorage};

#[derive(Debug, Clone)]
pub struct RefCodec {
    inner_codec: Box<Codec>,
    inout: bool,
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
    pub fn inner_codec(&self) -> &Codec {
        &self.inner_codec
    }

    #[must_use]
    pub fn is_inout(&self) -> bool {
        self.inout
    }

    #[must_use]
    pub fn supports_inner(inner: &Codec) -> bool {
        match inner {
            Codec::Callback(_) | Codec::Void(_) | Codec::Buffer(_) | Codec::Ref(_) => false,
            Codec::Integer(_)
            | Codec::BigInt(_)
            | Codec::Float(_)
            | Codec::Bytes(_)
            | Codec::Object(_)
            | Codec::Boxed(_)
            | Codec::Struct(_)
            | Codec::Fundamental(_)
            | Codec::Array(_)
            | Codec::HashTable(_) => true,
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

    fn encode_scalar_storage(
        &self,
        value: Unknown<'_>,
        retain_for_async: bool,
    ) -> anyhow::Result<ffi::Stash> {
        if matches!(value.get_type()?, ValueType::Null | ValueType::Undefined) {
            return Ok(ffi::Stash::Ptr(std::ptr::null_mut()));
        }
        let handle: &External<crate::handle::Handle> = value::read_napi(value)?;
        let size = self
            .inner_codec
            .field_size()
            .ok_or_else(|| anyhow::anyhow!("The reference has no declared storage size"))?;
        let ptr = crate::api::handle_memory_range(handle, 0, size, "scalar reference")?;
        let retained = if retain_for_async {
            handle.retain_for_async()?
        } else {
            (**handle).clone()
        };

        Ok(ffi::Stash::Storage(StashStorage::new(
            ptr,
            StashData::Handle(retained),
        )))
    }
}

impl Encoder for RefCodec {
    fn encode(&self, env: &Env, value: Unknown<'_>) -> anyhow::Result<ffi::Stash> {
        if self.inner_codec.is_scalar() {
            return self.encode_scalar_storage(value, false);
        }
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
                if let Some(byte_len) = array_codec.caller_allocation_len()? {
                    let allocation = ffi::CallerAllocation::zeroed(byte_len);

                    return Ok(ffi::Stash::Storage(StashStorage::new(
                        allocation.ptr(),
                        StashData::CallerAllocation(allocation),
                    )));
                }

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
            Codec::Bytes(bytes_codec) => {
                let inner_bytes = super::bytes::read_bytes(inner)?;

                let buffer_size = match (&bytes_codec.length, &inner_bytes) {
                    (Some(len), _) => {
                        anyhow::ensure!(
                            *len > 0,
                            "A Ref<Bytes> buffer length must be at least 1 to hold the trailing NUL byte"
                        );
                        *len
                    }
                    (None, Some(s)) => s.len() + 1,
                    (None, None) => return Ok(Self::null_ptr_stash()),
                };

                let mut buffer: Vec<u8> = Self::zeroed_buffer(buffer_size)?;
                if let Some(bytes) = inner_bytes.as_deref() {
                    let copy_len = bytes.len().min(buffer_size.saturating_sub(1));
                    buffer[..copy_len].copy_from_slice(&bytes[..copy_len]);
                }

                let ptr = buffer.as_mut_ptr().cast::<c_void>();
                Ok(ffi::Stash::Storage(StashStorage::new(
                    ptr,
                    StashData::Buffer(buffer),
                )))
            }
            _ if is_nullish => Ok(Self::null_ptr_stash()),
            _ => bail!("Expected Null for Ref<HashTable>"),
        }
    }

    fn encode_owned(&self, env: &Env, value: Unknown<'_>) -> anyhow::Result<ffi::Stash> {
        if self.inner_codec.is_scalar() {
            self.encode_scalar_storage(value, true)
        } else {
            self.encode(env, value)
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
            Codec::Bytes(bytes_codec) => Self::decode_ref_bytes(env, storage, bytes_codec),
            Codec::HashTable(_) => {
                let actual_ptr = unsafe { *(storage.ptr() as *const *mut c_void) };
                self.inner_codec.decode(env, &ffi::Stash::Ptr(actual_ptr))
            }
            Codec::Array(_) => {
                bail!("Ref<Array> requires decode_with_context to get size from another parameter")
            }
            scalar => unsafe {
                scalar.read(
                    env,
                    ReadCtx::slot(storage.ptr(), "Ref inner").with_transfer(scalar.transfer()),
                )
            },
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
                return Ok(value::js_null(env)?);
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
            .map_err(|_| anyhow::anyhow!("Cannot allocate a {size}-byte Ref<Bytes> buffer"))?;
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

    fn decode_ref_bytes<'e>(
        env: &'e Env,
        storage: &StashStorage,
        bytes_codec: &super::BytesCodec,
    ) -> anyhow::Result<Unknown<'e>> {
        if storage.ptr().is_null() {
            return Ok(value::js_null(env)?);
        }

        if let StashData::Buffer(buffer) = storage.data() {
            let source = CStr::from_bytes_until_nul(buffer)?.to_bytes();
            let bytes = unsafe { value::js_byte_array(env, source.as_ptr(), source.len()) };
            Ok(bytes?)
        } else {
            let str_ptr = unsafe { *(storage.ptr() as *const *const c_char) };
            if str_ptr.is_null() {
                return Ok(value::js_null(env)?);
            }
            let source = unsafe { CStr::from_ptr(str_ptr) }.to_bytes();
            let bytes = unsafe { value::js_byte_array(env, source.as_ptr(), source.len()) };

            if bytes_codec.ownership.is_full() {
                unsafe { glib::ffi::g_free(str_ptr as *mut c_void) };
            }

            Ok(bytes?)
        }
    }
}

use anyhow::bail;

use super::super::prelude::*;
use super::ArrayCodec;
use super::container::{ArrayContainer, ArrayRead, BufferViewSupport};
use crate::ffi::codec::Codec;

#[derive(Debug, Clone)]
pub(crate) struct SizedArrayCodec {
    pub(super) size_param_index: u32,
}

impl SizedArrayCodec {
    pub(super) fn new(size_param_index: u32) -> Self {
        Self { size_param_index }
    }

    pub(super) fn extent(
        &self,
        ffi_args: &[ffi::Stash],
        arg_codecs: &[Codec],
    ) -> anyhow::Result<usize> {
        ArrayCodec::size_from_args(ffi_args, arg_codecs, self.size_param_index as usize)
    }
}

impl ArrayContainer for SizedArrayCodec {
    fn decode<'e>(
        &self,
        _codec: &ArrayCodec,
        _env: &'e Env,
        _stash: &ffi::Stash,
        _read: ArrayRead,
    ) -> anyhow::Result<Unknown<'e>> {
        bail!(
            "A sized array cannot be decoded without its length parameter (index {})",
            self.size_param_index
        )
    }

    fn decode_with_context<'e>(
        &self,
        codec: &ArrayCodec,
        env: &'e Env,
        stash: &ffi::Stash,
        ffi_args: &[ffi::Stash],
        arg_codecs: &[Codec],
        read: ArrayRead,
    ) -> anyhow::Result<Unknown<'e>> {
        let length = self.extent(ffi_args, arg_codecs)?;
        codec.decode_length_bounded(env, self.name(), stash, length, read)
    }

    fn buffer_view_support(&self) -> BufferViewSupport {
        BufferViewSupport::Contiguous(None)
    }

    fn name(&self) -> &'static str {
        "sized array"
    }
}

impl ArrayCodec {
    fn validated_size(size: i128, param_index: usize) -> anyhow::Result<usize> {
        usize::try_from(size).map_err(|_| {
            anyhow::anyhow!("Array size parameter at index {param_index} has invalid value: {size}")
        })
    }

    pub(super) fn size_from_args(
        ffi_args: &[ffi::Stash],
        arg_codecs: &[Codec],
        size_param_index: usize,
    ) -> anyhow::Result<usize> {
        let Some(ffi_arg) = ffi_args.get(size_param_index) else {
            bail!(
                "Size parameter index {} is out of bounds (args count: {})",
                size_param_index,
                ffi_args.len()
            );
        };
        let arg_codec = arg_codecs.get(size_param_index).ok_or_else(|| {
            anyhow::anyhow!("Size parameter index {size_param_index} has no argument codec")
        })?;

        if let Codec::Ref(ref_codec) = arg_codec {
            let ptr = match ffi_arg {
                ffi::Stash::Storage(storage) => storage.ptr(),
                ffi::Stash::Ptr(ptr) => *ptr,
                _ => std::ptr::null_mut(),
            };
            if !ptr.is_null() {
                let size = match ref_codec.inner_codec() {
                    Codec::Integer(kind) => Some(
                        kind.to_stash(unsafe { kind.read_ptr(ptr.cast::<u8>()) })
                            .to_integer()?,
                    ),
                    Codec::BigInt(kind) => {
                        Some(unsafe { kind.read_stash(ptr.cast::<u8>()) }.to_integer()?)
                    }
                    _ => None,
                };
                if let Some(size) = size {
                    return Self::validated_size(size, size_param_index);
                }
            }
        }

        if matches!(arg_codec, Codec::Integer(_) | Codec::BigInt(_)) {
            return Self::validated_size(ffi_arg.to_integer()?, size_param_index);
        }

        bail!(
            "Could not extract size from parameter at index {size_param_index}: expected Ref<Integer> or Integer, got type {arg_codec:?} with ffi value {ffi_arg:?}"
        );
    }

    fn decode_sized_array<'e>(
        &self,
        env: &'e Env,
        ptr: *mut c_void,
        length: usize,
        read: ArrayRead,
    ) -> anyhow::Result<Unknown<'e>> {
        self.decode_bytes_or_items(env, ptr.cast::<u8>(), length, "sized array", read)
    }

    fn decode_sized_from_stash<'e>(
        &self,
        env: &'e Env,
        stash: &ffi::Stash,
        length: usize,
        read: ArrayRead,
    ) -> Option<anyhow::Result<Unknown<'e>>> {
        let ffi::Stash::Ptr(ptr) = stash else {
            return None;
        };
        if ptr.is_null() {
            return Some(value::js_null(env).map_err(Into::into));
        }
        Some(self.decode_sized_array(env, *ptr, length, read))
    }

    pub(super) fn decode_length_bounded<'e>(
        &self,
        env: &'e Env,
        name: &str,
        stash: &ffi::Stash,
        length: usize,
        read: ArrayRead,
    ) -> anyhow::Result<Unknown<'e>> {
        match self.decode_sized_from_stash(env, stash, length, read) {
            Some(result) => result,
            None => self.decode_null_terminated(env, name, stash, read),
        }
    }
}

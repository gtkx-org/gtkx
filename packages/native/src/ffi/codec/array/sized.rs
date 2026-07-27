use anyhow::bail;

use super::super::prelude::*;
use super::container::{ArrayContainer, BufferViewSupport};
use super::{ArrayCodec, build_js_array};
use crate::ffi::codec::Codec;

#[derive(Debug, Clone)]
pub(crate) struct SizedArrayCodec {
    pub(super) size_param_index: u32,
}

impl SizedArrayCodec {
    pub(super) fn new(size_param_index: u32) -> Self {
        Self { size_param_index }
    }
}

impl ArrayContainer for SizedArrayCodec {
    // The length lives in a sibling parameter, so decoding without the surrounding argument list is
    // not possible. Falling back to the container default would scan for a terminator this array
    // does not have, so it fails loudly instead.
    fn decode<'e>(
        &self,
        _codec: &ArrayCodec,
        _env: &'e Env,
        _stash: &ffi::Stash,
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
    ) -> anyhow::Result<Unknown<'e>> {
        let length =
            ArrayCodec::size_from_args(ffi_args, arg_codecs, self.size_param_index as usize)?;
        codec.decode_length_bounded(env, self.name(), stash, length)
    }

    fn buffer_view_support(&self) -> BufferViewSupport {
        BufferViewSupport::Contiguous(None)
    }

    fn name(&self) -> &'static str {
        "sized array"
    }
}

impl ArrayCodec {
    // 2^53 is the largest integer an f64 holds exactly and is far below `usize::MAX` on the 64-bit
    // Linux targets this crate builds for, so a size that passes the guard converts without
    // saturating; a fractional size keeps truncating toward zero, as a C length would.
    #[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
    fn validated_size(size: f64, param_index: usize) -> anyhow::Result<usize> {
        const MAX_EXACT_INTEGER: f64 = 9_007_199_254_740_992.0;

        if !(0.0..=MAX_EXACT_INTEGER).contains(&size) {
            bail!("Array size parameter at index {param_index} has invalid value: {size}");
        }

        Ok(size as usize)
    }

    fn size_from_args(
        ffi_args: &[ffi::Stash],
        arg_codecs: &[Codec],
        size_param_index: usize,
    ) -> anyhow::Result<usize> {
        if size_param_index >= ffi_args.len() {
            bail!(
                "Size parameter index {} is out of bounds (args count: {})",
                size_param_index,
                ffi_args.len()
            );
        }

        let ffi_arg = &ffi_args[size_param_index];
        let arg_codec = &arg_codecs[size_param_index];

        if let Codec::Ref(ref_codec) = arg_codec
            && let Codec::Integer(integer_codec) = &*ref_codec.inner_codec
        {
            match ffi_arg {
                ffi::Stash::Storage(storage) => {
                    let size = unsafe { integer_codec.read_ptr(storage.ptr() as *const u8) };
                    return Self::validated_size(size, size_param_index);
                }
                ffi::Stash::Ptr(ptr) if !ptr.is_null() => {
                    let size = unsafe { integer_codec.read_ptr(*ptr as *const u8) };
                    return Self::validated_size(size, size_param_index);
                }
                _ => {}
            }
        }

        if let Codec::Integer(_) = arg_codec
            && let Ok(size) = ffi_arg.to_number()
        {
            return Self::validated_size(size, size_param_index);
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
    ) -> anyhow::Result<Unknown<'e>> {
        let codec = self.item_codec("sized array")?;
        let values = self.decode_contiguous(env, codec, ptr.cast::<u8>(), length)?;
        build_js_array(env, values)
    }

    fn decode_sized_from_stash<'e>(
        &self,
        env: &'e Env,
        stash: &ffi::Stash,
        length: usize,
    ) -> Option<anyhow::Result<Unknown<'e>>> {
        let ffi::Stash::Ptr(ptr) = stash else {
            return None;
        };
        if ptr.is_null() {
            return Some(build_js_array(env, Vec::new()));
        }
        Some(self.decode_sized_array(env, *ptr, length))
    }

    pub(super) fn decode_length_bounded<'e>(
        &self,
        env: &'e Env,
        name: &str,
        stash: &ffi::Stash,
        length: usize,
    ) -> anyhow::Result<Unknown<'e>> {
        match self.decode_sized_from_stash(env, stash, length) {
            Some(result) => result,
            None => self.decode_null_terminated(env, name, stash),
        }
    }
}

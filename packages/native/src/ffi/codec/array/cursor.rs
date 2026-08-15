use anyhow::bail;

use super::super::prelude::*;
use super::ArrayCodec;
use super::container::ArrayContainer;
use crate::ffi::codec::Codec;

#[derive(Debug, Clone)]
pub(crate) struct CursorArrayCodec {
    base_param_index: u32,
    size_param_index: u32,
}

impl CursorArrayCodec {
    pub(super) fn new(base_param_index: u32, size_param_index: u32) -> Self {
        Self {
            base_param_index,
            size_param_index,
        }
    }

    fn base_ptr(&self, ffi_args: &[ffi::Stash]) -> anyhow::Result<*mut c_void> {
        let index = self.base_param_index as usize;
        let Some(stash) = ffi_args.get(index) else {
            bail!(
                "Cursor base parameter index {index} is out of bounds (args count: {})",
                ffi_args.len()
            )
        };

        stash.as_ptr("a cursor array base")
    }

    fn remaining_items(
        &self,
        codec: &ArrayCodec,
        ptr: *mut c_void,
        ffi_args: &[ffi::Stash],
        arg_codecs: &[Codec],
    ) -> anyhow::Result<usize> {
        let base = self.base_ptr(ffi_args)?;
        let items =
            ArrayCodec::size_from_args(ffi_args, arg_codecs, self.size_param_index as usize)?;
        let stride = codec.cursor_stride()?;
        let offset = (ptr as usize).wrapping_sub(base as usize);

        anyhow::ensure!(
            offset.is_multiple_of(stride) && offset / stride <= items,
            "A cursor array points {offset} bytes into a buffer of {items} elements of {stride} bytes"
        );

        Ok(items - offset / stride)
    }
}

impl ArrayContainer for CursorArrayCodec {
    fn encode(
        &self,
        _codec: &ArrayCodec,
        _env: Env,
        _array: &[Unknown<'_>],
    ) -> anyhow::Result<ffi::Stash> {
        bail!("A cursor array is an output-only view into another argument's buffer")
    }

    fn decode<'e>(
        &self,
        _codec: &ArrayCodec,
        _env: &'e Env,
        _stash: &ffi::Stash,
        _transfer: Ownership,
    ) -> anyhow::Result<Unknown<'e>> {
        bail!(
            "A cursor array cannot be decoded without the buffer of parameter {}",
            self.base_param_index
        )
    }

    fn decode_with_context<'e>(
        &self,
        codec: &ArrayCodec,
        env: &'e Env,
        stash: &ffi::Stash,
        ffi_args: &[ffi::Stash],
        arg_codecs: &[Codec],
        transfer: Ownership,
    ) -> anyhow::Result<Unknown<'e>> {
        let Some(ptr) = stash.as_non_null_ptr(self.name())? else {
            return codec.decode_empty_sequence(env);
        };
        let length = self.remaining_items(codec, ptr, ffi_args, arg_codecs)?;

        codec.decode_length_bounded(env, self.name(), stash, length, transfer)
    }

    fn name(&self) -> &'static str {
        "cursor array"
    }
}

use super::super::prelude::*;
use super::ArrayCodec;
use super::container::{ArrayContainer, BufferViewSupport};
use crate::ffi::codec::Codec;

#[derive(Debug, Clone)]
pub(crate) struct FixedArrayCodec {
    fixed_size: u32,
}

impl FixedArrayCodec {
    pub(super) fn new(fixed_size: u32) -> Self {
        Self { fixed_size }
    }
}

impl ArrayContainer for FixedArrayCodec {
    fn decode_with_context(
        &self,
        codec: &ArrayCodec,
        stashed_value: &ffi::StashedValue,
        _ffi_args: &[ffi::StashedValue],
        _arg_codecs: &[Codec],
    ) -> anyhow::Result<value::Value> {
        codec.decode_length_bounded(self.name(), stashed_value, self.fixed_size as usize)
    }

    fn buffer_view_support(&self) -> BufferViewSupport {
        BufferViewSupport::Contiguous(Some(self.fixed_size as usize))
    }

    fn name(&self) -> &'static str {
        "fixed array"
    }
}

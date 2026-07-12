use super::super::prelude::*;
use super::ArrayCodec;
use super::container::{ArrayContainer, BufferViewSupport};

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
    fn decode<'e>(
        &self,
        codec: &ArrayCodec,
        env: &'e Env,
        stash: &ffi::Stash,
    ) -> anyhow::Result<Unknown<'e>> {
        codec.decode_length_bounded(env, self.name(), stash, self.fixed_size as usize)
    }

    fn buffer_view_support(&self) -> BufferViewSupport {
        BufferViewSupport::Contiguous(Some(self.fixed_size as usize))
    }

    fn name(&self) -> &'static str {
        "fixed array"
    }
}

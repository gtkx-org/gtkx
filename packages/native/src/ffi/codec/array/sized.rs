use anyhow::bail;

use super::super::prelude::*;
use super::ArrayCodec;
use super::container::{ArrayContainer, BufferViewSupport};
use crate::ffi::codec::Codec;

#[derive(Debug, Clone)]
pub(crate) struct SizedArrayCodec {
    size_param_index: u32,
}

impl SizedArrayCodec {
    pub(super) fn new(size_param_index: u32) -> Self {
        Self { size_param_index }
    }
}

impl ArrayContainer for SizedArrayCodec {
    fn decode_with_context(
        &self,
        codec: &ArrayCodec,
        stash: &ffi::Stash,
        ffi_args: &[ffi::Stash],
        arg_codecs: &[Codec],
    ) -> anyhow::Result<value::Value> {
        let length =
            ArrayCodec::size_from_args(ffi_args, arg_codecs, self.size_param_index as usize)?;
        codec.decode_length_bounded(self.name(), stash, length)
    }

    fn buffer_view_support(&self) -> BufferViewSupport {
        BufferViewSupport::Contiguous(None)
    }

    fn name(&self) -> &'static str {
        "sized array"
    }
}

impl ArrayCodec {
    fn validated_size(size: f64, param_index: usize) -> anyhow::Result<usize> {
        if size < 0.0 || !size.is_finite() {
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
            "Could not extract size from parameter at index {}: expected Ref<Integer> or Integer, got type {:?} with ffi value {:?}",
            size_param_index,
            arg_codec,
            ffi_arg
        );
    }

    fn decode_sized_array(&self, ptr: *mut c_void, length: usize) -> anyhow::Result<value::Value> {
        let codec = self.item_codec("sized array")?;
        let values = self.decode_contiguous(codec, ptr.cast::<u8>(), length)?;
        Ok(value::Value::Array(values))
    }

    fn decode_sized_from_stash(
        &self,
        stash: &ffi::Stash,
        length: usize,
    ) -> Option<anyhow::Result<value::Value>> {
        let ffi::Stash::Ptr(ptr) = stash else {
            return None;
        };
        if ptr.is_null() {
            return Some(Ok(value::Value::Array(vec![])));
        }
        Some(self.decode_sized_array(*ptr, length))
    }

    pub(super) fn decode_length_bounded(
        &self,
        name: &str,
        stash: &ffi::Stash,
        length: usize,
    ) -> anyhow::Result<value::Value> {
        match self.decode_sized_from_stash(stash, length) {
            Some(result) => result,
            None => self.decode_null_terminated(name, stash),
        }
    }
}

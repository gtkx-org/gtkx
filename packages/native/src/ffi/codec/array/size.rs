use anyhow::bail;

use super::super::prelude::*;
use super::ArrayCodec;
use crate::ffi::Arg;
use crate::ffi::codec::Codec;

impl ArrayCodec {
    fn validated_size(size: f64, param_index: usize) -> anyhow::Result<usize> {
        if size < 0.0 || !size.is_finite() {
            bail!("Array size parameter at index {param_index} has invalid value: {size}");
        }
        Ok(size as usize)
    }

    pub(super) fn size_from_args(
        ffi_args: &[ffi::StashedValue],
        args: &[Arg],
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
        let arg = &args[size_param_index];

        if let Codec::Ref(ref_codec) = &arg.codec
            && let Codec::Integer(integer_codec) = &*ref_codec.inner_codec
        {
            match ffi_arg {
                ffi::StashedValue::Stashed(storage) => {
                    let size = unsafe { integer_codec.read_ptr(storage.ptr() as *const u8) };
                    return Self::validated_size(size, size_param_index);
                }
                ffi::StashedValue::Ptr(ptr) if !ptr.is_null() => {
                    let size = unsafe { integer_codec.read_ptr(*ptr as *const u8) };
                    return Self::validated_size(size, size_param_index);
                }
                _ => {}
            }
        }

        if let Codec::Integer(_) = &arg.codec
            && let Ok(size) = ffi_arg.to_number()
        {
            return Self::validated_size(size, size_param_index);
        }

        bail!(
            "Could not extract size from parameter at index {}: expected Ref<Integer> or Integer, got type {:?} with ffi value {:?}",
            size_param_index,
            arg.codec,
            ffi_arg
        );
    }
}

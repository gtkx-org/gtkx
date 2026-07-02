use anyhow::bail;
use libffi::middle as libffi;

use super::numeric::MAX_SAFE_INTEGER;
use super::prelude::*;

#[derive(Debug, Clone, Copy)]
pub struct BufferCodec;

impl BufferCodec {
    fn ptr_from_number(value: f64) -> anyhow::Result<*mut c_void> {
        if !value.is_finite() || value.fract() != 0.0 || !(0.0..=MAX_SAFE_INTEGER).contains(&value)
        {
            bail!(
                "Buffer address {value} is not a non-negative integer within [0, {MAX_SAFE_INTEGER}]"
            );
        }
        Ok(value as usize as *mut c_void)
    }
}

impl Encoder for BufferCodec {
    fn encode(&self, value: &value::Value) -> anyhow::Result<ffi::Stash> {
        match value {
            value::Value::BufferView(view) => Ok(ffi::Stash::Ptr(view.ptr())),
            value::Value::Number(n) => Ok(ffi::Stash::Ptr(Self::ptr_from_number(*n)?)),
            value::Value::Null | value::Value::Undefined => {
                Ok(ffi::Stash::Ptr(std::ptr::null_mut()))
            }
            _ => {
                bail!(
                    "Expected an ArrayBufferView, number, or null for buffer codec, got {value:?}"
                )
            }
        }
    }

    fn call_cif(
        &self,
        _cif: &libffi::Cif,
        _ptr: libffi::CodePtr,
        _args: &[libffi::Arg],
    ) -> anyhow::Result<ffi::Stash> {
        bail!("Buffer codec cannot be return codecs")
    }
}

impl Decoder for BufferCodec {}

impl PtrWriter for BufferCodec {}

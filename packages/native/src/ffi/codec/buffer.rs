use anyhow::bail;

use super::numeric::MAX_SAFE_INTEGER;
use super::prelude::*;

#[derive(Debug, Clone, Copy)]
pub struct BufferCodec;

impl BufferCodec {
    #[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
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
    fn encode(&self, env: &Env, value: Unknown<'_>) -> anyhow::Result<ffi::Stash> {
        if let Some(view) = value::TypedView::from_unknown(env, value)? {
            return Ok(ffi::Stash::Ptr(view.ptr()));
        }
        match value.get_type()? {
            ValueType::Number => {
                let number = value::read_napi::<f64>(value)?;
                Ok(ffi::Stash::Ptr(Self::ptr_from_number(number)?))
            }
            ValueType::Null | ValueType::Undefined => Ok(ffi::Stash::Ptr(std::ptr::null_mut())),
            other => {
                bail_expected!(
                    format!("an ArrayBufferView, number, or null, got {other:?}"),
                    "buffer"
                )
            }
        }
    }

    fn encode_owned(&self, env: &Env, value: Unknown<'_>) -> anyhow::Result<ffi::Stash> {
        match value::TypedView::from_unknown(env, value)? {
            Some(view) => Ok(ffi::Stash::Storage(owned_view_storage(&view))),
            None => self.encode(env, value),
        }
    }

    reject_return_codec!("Buffer");
}

impl Decoder for BufferCodec {}

impl PtrWriter for BufferCodec {}

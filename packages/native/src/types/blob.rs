use anyhow::bail;

use super::prelude::*;

/// Raw memory argument: an `ArrayBufferView`'s backing store, a numeric
/// address/offset, or NULL.
///
/// Exists for C parameters typed `const void *` / `void *` whose
/// interpretation — host pointer or integer offset — depends on runtime state,
/// OpenGL's buffer-object protocol being the canonical case. The encoded
/// pointer is passed verbatim: a view hands over its backing store zero-copy
/// (callee writes land directly in the JavaScript buffer), a number is
/// reinterpreted as a pointer-wide integer, and null/undefined become NULL.
/// Blob values carry no decodable representation, so the type is
/// argument-only ([`super::Type::can_be_return_type`] rejects it as a return
/// type and [`super::RefType::supports_inner`] as a `Ref` inner type).
#[derive(Debug, Clone, Copy)]
pub struct BlobType;

const MAX_SAFE_INTEGER: f64 = 9_007_199_254_740_992.0;

impl BlobType {
    /// Reinterprets a JS number as a pointer-wide address or offset,
    /// rejecting values a `usize` cannot represent exactly.
    fn address_from_number(value: f64) -> anyhow::Result<*mut c_void> {
        if !value.is_finite() || value.fract() != 0.0 || !(0.0..=MAX_SAFE_INTEGER).contains(&value)
        {
            bail!(
                "Blob address {value} is not a non-negative integer within [0, {MAX_SAFE_INTEGER}]"
            );
        }
        Ok(value as usize as *mut c_void)
    }
}

impl FfiEncoder for BlobType {
    fn encode(&self, value: &value::Value, _optional: bool) -> anyhow::Result<ffi::FfiValue> {
        match value {
            value::Value::BufferView(view) => {
                anyhow::ensure!(
                    !view.is_shared(),
                    "SharedArrayBuffer-backed views cannot cross the FFI boundary"
                );
                Ok(ffi::FfiValue::Ptr(view.ptr()))
            }
            value::Value::Number(n) => Ok(ffi::FfiValue::Ptr(Self::address_from_number(*n)?)),
            value::Value::Null | value::Value::Undefined => {
                Ok(ffi::FfiValue::Ptr(std::ptr::null_mut()))
            }
            _ => bail!("Expected an ArrayBufferView, number, or null for blob type, got {value:?}"),
        }
    }

    arg_only_call_cif!("Blob types");
}

impl FfiDecoder for BlobType {}

impl RawPtrCodec for BlobType {}

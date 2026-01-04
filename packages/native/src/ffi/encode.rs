//! Encoding and decoding traits for FFI values.
//!
//! Defines the [`FfiEncode`] and [`FfiDecode`] traits that type descriptors
//! implement to convert between JavaScript values and FFI representations.

use super::value::FfiValue;
use crate::arg::Arg;
use crate::value;

pub trait FfiEncode {
    fn encode(&self, value: &value::Value, optional: bool) -> anyhow::Result<FfiValue>;
}

pub trait FfiDecode {
    fn decode(&self, ffi_value: &FfiValue) -> anyhow::Result<value::Value>;

    fn decode_with_context(
        &self,
        ffi_value: &FfiValue,
        ffi_args: &[FfiValue],
        args: &[Arg],
    ) -> anyhow::Result<value::Value> {
        let _ = (ffi_args, args);
        self.decode(ffi_value)
    }
}

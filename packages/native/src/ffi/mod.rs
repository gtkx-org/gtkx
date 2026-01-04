//! FFI value encoding and decoding.
//!
//! This module provides the infrastructure for converting between JavaScript values
//! and FFI-compatible representations. It handles encoding values for native calls
//! and decoding return values back to JavaScript.
//!
//! # Key Components
//!
//! - [`FfiValue`]: Raw FFI-compatible value representation
//! - [`FfiEncode`]: Trait for encoding JavaScript values to FFI
//! - [`FfiDecode`]: Trait for decoding FFI values to JavaScript
//! - [`FfiStorage`]: Temporary storage for FFI call arguments

mod encode;
mod storage;
mod value;

pub use encode::{FfiDecode, FfiEncode};
pub use storage::{FfiStorage, FfiStorageKind, HashTableData, HashTableStorage};
pub use value::{FfiValue, TrampolineCallbackValue};

use crate::arg::Arg;

impl TryFrom<Arg> for FfiValue {
    type Error = anyhow::Error;

    fn try_from(arg: Arg) -> anyhow::Result<Self> {
        arg.ty.encode(&arg.value, arg.optional)
    }
}

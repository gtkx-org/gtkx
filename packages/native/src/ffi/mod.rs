//! FFI value encoding and decoding.
//!
//! This module provides the infrastructure for converting between JavaScript values
//! and FFI-compatible representations. It handles encoding values for native calls
//! and decoding return values back to JavaScript.
//!
//! # Key Components
//!
//! - [`FfiValue`]: Raw FFI-compatible value representation
//! - [`FfiStorage`]: Temporary storage for FFI call arguments

mod storage;
mod value;

pub use storage::{
    FfiStorage, FfiStorageKind, GArrayData, GByteArrayData, GListData, GSListData, HashTableData,
    StringGListData, StringGSListData,
};
pub use value::{FfiValue, TrampolineValue};

use crate::arg::Arg;
use crate::types::FfiEncoder as _;

impl TryFrom<Arg> for FfiValue {
    type Error = anyhow::Error;

    fn try_from(arg: Arg) -> anyhow::Result<Self> {
        arg.ty.encode(&arg.value, arg.optional)
    }
}

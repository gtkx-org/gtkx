//! FFI value encoding and decoding.
//!
//! Converts between JavaScript values and FFI-compatible representations:
//! encoding values for native calls and decoding return values back to
//! JavaScript.

mod storage;
mod value;

pub use storage::{
    FfiStorage, FfiStorageKind, GArrayData, GListData, GSListData, HashTableData, PendingRelease,
    PendingTransfer, StringGListData, StringGSListData,
};
pub use value::{FfiValue, TrampolineValue};

use crate::arg::Arg;
use crate::types::FfiEncoder as _;

impl TryFrom<Arg> for FfiValue {
    type Error = anyhow::Error;

    fn try_from(arg: Arg) -> anyhow::Result<Self> {
        arg.ty.encode(&arg.value)
    }
}

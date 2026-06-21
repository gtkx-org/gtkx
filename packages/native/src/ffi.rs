mod storage;
mod value;

pub use storage::{
    FfiStorage, FfiStorageKind, GArrayData, GListFlavor, GSListFlavor, HashTableData, ListFlavor,
    PendingRelease, PendingTransfer,
};
#[cfg(feature = "test-support")]
pub use storage::{GListData, GSListData, StringGListData, StringGSListData};
pub use value::{CallbackValue, FfiValue};

use crate::arg::Arg;
use crate::types::FfiEncoder as _;

impl TryFrom<Arg> for FfiValue {
    type Error = anyhow::Error;

    fn try_from(arg: Arg) -> anyhow::Result<Self> {
        arg.ty.encode(&arg.value)
    }
}

test_visible_modules! {
    arg,
    callback,
    descriptors,
    library_cache,
    value,
}

mod stash;
mod stashed_value;

pub use stash::{
    Stash, StashKind, GArrayData, GListFlavor, GSListFlavor, HashTableData, ListFlavor,
    PendingRelease, PendingTransfer,
};
#[cfg(feature = "test-support")]
pub use stash::{GListData, GSListData, StringGListData, StringGSListData};
pub use stashed_value::{CallbackValue, StashedValue};

use crate::ffi::arg::Arg;
use crate::ffi::descriptors::FfiEncoder as _;

impl TryFrom<Arg> for StashedValue {
    type Error = anyhow::Error;

    fn try_from(arg: Arg) -> anyhow::Result<Self> {
        arg.ty.encode(&arg.value)
    }
}

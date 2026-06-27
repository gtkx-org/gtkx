pub mod arg;
pub mod callback;
pub mod descriptor;
pub mod library_cache;
pub mod value;

mod stash;
mod stashed_value;

pub use stash::{
    GArrayData, GListFlavor, GSListFlavor, HashTableData, ListFlavor, PendingRelease,
    PendingTransfer, Stash, StashKind,
};
pub use stash::{GListData, GSListData, StringGListData, StringGSListData};
pub use stashed_value::{CallbackValue, StashedValue};

use crate::ffi::arg::Arg;
use crate::ffi::descriptor::FfiEncoder as _;

impl TryFrom<Arg> for StashedValue {
    type Error = anyhow::Error;

    fn try_from(arg: Arg) -> anyhow::Result<Self> {
        arg.descriptor.encode(&arg.value)
    }
}

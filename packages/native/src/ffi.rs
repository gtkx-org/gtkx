pub mod callback;
pub mod codec;
pub mod descriptor;
pub mod library_cache;
pub mod value;

mod slot;
mod stash;
mod stashed_value;

pub use slot::Slot;

pub use stash::{
    AcquiredTransfers, GArrayData, GListFlavor, GSListFlavor, HashTableData, ListFlavor,
    PendingRelease, PendingTransfer, Stash, StashKind,
};
pub use stash::{GListData, GSListData, StringGListData, StringGSListData};
pub use stashed_value::{CallbackValue, StashedValue};

use crate::ffi::codec::Codec;
use crate::ffi::codec::Encoder as _;
use crate::ffi::value::Value;

#[derive(Debug, Clone)]
pub struct Arg {
    pub codec: Codec,
    pub value: Value,
}

impl Arg {
    pub fn new(codec: Codec, value: Value) -> Self {
        Self { codec, value }
    }
}

impl TryFrom<Arg> for StashedValue {
    type Error = anyhow::Error;

    fn try_from(arg: Arg) -> anyhow::Result<Self> {
        arg.codec.encode(&arg.value)
    }
}

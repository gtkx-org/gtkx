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
    GArrayData, GLIST_OPS, GSLIST_OPS, ListData, ListOps, ListPayload, PendingRelease,
    PendingTransfer, Stash, StashStorage, build_list,
};
pub use stashed_value::{CallbackValue, StashedValue};

pub mod callback;
pub mod codec;
pub mod descriptor;
pub mod library_cache;
pub mod value;

mod slot;
mod stash;
mod stash_storage;

pub use slot::Slot;

pub use stash::{CallbackValue, Stash};
pub use stash_storage::{
    GArrayData, GLIST_OPS, GSLIST_OPS, ListData, ListOps, ListPayload, PendingRelease,
    PendingTransfer, StashData, StashStorage, build_list,
};

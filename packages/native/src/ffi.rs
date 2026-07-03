pub mod closure;
pub mod codec;
pub mod descriptor;
pub mod library_cache;
pub mod value;

mod slot;
mod stash;

pub use slot::Slot;

pub use stash::{
    CallbackValue, GArrayData, GLIST_OPS, GSLIST_OPS, ListData, ListOps, ListPayload,
    PendingTransfer, ReleaseKind, Stash, StashData, StashStorage, build_list,
};

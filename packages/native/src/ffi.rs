pub mod closure;
pub mod codec;
pub mod descriptor;
pub mod library_cache;

mod slot;
mod stash;

pub use slot::Slot;
pub use stash::{
    CallbackValue, CallerAllocation, GArrayData, GLIST_OPS, GPtrArrayData, GSLIST_OPS,
    HashTableData, ListData, ListNode, ListOps, ListPayload, PendingTransfer, ReleaseKind, Stash,
    StashData, StashStorage, build_list,
};

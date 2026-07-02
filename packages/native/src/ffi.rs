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

use std::ffi::c_void;

/// Copies `len` bytes from `src` into a freshly `g_malloc`-ed block, returning the
/// new block. The caller owns the result and must release it with `g_free` (or hand
/// it to a callee that takes ownership).
///
/// # Safety
/// `src` must be valid for reads of `len` bytes.
pub(crate) unsafe fn dup_to_glib_heap(src: *const u8, len: usize) -> *mut c_void {
    unsafe { glib::ffi::g_memdup2(src.cast(), len) }
}

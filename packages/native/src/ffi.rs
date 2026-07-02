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
    AcquiredTransfers, GArrayData, GListKind, GSListKind, HashTableData, ListKind, PendingRelease,
    PendingTransfer, Stash, StashStorage,
};
pub use stash::{GListData, GSListData, StringGListData, StringGSListData};
pub use stashed_value::{CallbackValue, StashedValue};

use std::ffi::c_void;

use crate::ffi::codec::Codec;
use crate::ffi::codec::Encoder as _;
use crate::ffi::value::Value;

/// Copies `len` bytes from `src` into a freshly `g_malloc`-ed block, returning the
/// new block. The caller owns the result and must release it with `g_free` (or hand
/// it to a callee that takes ownership).
///
/// # Safety
/// `src` must be valid for reads of `len` bytes.
pub(crate) unsafe fn dup_to_glib_heap(src: *const u8, len: usize) -> *mut c_void {
    unsafe { glib::ffi::g_memdup2(src.cast(), len) }
}

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

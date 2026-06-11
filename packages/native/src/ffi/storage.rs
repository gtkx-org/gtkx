//! Argument-lifetime storage for encoded FFI values.
//!
//! An [`FfiStorage`] keeps whatever backing memory an encoded argument needs
//! alive for the duration of one native call: staging buffers, `GLib`
//! containers, retained `CString`s, out-parameter slots. Its `ptr` is the
//! address handed to libffi; its [`FfiStorageKind`] decides what `Drop`
//! releases. The recurring `should_free` flag means "this storage still owns
//! the `GLib` container when it drops" — it is `false` exactly when the
//! callee took the container per the descriptor's transfer mode.

use std::cell::Cell;
use std::ffi::c_void;

use gtk4::glib;
use gtk4::glib::translate::IntoGlib as _;

use crate::managed::UnrefFn;
use crate::types::IntegerKind;

/// Backing memory for one encoded argument, dropped after the native call.
pub struct FfiStorage {
    ptr: *mut c_void,
    kind: FfiStorageKind,
    pending_transfer: Cell<Option<PendingTransfer>>,
}

impl std::fmt::Debug for FfiStorage {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("FfiStorage")
            .field("ptr", &self.ptr)
            .field("kind", &self.kind)
            .finish_non_exhaustive()
    }
}

/// Ownership a transfer-full argument encoder paid up front.
///
/// Covers a duplicated string, a boxed copy, an added object reference, or a
/// container built for the callee. The storage releases it on drop unless the
/// native call actually happened
/// ([`FfiStorage::disarm_pending_transfer`]), at which point the callee owns
/// it.
#[derive(Debug, Clone)]
pub struct PendingTransfer {
    ptr: *mut c_void,
    release: PendingRelease,
}

/// How a [`PendingTransfer`] releases the ownership it guards.
#[derive(Debug, Clone)]
pub enum PendingRelease {
    GFree,
    ObjectUnref,
    BoxedFree(glib::Type),
    Fundamental(UnrefFn),
    StrFreeV,
    /// Frees the GLib-allocated strings of a NULL-terminated pointer block
    /// whose container itself is caller-owned.
    StringElements,
    HashTableUnref,
    GArrayUnref,
    GByteArrayUnref,
    /// Frees a `GList` spine with `g_list_free`, leaving elements untouched.
    ListSpineFree,
    /// Frees a `GSList` spine with `g_slist_free`, leaving elements
    /// untouched.
    SListSpineFree,
    /// One release per element acquisition plus the container, fired
    /// together when the call never happens — the shape of a transfer-full
    /// container argument whose elements were individually referenced,
    /// copied, or duplicated.
    Group(Vec<PendingTransfer>),
}

impl PendingTransfer {
    /// Pairs an acquired pointer with its release, for grouped arming or for
    /// an encoder unwinding a partial build.
    #[must_use]
    pub fn new(ptr: *mut c_void, release: PendingRelease) -> Self {
        Self { ptr, release }
    }

    /// Releases the guarded ownership immediately — the unwind path of an
    /// encoder that fails mid-build after acquiring per-element ownership.
    pub fn release_now(self) {
        self.release();
    }

    fn release(self) {
        if self.ptr.is_null() {
            return;
        }
        // SAFETY: The transfer guards the one ownership the encode stage
        // acquired over `ptr`; release consumes `self`, so it runs exactly
        // once with the matching destructor.
        unsafe {
            match self.release {
                PendingRelease::GFree => glib::ffi::g_free(self.ptr),
                PendingRelease::ObjectUnref => {
                    glib::gobject_ffi::g_object_unref(self.ptr as *mut glib::gobject_ffi::GObject);
                }
                PendingRelease::BoxedFree(gtype) => {
                    glib::gobject_ffi::g_boxed_free(gtype.into_glib(), self.ptr);
                }
                PendingRelease::Fundamental(unref) => unref(self.ptr),
                PendingRelease::StrFreeV => {
                    glib::ffi::g_strfreev(self.ptr as *mut *mut std::ffi::c_char);
                }
                PendingRelease::StringElements => {
                    let mut slot = self.ptr as *mut *mut std::ffi::c_char;
                    while !(*slot).is_null() {
                        glib::ffi::g_free((*slot).cast());
                        slot = slot.add(1);
                    }
                }
                PendingRelease::HashTableUnref => {
                    glib::ffi::g_hash_table_unref(self.ptr as *mut glib::ffi::GHashTable);
                }
                PendingRelease::GArrayUnref => {
                    glib::ffi::g_array_unref(self.ptr as *mut glib::ffi::GArray);
                }
                PendingRelease::GByteArrayUnref => {
                    glib::ffi::g_byte_array_unref(self.ptr as *mut glib::ffi::GByteArray);
                }
                PendingRelease::ListSpineFree => {
                    glib::ffi::g_list_free(self.ptr as *mut glib::ffi::GList);
                }
                PendingRelease::SListSpineFree => {
                    glib::ffi::g_slist_free(self.ptr as *mut glib::ffi::GSList);
                }
                PendingRelease::Group(entries) => {
                    for entry in entries {
                        entry.release();
                    }
                }
            }
        }
    }
}

/// A `GList` of handle elements: the handles keep the elements alive for the
/// call; `should_free` releases the spine with `g_list_free` on drop.
#[derive(Debug)]
pub struct GListData {
    pub handles: Vec<crate::managed::NativeHandle>,
    pub list_ptr: *mut glib::ffi::GList,
    pub should_free: bool,
}

/// A `GSList` of handle elements; see [`GListData`].
#[derive(Debug)]
pub struct GSListData {
    pub handles: Vec<crate::managed::NativeHandle>,
    pub list_ptr: *mut glib::ffi::GSList,
    pub should_free: bool,
}

/// A `GList` of string elements.
///
/// `elements_duped` records whether the list nodes point at GLib-allocated
/// duplicates (freed with `g_list_free_full` when `should_free`) or borrow
/// the retained `strings` (spine-only `g_list_free`).
#[derive(Debug)]
pub struct StringGListData {
    pub strings: Vec<std::ffi::CString>,
    pub list_ptr: *mut glib::ffi::GList,
    pub should_free: bool,
    pub elements_duped: bool,
}

/// A `GSList` of string elements; see [`StringGListData`].
#[derive(Debug)]
pub struct StringGSListData {
    pub strings: Vec<std::ffi::CString>,
    pub list_ptr: *mut glib::ffi::GSList,
    pub should_free: bool,
    pub elements_duped: bool,
}

/// A built `GArray`, unreffed on drop when `should_free`. Element cleanup is
/// the array's own clear function, installed at construction.
#[derive(Debug)]
pub struct GArrayData {
    pub array_ptr: *mut glib::ffi::GArray,
    pub should_free: bool,
}

/// A built `GHashTable`, unreffed on drop when `should_free`. Entry cleanup
/// is the table's own destroy notifies, installed at construction.
#[derive(Debug)]
pub struct HashTableData {
    pub handle: *mut glib::ffi::GHashTable,
    pub should_free: bool,
}

/// What an [`FfiStorage`] owns, deciding the release its `Drop` performs.
///
/// The numeric `*Vec` variants, `StringArray`/`ObjectArray`, `CString`,
/// `Buffer`, `PtrStorage`, and `StrV` own plain Rust or `glib` allocations
/// whose own destructors suffice; the `GLib`-container variants carry the
/// flags documented on their data structs.
#[derive(Debug)]
pub enum FfiStorageKind {
    /// No backing memory of its own: `ptr` points at memory owned elsewhere
    /// (or deliberately leaked to the callee).
    Unit,
    U8Vec(Vec<u8>),
    I8Vec(Vec<i8>),
    U16Vec(Vec<u16>),
    I16Vec(Vec<i16>),
    U32Vec(Vec<u32>),
    I32Vec(Vec<i32>),
    U64Vec(Vec<u64>),
    I64Vec(Vec<i64>),
    F32Vec(Vec<f32>),
    F64Vec(Vec<f64>),
    StringArray(Vec<std::ffi::CString>, Vec<*mut c_void>),
    ObjectArray(Vec<crate::managed::NativeHandle>, Vec<*mut c_void>),
    GList(GListData),
    GSList(GSListData),
    StringGList(StringGListData),
    StringGSList(StringGSListData),
    CString(std::ffi::CString),
    GArray(GArrayData),
    GByteArray(Option<glib::ByteArray>),
    Buffer(Vec<u8>),
    PtrStorage(Vec<*mut c_void>),
    StrV(glib::StrV),
    HashTable(HashTableData),
}

impl FfiStorage {
    pub fn new(ptr: *mut c_void, kind: FfiStorageKind) -> Self {
        Self {
            ptr,
            kind,
            pending_transfer: Cell::new(None),
        }
    }

    pub fn unit(ptr: *mut c_void) -> Self {
        Self::new(ptr, FfiStorageKind::Unit)
    }

    /// Arms the storage with ownership the encoder paid up front, to be
    /// released on drop unless [`Self::disarm_pending_transfer`] runs first.
    #[must_use]
    pub fn with_pending_transfer(self, ptr: *mut c_void, release: PendingRelease) -> Self {
        self.pending_transfer
            .set(Some(PendingTransfer { ptr, release }));
        self
    }

    /// Hands the armed ownership to the callee: the native call happened, so
    /// the transfer contract is fulfilled and drop must release nothing.
    pub fn disarm_pending_transfer(&self) {
        self.pending_transfer.set(None);
    }

    #[inline]
    #[must_use]
    pub fn ptr(&self) -> *mut c_void {
        self.ptr
    }

    #[inline]
    #[must_use]
    pub fn ptr_ref(&self) -> &*mut c_void {
        &self.ptr
    }

    #[must_use]
    pub fn kind(&self) -> &FfiStorageKind {
        &self.kind
    }

    pub fn as_numeric_slice(&self, int_kind: IntegerKind) -> anyhow::Result<Vec<f64>> {
        macro_rules! dispatch {
            ($($variant:ident : $ty:ident : $vec_variant:ident),+ $(,)?) => {
                match (&self.kind, int_kind) {
                    $((FfiStorageKind::$vec_variant(v), IntegerKind::$variant) => {
                        Ok(v.iter().map(|&x| x as f64).collect())
                    }),+
                    _ => anyhow::bail!("FfiStorage does not match integer kind {:?}", int_kind),
                }
            };
        }
        with_integer_kinds!(dispatch)
    }

    pub fn as_f32_slice(&self) -> anyhow::Result<&[f32]> {
        match &self.kind {
            FfiStorageKind::F32Vec(v) => Ok(v),
            _ => anyhow::bail!("FfiStorage does not contain f32 data"),
        }
    }

    pub fn as_f64_slice(&self) -> anyhow::Result<&[f64]> {
        match &self.kind {
            FfiStorageKind::F64Vec(v) => Ok(v),
            _ => anyhow::bail!("FfiStorage does not contain f64 data"),
        }
    }

    pub fn as_cstring_array(&self) -> anyhow::Result<&Vec<std::ffi::CString>> {
        match &self.kind {
            FfiStorageKind::StringArray(strings, _) => Ok(strings),
            _ => anyhow::bail!("FfiStorage does not contain string array data"),
        }
    }

    pub fn as_bool_slice(&self) -> anyhow::Result<&[i32]> {
        match &self.kind {
            FfiStorageKind::I32Vec(v) => Ok(v),
            _ => anyhow::bail!("FfiStorage does not contain bool/i32 data"),
        }
    }

    pub fn as_object_array(&self) -> anyhow::Result<&Vec<crate::managed::NativeHandle>> {
        match &self.kind {
            FfiStorageKind::ObjectArray(ids, _) => Ok(ids),
            _ => anyhow::bail!("FfiStorage does not contain object array data"),
        }
    }
}

/// Frees a `GList`/`GSList` of duplicated string elements, dispatching to the
/// `_free_full` or plain `_free` variant based on whether the elements were
/// duplicated on the way in.
///
/// `is_null` and the two closures carry the list-type-specific bindings the
/// caller already has in hand; this helper only owns the branching.
fn free_string_list<F, G>(
    should_free: bool,
    is_null: bool,
    elements_duped: bool,
    free_full: F,
    free_simple: G,
) where
    F: FnOnce(),
    G: FnOnce(),
{
    if !should_free || is_null {
        return;
    }
    if elements_duped {
        free_full();
    } else {
        free_simple();
    }
}

impl FfiStorage {
    fn drop_string_glist(data: &StringGListData) {
        free_string_list(
            data.should_free,
            data.list_ptr.is_null(),
            data.elements_duped,
            // SAFETY: The storage owns the list it built, and duplicated
            // elements are g_malloc'd strings nothing else owns.
            || unsafe { glib::ffi::g_list_free_full(data.list_ptr, Some(glib::ffi::g_free)) },
            // SAFETY: The storage owns the list it built; the elements
            // stay owned by the retained CStrings.
            || unsafe { glib::ffi::g_list_free(data.list_ptr) },
        );
    }

    fn drop_string_gslist(data: &StringGSListData) {
        free_string_list(
            data.should_free,
            data.list_ptr.is_null(),
            data.elements_duped,
            // SAFETY: The storage owns the list it built, and duplicated
            // elements are g_malloc'd strings nothing else owns.
            || unsafe { glib::ffi::g_slist_free_full(data.list_ptr, Some(glib::ffi::g_free)) },
            // SAFETY: The storage owns the list it built; the elements
            // stay owned by the retained CStrings.
            || unsafe { glib::ffi::g_slist_free(data.list_ptr) },
        );
    }
    fn drop_hash_table(data: &HashTableData) {
        if data.should_free && !data.handle.is_null() {
            // SAFETY: `should_free` marks the storage as holding the one
            // reference the encode created.
            unsafe { glib::ffi::g_hash_table_unref(data.handle) };
        }
    }

    fn drop_glist(data: &GListData) {
        if data.should_free && !data.list_ptr.is_null() {
            // SAFETY: `should_free` marks the storage as owning the list
            // it built; the elements stay owned by the retained handles.
            unsafe { glib::ffi::g_list_free(data.list_ptr) };
        }
    }

    fn drop_gslist(data: &GSListData) {
        if data.should_free && !data.list_ptr.is_null() {
            // SAFETY: `should_free` marks the storage as owning the list
            // it built; the elements stay owned by the retained handles.
            unsafe { glib::ffi::g_slist_free(data.list_ptr) };
        }
    }

    fn drop_garray(data: &GArrayData) {
        if data.should_free && !data.array_ptr.is_null() {
            // SAFETY: `should_free` marks the storage as holding the one
            // reference the encode created.
            unsafe { glib::ffi::g_array_unref(data.array_ptr) };
        }
    }
}

impl Drop for FfiStorage {
    fn drop(&mut self) {
        if let Some(pending) = self.pending_transfer.take() {
            pending.release();
        }
        match &self.kind {
            FfiStorageKind::HashTable(data) => Self::drop_hash_table(data),
            FfiStorageKind::GList(data) => Self::drop_glist(data),
            FfiStorageKind::GSList(data) => Self::drop_gslist(data),
            FfiStorageKind::GArray(data) => Self::drop_garray(data),
            FfiStorageKind::StringGList(data) => Self::drop_string_glist(data),
            FfiStorageKind::StringGSList(data) => Self::drop_string_gslist(data),
            FfiStorageKind::GByteArray(_)
            | FfiStorageKind::Unit
            | FfiStorageKind::U8Vec(_)
            | FfiStorageKind::I8Vec(_)
            | FfiStorageKind::U16Vec(_)
            | FfiStorageKind::I16Vec(_)
            | FfiStorageKind::U32Vec(_)
            | FfiStorageKind::I32Vec(_)
            | FfiStorageKind::U64Vec(_)
            | FfiStorageKind::I64Vec(_)
            | FfiStorageKind::F32Vec(_)
            | FfiStorageKind::F64Vec(_)
            | FfiStorageKind::StringArray(_, _)
            | FfiStorageKind::ObjectArray(_, _)
            | FfiStorageKind::CString(_)
            | FfiStorageKind::Buffer(_)
            | FfiStorageKind::PtrStorage(_)
            | FfiStorageKind::StrV(_) => {}
        }
    }
}

macro_rules! impl_ffi_storage_from_integer_vecs {
    ($($variant:ident : $ty:ident : $vec_variant:ident),+ $(,)?) => {
        $(
            impl From<Vec<$ty>> for FfiStorage {
                fn from(mut vec: Vec<$ty>) -> Self {
                    let ptr = vec.as_mut_ptr() as *mut c_void;
                    Self::new(ptr, FfiStorageKind::$vec_variant(vec))
                }
            }
        )+
    };
}
with_integer_kinds!(impl_ffi_storage_from_integer_vecs);

impl From<Vec<f32>> for FfiStorage {
    fn from(mut vec: Vec<f32>) -> Self {
        let ptr = vec.as_mut_ptr() as *mut c_void;
        Self::new(ptr, FfiStorageKind::F32Vec(vec))
    }
}

impl From<Vec<f64>> for FfiStorage {
    fn from(mut vec: Vec<f64>) -> Self {
        let ptr = vec.as_mut_ptr() as *mut c_void;
        Self::new(ptr, FfiStorageKind::F64Vec(vec))
    }
}

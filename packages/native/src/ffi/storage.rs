use std::cell::Cell;
use std::ffi::c_void;

use glib::translate::IntoGlib as _;

use crate::managed::UnrefFn;
use crate::types::{BigIntKind, IntegerKind};

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

#[derive(Debug, Clone)]
pub struct PendingTransfer {
    ptr: *mut c_void,
    release: PendingRelease,
}

#[derive(Debug, Clone)]
pub enum PendingRelease {
    GFree,
    ObjectUnref,
    BoxedFree(glib::Type),
    Fundamental(UnrefFn),
    StrFreeV,
    StringElements,
    HashTableUnref,
    GArrayUnref,
    GByteArrayUnref,
    ListSpineFree,
    SListSpineFree,
    Group(Vec<PendingTransfer>),
}

impl PendingTransfer {
    #[must_use]
    pub fn new(ptr: *mut c_void, release: PendingRelease) -> Self {
        Self { ptr, release }
    }

    pub fn release_now(self) {
        self.release();
    }

    fn release(self) {
        if self.ptr.is_null() {
            return;
        }
        // SAFETY: `self.ptr` is non-null (checked above) and, by construction of the matching
        // `PendingRelease` variant when this transfer was armed, points to an owned value of the
        // type each free function expects (a g_malloc block, a GObject, a boxed value of `gtype`,
        // a fundamental, a NULL-terminated `char*` array, a GHashTable/GArray/GByteArray, or a
        // GList/GSList spine). This release consumes `self` so each owned value is freed exactly
        // once on the gtkx-glib thread.
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
                    // `self.ptr` is a NULL-terminated array of owned `char*`; walk it freeing each
                    // string until the terminator, which the loop guard never dereferences past.
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

#[derive(Debug)]
pub struct GListData {
    pub handles: Vec<crate::managed::NativeHandle>,
    pub list_ptr: *mut glib::ffi::GList,
    pub should_free: bool,
}

#[derive(Debug)]
pub struct GSListData {
    pub handles: Vec<crate::managed::NativeHandle>,
    pub list_ptr: *mut glib::ffi::GSList,
    pub should_free: bool,
}

#[derive(Debug)]
pub struct StringGListData {
    pub strings: Vec<std::ffi::CString>,
    pub list_ptr: *mut glib::ffi::GList,
    pub should_free: bool,
    pub elements_duped: bool,
}

#[derive(Debug)]
pub struct StringGSListData {
    pub strings: Vec<std::ffi::CString>,
    pub list_ptr: *mut glib::ffi::GSList,
    pub should_free: bool,
    pub elements_duped: bool,
}

pub trait ListFlavor {
    type Spine;
    const LABEL: &'static str;

    /// Prepends `ptr` to a `GLib` singly/doubly linked list and returns the new head.
    ///
    /// # Safety
    ///
    /// `list` must be null or a valid spine pointer of this flavor owned by the caller, and `ptr`
    /// the element pointer to store; the returned head transfers ownership of the extended spine.
    unsafe fn prepend(list: *mut Self::Spine, ptr: *mut c_void) -> *mut Self::Spine;

    /// Frees the list spine only, leaving element pointers untouched.
    ///
    /// # Safety
    ///
    /// `list` must be a valid spine pointer of this flavor owned by the caller; after this call
    /// the spine is freed and must not be used again.
    unsafe fn free_spine(list: *mut Self::Spine);

    /// Frees the list spine and `g_free`s each element pointer it holds.
    ///
    /// # Safety
    ///
    /// `list` must be a valid spine pointer of this flavor owned by the caller whose elements are
    /// individually `g_free`-able; after this call both spine and elements are freed.
    unsafe fn free_spine_full(list: *mut Self::Spine);

    fn spine_release() -> PendingRelease;

    fn handle_storage(
        handles: Vec<crate::managed::NativeHandle>,
        list_ptr: *mut Self::Spine,
        should_free: bool,
    ) -> FfiStorageKind;

    fn string_storage(
        strings: Vec<std::ffi::CString>,
        list_ptr: *mut Self::Spine,
        should_free: bool,
        elements_duped: bool,
    ) -> FfiStorageKind;
}

#[derive(Debug)]
pub struct GListFlavor;
#[derive(Debug)]
pub struct GSListFlavor;

impl ListFlavor for GListFlavor {
    type Spine = glib::ffi::GList;
    const LABEL: &'static str = "GList";

    unsafe fn prepend(list: *mut glib::ffi::GList, ptr: *mut c_void) -> *mut glib::ffi::GList {
        // SAFETY: per the trait contract `list` is null or a valid GList owned by the caller;
        // `g_list_prepend` returns the new owning head.
        unsafe { glib::ffi::g_list_prepend(list, ptr) }
    }

    unsafe fn free_spine(list: *mut glib::ffi::GList) {
        // SAFETY: per the trait contract `list` is a valid caller-owned GList; freeing its spine
        // consumes that ownership.
        unsafe { glib::ffi::g_list_free(list) };
    }

    unsafe fn free_spine_full(list: *mut glib::ffi::GList) {
        // SAFETY: per the trait contract `list` is a valid caller-owned GList whose elements are
        // `g_free`-able; `g_list_free_full` frees each element then the spine.
        unsafe { glib::ffi::g_list_free_full(list, Some(glib::ffi::g_free)) };
    }

    fn spine_release() -> PendingRelease {
        PendingRelease::ListSpineFree
    }

    fn handle_storage(
        handles: Vec<crate::managed::NativeHandle>,
        list_ptr: *mut glib::ffi::GList,
        should_free: bool,
    ) -> FfiStorageKind {
        FfiStorageKind::GList(GListData {
            handles,
            list_ptr,
            should_free,
        })
    }

    fn string_storage(
        strings: Vec<std::ffi::CString>,
        list_ptr: *mut glib::ffi::GList,
        should_free: bool,
        elements_duped: bool,
    ) -> FfiStorageKind {
        FfiStorageKind::StringGList(StringGListData {
            strings,
            list_ptr,
            should_free,
            elements_duped,
        })
    }
}

impl ListFlavor for GSListFlavor {
    type Spine = glib::ffi::GSList;
    const LABEL: &'static str = "GSList";

    unsafe fn prepend(list: *mut glib::ffi::GSList, ptr: *mut c_void) -> *mut glib::ffi::GSList {
        // SAFETY: per the trait contract `list` is null or a valid GSList owned by the caller;
        // `g_slist_prepend` returns the new owning head.
        unsafe { glib::ffi::g_slist_prepend(list, ptr) }
    }

    unsafe fn free_spine(list: *mut glib::ffi::GSList) {
        // SAFETY: per the trait contract `list` is a valid caller-owned GSList; freeing its spine
        // consumes that ownership.
        unsafe { glib::ffi::g_slist_free(list) };
    }

    unsafe fn free_spine_full(list: *mut glib::ffi::GSList) {
        // SAFETY: per the trait contract `list` is a valid caller-owned GSList whose elements are
        // `g_free`-able; `g_slist_free_full` frees each element then the spine.
        unsafe { glib::ffi::g_slist_free_full(list, Some(glib::ffi::g_free)) };
    }

    fn spine_release() -> PendingRelease {
        PendingRelease::SListSpineFree
    }

    fn handle_storage(
        handles: Vec<crate::managed::NativeHandle>,
        list_ptr: *mut glib::ffi::GSList,
        should_free: bool,
    ) -> FfiStorageKind {
        FfiStorageKind::GSList(GSListData {
            handles,
            list_ptr,
            should_free,
        })
    }

    fn string_storage(
        strings: Vec<std::ffi::CString>,
        list_ptr: *mut glib::ffi::GSList,
        should_free: bool,
        elements_duped: bool,
    ) -> FfiStorageKind {
        FfiStorageKind::StringGSList(StringGSListData {
            strings,
            list_ptr,
            should_free,
            elements_duped,
        })
    }
}

#[derive(Debug)]
pub struct GArrayData {
    pub array_ptr: *mut glib::ffi::GArray,
    pub should_free: bool,
}

#[derive(Debug)]
pub struct HashTableData {
    pub handle: *mut glib::ffi::GHashTable,
    pub should_free: bool,
}

#[derive(Debug)]
pub enum FfiStorageKind {
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

    #[must_use]
    pub fn with_pending_transfer(self, ptr: *mut c_void, release: PendingRelease) -> Self {
        self.pending_transfer
            .set(Some(PendingTransfer { ptr, release }));
        self
    }

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

    test_visible! {
    fn as_numeric_slice(&self, int_kind: IntegerKind) -> anyhow::Result<Vec<f64>> {
        match (&self.kind, int_kind) {
            (FfiStorageKind::I64Vec(v), IntegerKind::I64) => v
                .iter()
                .map(|&x| crate::types::lossless_f64(i128::from(x), "array element"))
                .collect(),
            (FfiStorageKind::U64Vec(v), IntegerKind::U64) => v
                .iter()
                .map(|&x| crate::types::lossless_f64(i128::from(x), "array element"))
                .collect(),
            _ => {
                macro_rules! dispatch {
                    ($($variant:ident : $ty:ident : $vec_variant:ident),+ $(,)?) => {
                        match (&self.kind, int_kind) {
                            $((FfiStorageKind::$vec_variant(v), IntegerKind::$variant) => {
                                Ok(v.iter().map(|&x| x as f64).collect())
                            }),+
                            _ => anyhow::bail!(
                                "FfiStorage does not match integer kind {:?}",
                                int_kind
                            ),
                        }
                    };
                }
                with_integer_kinds!(dispatch)
            }
        }
    }
    }

    test_visible! {
    fn as_bigint_vec(&self, kind: BigIntKind) -> anyhow::Result<Vec<i128>> {
        match (&self.kind, kind) {
            (FfiStorageKind::I64Vec(v), BigIntKind::I64) => {
                Ok(v.iter().map(|&x| i128::from(x)).collect())
            }
            (FfiStorageKind::U64Vec(v), BigIntKind::U64) => {
                Ok(v.iter().map(|&x| i128::from(x)).collect())
            }
            _ => anyhow::bail!("FfiStorage does not match bigint kind {kind:?}"),
        }
    }
    }

    test_visible! {
    fn as_f32_slice(&self) -> anyhow::Result<&[f32]> {
        match &self.kind {
            FfiStorageKind::F32Vec(v) => Ok(v),
            _ => anyhow::bail!("FfiStorage does not contain f32 data"),
        }
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

    test_visible! {
    fn as_object_array(&self) -> anyhow::Result<&Vec<crate::managed::NativeHandle>> {
        match &self.kind {
            FfiStorageKind::ObjectArray(ids, _) => Ok(ids),
            _ => anyhow::bail!("FfiStorage does not contain object array data"),
        }
    }
    }
}

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

fn drop_handle_spine<F: ListFlavor>(list_ptr: *mut F::Spine, should_free: bool) {
    if should_free && !list_ptr.is_null() {
        // SAFETY: `list_ptr` is the non-null spine this storage owns and is freed at most once
        // here (gated by `should_free`); only the spine is freed because the handles own their
        // own GObject references separately.
        unsafe { F::free_spine(list_ptr) };
    }
}

fn drop_string_spine<F: ListFlavor>(
    list_ptr: *mut F::Spine,
    should_free: bool,
    elements_duped: bool,
) {
    free_string_list(
        should_free,
        list_ptr.is_null(),
        elements_duped,
        // SAFETY: `free_string_list` only invokes this closure when `should_free` is set and
        // `list_ptr` is non-null, so `list_ptr` is the valid spine this storage owns; this branch
        // runs when elements were duped (and so are owned here), freeing both elements and spine.
        || unsafe { F::free_spine_full(list_ptr) },
        // SAFETY: `free_string_list` only invokes this closure when `should_free` is set and
        // `list_ptr` is non-null, so `list_ptr` is the valid spine this storage owns; this branch
        // runs when elements are borrowed, freeing only the spine and leaving elements untouched.
        || unsafe { F::free_spine(list_ptr) },
    );
}

impl FfiStorage {
    fn drop_hash_table(data: &HashTableData) {
        if data.should_free && !data.handle.is_null() {
            // SAFETY: `data.handle` is the non-null GHashTable this storage owns, released once
            // here under the `should_free` gate.
            unsafe { glib::ffi::g_hash_table_unref(data.handle) };
        }
    }

    fn drop_garray(data: &GArrayData) {
        if data.should_free && !data.array_ptr.is_null() {
            // SAFETY: `data.array_ptr` is the non-null GArray this storage owns, released once
            // here under the `should_free` gate.
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
            FfiStorageKind::GList(data) => {
                drop_handle_spine::<GListFlavor>(data.list_ptr, data.should_free);
            }
            FfiStorageKind::GSList(data) => {
                drop_handle_spine::<GSListFlavor>(data.list_ptr, data.should_free);
            }
            FfiStorageKind::GArray(data) => Self::drop_garray(data),
            FfiStorageKind::StringGList(data) => {
                drop_string_spine::<GListFlavor>(
                    data.list_ptr,
                    data.should_free,
                    data.elements_duped,
                );
            }
            FfiStorageKind::StringGSList(data) => {
                drop_string_spine::<GSListFlavor>(
                    data.list_ptr,
                    data.should_free,
                    data.elements_duped,
                );
            }
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

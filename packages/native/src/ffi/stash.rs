use std::cell::Cell;
use std::ffi::c_void;

use glib::translate::IntoGlib as _;

use crate::ffi::descriptor::{BigIntKind, IntegerKind};
use crate::handle::UnrefFn;

pub struct Stash {
    ptr: *mut c_void,
    kind: StashKind,
    pending_transfer: Cell<Option<PendingTransfer>>,
}

impl std::fmt::Debug for Stash {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Stash")
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
    GListSpineFree,
    GSListSpineFree,
    Group(Vec<PendingTransfer>),
}

impl PendingTransfer {
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
                PendingRelease::GListSpineFree => {
                    glib::ffi::g_list_free(self.ptr as *mut glib::ffi::GList);
                }
                PendingRelease::GSListSpineFree => {
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
    pub handles: Vec<crate::handle::Handle>,
    pub list_ptr: *mut glib::ffi::GList,
    pub should_free: bool,
}

#[derive(Debug)]
pub struct GSListData {
    pub handles: Vec<crate::handle::Handle>,
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

    unsafe fn prepend(list: *mut Self::Spine, ptr: *mut c_void) -> *mut Self::Spine;

    unsafe fn free_spine(list: *mut Self::Spine);

    unsafe fn free_spine_full(list: *mut Self::Spine);

    fn spine_release() -> PendingRelease;

    fn handle_storage(
        handles: Vec<crate::handle::Handle>,
        list_ptr: *mut Self::Spine,
        should_free: bool,
    ) -> StashKind;

    fn string_storage(
        strings: Vec<std::ffi::CString>,
        list_ptr: *mut Self::Spine,
        should_free: bool,
        elements_duped: bool,
    ) -> StashKind;
}

#[derive(Debug)]
pub struct GListFlavor;
#[derive(Debug)]
pub struct GSListFlavor;

impl ListFlavor for GListFlavor {
    type Spine = glib::ffi::GList;
    const LABEL: &'static str = "GList";

    unsafe fn prepend(list: *mut glib::ffi::GList, ptr: *mut c_void) -> *mut glib::ffi::GList {
        unsafe { glib::ffi::g_list_prepend(list, ptr) }
    }

    unsafe fn free_spine(list: *mut glib::ffi::GList) {
        unsafe { glib::ffi::g_list_free(list) };
    }

    unsafe fn free_spine_full(list: *mut glib::ffi::GList) {
        unsafe { glib::ffi::g_list_free_full(list, Some(glib::ffi::g_free)) };
    }

    fn spine_release() -> PendingRelease {
        PendingRelease::GListSpineFree
    }

    fn handle_storage(
        handles: Vec<crate::handle::Handle>,
        list_ptr: *mut glib::ffi::GList,
        should_free: bool,
    ) -> StashKind {
        StashKind::GList(GListData {
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
    ) -> StashKind {
        StashKind::StringGList(StringGListData {
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
        unsafe { glib::ffi::g_slist_prepend(list, ptr) }
    }

    unsafe fn free_spine(list: *mut glib::ffi::GSList) {
        unsafe { glib::ffi::g_slist_free(list) };
    }

    unsafe fn free_spine_full(list: *mut glib::ffi::GSList) {
        unsafe { glib::ffi::g_slist_free_full(list, Some(glib::ffi::g_free)) };
    }

    fn spine_release() -> PendingRelease {
        PendingRelease::GSListSpineFree
    }

    fn handle_storage(
        handles: Vec<crate::handle::Handle>,
        list_ptr: *mut glib::ffi::GSList,
        should_free: bool,
    ) -> StashKind {
        StashKind::GSList(GSListData {
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
    ) -> StashKind {
        StashKind::StringGSList(StringGSListData {
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
pub enum StashKind {
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
    ObjectArray(Vec<crate::handle::Handle>, Vec<*mut c_void>),
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

impl Stash {
    pub fn new(ptr: *mut c_void, kind: StashKind) -> Self {
        Self {
            ptr,
            kind,
            pending_transfer: Cell::new(None),
        }
    }

    pub fn unit(ptr: *mut c_void) -> Self {
        Self::new(ptr, StashKind::Unit)
    }

    pub fn with_pending_transfer(self, ptr: *mut c_void, release: PendingRelease) -> Self {
        self.pending_transfer
            .set(Some(PendingTransfer { ptr, release }));
        self
    }

    pub fn disarm_pending_transfer(&self) {
        self.pending_transfer.set(None);
    }

    #[inline]
    pub fn ptr(&self) -> *mut c_void {
        self.ptr
    }

    #[inline]
    pub fn ptr_ref(&self) -> &*mut c_void {
        &self.ptr
    }

    pub fn kind(&self) -> &StashKind {
        &self.kind
    }

    pub fn as_numeric_slice(&self, int_kind: IntegerKind) -> anyhow::Result<Vec<f64>> {
        match (&self.kind, int_kind) {
            (StashKind::I64Vec(v), IntegerKind::I64) => v
                .iter()
                .map(|&x| crate::ffi::descriptor::lossless_f64(i128::from(x), "array element"))
                .collect(),
            (StashKind::U64Vec(v), IntegerKind::U64) => v
                .iter()
                .map(|&x| crate::ffi::descriptor::lossless_f64(i128::from(x), "array element"))
                .collect(),
            _ => {
                macro_rules! dispatch {
                    ($($variant:ident : $descriptor:ident : $vec_variant:ident),+ $(,)?) => {
                        match (&self.kind, int_kind) {
                            $((StashKind::$vec_variant(v), IntegerKind::$variant) => {
                                Ok(v.iter().map(|&x| x as f64).collect())
                            }),+
                            _ => anyhow::bail!(
                                "Stash does not match integer kind {:?}",
                                int_kind
                            ),
                        }
                    };
                }
                with_integer_kinds!(dispatch)
            }
        }
    }

    pub fn as_bigint_vec(&self, kind: BigIntKind) -> anyhow::Result<Vec<i128>> {
        match (&self.kind, kind) {
            (StashKind::I64Vec(v), BigIntKind::I64) => {
                Ok(v.iter().map(|&x| i128::from(x)).collect())
            }
            (StashKind::U64Vec(v), BigIntKind::U64) => {
                Ok(v.iter().map(|&x| i128::from(x)).collect())
            }
            _ => anyhow::bail!("Stash does not match bigint kind {kind:?}"),
        }
    }

    pub fn as_f32_slice(&self) -> anyhow::Result<&[f32]> {
        match &self.kind {
            StashKind::F32Vec(v) => Ok(v),
            _ => anyhow::bail!("Stash does not contain f32 data"),
        }
    }

    pub fn as_f64_slice(&self) -> anyhow::Result<&[f64]> {
        match &self.kind {
            StashKind::F64Vec(v) => Ok(v),
            _ => anyhow::bail!("Stash does not contain f64 data"),
        }
    }

    pub fn as_cstring_array(&self) -> anyhow::Result<&Vec<std::ffi::CString>> {
        match &self.kind {
            StashKind::StringArray(strings, _) => Ok(strings),
            _ => anyhow::bail!("Stash does not contain string array data"),
        }
    }

    pub fn as_bool_slice(&self) -> anyhow::Result<&[i32]> {
        match &self.kind {
            StashKind::I32Vec(v) => Ok(v),
            _ => anyhow::bail!("Stash does not contain bool/i32 data"),
        }
    }

    pub fn as_object_array(&self) -> anyhow::Result<&Vec<crate::handle::Handle>> {
        match &self.kind {
            StashKind::ObjectArray(ids, _) => Ok(ids),
            _ => anyhow::bail!("Stash does not contain object array data"),
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
        || unsafe { F::free_spine_full(list_ptr) },
        || unsafe { F::free_spine(list_ptr) },
    );
}

impl Stash {
    fn drop_hash_table(data: &HashTableData) {
        if data.should_free && !data.handle.is_null() {
            unsafe { glib::ffi::g_hash_table_unref(data.handle) };
        }
    }

    fn drop_garray(data: &GArrayData) {
        if data.should_free && !data.array_ptr.is_null() {
            unsafe { glib::ffi::g_array_unref(data.array_ptr) };
        }
    }
}

impl Drop for Stash {
    fn drop(&mut self) {
        if let Some(pending) = self.pending_transfer.take() {
            pending.release();
        }
        match &self.kind {
            StashKind::HashTable(data) => Self::drop_hash_table(data),
            StashKind::GList(data) => {
                drop_handle_spine::<GListFlavor>(data.list_ptr, data.should_free);
            }
            StashKind::GSList(data) => {
                drop_handle_spine::<GSListFlavor>(data.list_ptr, data.should_free);
            }
            StashKind::GArray(data) => Self::drop_garray(data),
            StashKind::StringGList(data) => {
                drop_string_spine::<GListFlavor>(
                    data.list_ptr,
                    data.should_free,
                    data.elements_duped,
                );
            }
            StashKind::StringGSList(data) => {
                drop_string_spine::<GSListFlavor>(
                    data.list_ptr,
                    data.should_free,
                    data.elements_duped,
                );
            }
            StashKind::GByteArray(_)
            | StashKind::Unit
            | StashKind::U8Vec(_)
            | StashKind::I8Vec(_)
            | StashKind::U16Vec(_)
            | StashKind::I16Vec(_)
            | StashKind::U32Vec(_)
            | StashKind::I32Vec(_)
            | StashKind::U64Vec(_)
            | StashKind::I64Vec(_)
            | StashKind::F32Vec(_)
            | StashKind::F64Vec(_)
            | StashKind::StringArray(_, _)
            | StashKind::ObjectArray(_, _)
            | StashKind::CString(_)
            | StashKind::Buffer(_)
            | StashKind::PtrStorage(_)
            | StashKind::StrV(_) => {}
        }
    }
}

macro_rules! impl_stash_from_integer_vecs {
    ($($variant:ident : $descriptor:ident : $vec_variant:ident),+ $(,)?) => {
        $(
            impl From<Vec<$descriptor>> for Stash {
                fn from(mut vec: Vec<$descriptor>) -> Self {
                    let ptr = vec.as_mut_ptr() as *mut c_void;
                    Self::new(ptr, StashKind::$vec_variant(vec))
                }
            }
        )+
    };
}
with_integer_kinds!(impl_stash_from_integer_vecs);

impl From<Vec<f32>> for Stash {
    fn from(mut vec: Vec<f32>) -> Self {
        let ptr = vec.as_mut_ptr() as *mut c_void;
        Self::new(ptr, StashKind::F32Vec(vec))
    }
}

impl From<Vec<f64>> for Stash {
    fn from(mut vec: Vec<f64>) -> Self {
        let ptr = vec.as_mut_ptr() as *mut c_void;
        Self::new(ptr, StashKind::F64Vec(vec))
    }
}

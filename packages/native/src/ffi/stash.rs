use std::cell::Cell;
use std::ffi::c_void;

use glib::translate::IntoGlib as _;

use crate::handle::UnrefFn;

pub struct Stash {
    ptr: *mut c_void,
    storage: StashStorage,
    pending_transfer: Cell<Vec<PendingTransfer>>,
}

impl std::fmt::Debug for Stash {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Stash")
            .field("ptr", &self.ptr)
            .field("storage", &self.storage)
            .finish_non_exhaustive()
    }
}

#[derive(Debug)]
pub struct PendingTransfer {
    ptr: *mut c_void,
    release: PendingRelease,
}

#[derive(Debug, Clone, Copy)]
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
    GListFree,
    GSListFree,
}

impl PendingTransfer {
    pub fn new(ptr: *mut c_void, release: PendingRelease) -> Self {
        Self { ptr, release }
    }

    pub fn release_now(self) {
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
                PendingRelease::GListFree => {
                    glib::ffi::g_list_free(self.ptr as *mut glib::ffi::GList);
                }
                PendingRelease::GSListFree => {
                    glib::ffi::g_slist_free(self.ptr as *mut glib::ffi::GSList);
                }
            }
        }
    }
}

#[derive(Debug)]
pub struct ListOps {
    pub label: &'static str,
    pub pending: PendingRelease,
    pub prepend: unsafe fn(*mut c_void, *mut c_void) -> *mut c_void,
    pub free: unsafe fn(*mut c_void),
    pub free_full: unsafe fn(*mut c_void),
}

unsafe fn glist_prepend(list: *mut c_void, data: *mut c_void) -> *mut c_void {
    unsafe { glib::ffi::g_list_prepend(list as *mut glib::ffi::GList, data).cast() }
}
unsafe fn glist_free(list: *mut c_void) {
    unsafe { glib::ffi::g_list_free(list as *mut glib::ffi::GList) };
}
unsafe fn glist_free_full(list: *mut c_void) {
    unsafe {
        glib::ffi::g_list_free_full(list as *mut glib::ffi::GList, Some(glib::ffi::g_free));
    }
}

unsafe fn gslist_prepend(list: *mut c_void, data: *mut c_void) -> *mut c_void {
    unsafe { glib::ffi::g_slist_prepend(list as *mut glib::ffi::GSList, data).cast() }
}
unsafe fn gslist_free(list: *mut c_void) {
    unsafe { glib::ffi::g_slist_free(list as *mut glib::ffi::GSList) };
}
unsafe fn gslist_free_full(list: *mut c_void) {
    unsafe {
        glib::ffi::g_slist_free_full(list as *mut glib::ffi::GSList, Some(glib::ffi::g_free));
    }
}

pub static GLIST_OPS: ListOps = ListOps {
    label: "GList",
    pending: PendingRelease::GListFree,
    prepend: glist_prepend,
    free: glist_free,
    free_full: glist_free_full,
};

pub static GSLIST_OPS: ListOps = ListOps {
    label: "GSList",
    pending: PendingRelease::GSListFree,
    prepend: gslist_prepend,
    free: gslist_free,
    free_full: gslist_free_full,
};

pub fn build_list(ops: &ListOps, ptrs: &[*mut c_void]) -> *mut c_void {
    let mut list: *mut c_void = std::ptr::null_mut();
    for ptr in ptrs.iter().rev() {
        list = unsafe { (ops.prepend)(list, *ptr) };
    }
    list
}

#[derive(Debug)]
pub enum ListPayload {
    Handles(Vec<crate::handle::Handle>),
    Strings {
        strings: Vec<std::ffi::CString>,
        elements_duped: bool,
    },
}

#[derive(Debug)]
pub struct ListData {
    pub ops: &'static ListOps,
    pub ptr: *mut c_void,
    pub should_free: bool,
    pub payload: ListPayload,
}

#[derive(Debug)]
pub struct GArrayData {
    pub ptr: *mut glib::ffi::GArray,
    pub should_free: bool,
}

#[derive(Debug)]
pub enum StashStorage {
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
    List(ListData),
    CString(std::ffi::CString),
    GArray(GArrayData),
    GByteArray(Option<glib::ByteArray>),
    Buffer(Vec<u8>),
    PtrSlot(Vec<*mut c_void>),
    StrV(glib::StrV),
    HashTable,
}

impl Stash {
    pub fn new(ptr: *mut c_void, storage: StashStorage) -> Self {
        Self {
            ptr,
            storage,
            pending_transfer: Cell::new(Vec::new()),
        }
    }

    pub fn unit(ptr: *mut c_void) -> Self {
        Self::new(ptr, StashStorage::Unit)
    }

    pub fn with_pending_transfer(self, ptr: *mut c_void, release: PendingRelease) -> Self {
        let mut transfers = self.pending_transfer.take();
        transfers.push(PendingTransfer { ptr, release });
        self.pending_transfer.set(transfers);
        self
    }

    pub fn with_pending_transfers(self, transfers: Vec<PendingTransfer>) -> Self {
        let mut existing = self.pending_transfer.take();
        existing.extend(transfers);
        self.pending_transfer.set(existing);
        self
    }

    pub fn disarm_pending_transfer(&self) {
        self.pending_transfer.set(Vec::new());
    }

    #[inline]
    pub fn ptr(&self) -> *mut c_void {
        self.ptr
    }

    #[inline]
    pub fn ptr_ref(&self) -> &*mut c_void {
        &self.ptr
    }

    pub fn storage(&self) -> &StashStorage {
        &self.storage
    }
}

impl Stash {
    fn free_garray(data: &GArrayData) {
        if data.should_free && !data.ptr.is_null() {
            unsafe { glib::ffi::g_array_unref(data.ptr) };
        }
    }
}

impl Drop for Stash {
    fn drop(&mut self) {
        for pending in self.pending_transfer.take() {
            pending.release_now();
        }
        match &self.storage {
            StashStorage::HashTable => {
                if !self.ptr.is_null() {
                    unsafe {
                        glib::ffi::g_hash_table_unref(self.ptr as *mut glib::ffi::GHashTable)
                    };
                }
            }
            StashStorage::List(data) => {
                if data.should_free && !data.ptr.is_null() {
                    let free = match &data.payload {
                        ListPayload::Strings {
                            elements_duped: true,
                            ..
                        } => data.ops.free_full,
                        ListPayload::Handles(_) | ListPayload::Strings { .. } => data.ops.free,
                    };
                    unsafe { free(data.ptr) };
                }
            }
            StashStorage::GArray(data) => Self::free_garray(data),
            StashStorage::GByteArray(_)
            | StashStorage::Unit
            | StashStorage::U8Vec(_)
            | StashStorage::I8Vec(_)
            | StashStorage::U16Vec(_)
            | StashStorage::I16Vec(_)
            | StashStorage::U32Vec(_)
            | StashStorage::I32Vec(_)
            | StashStorage::U64Vec(_)
            | StashStorage::I64Vec(_)
            | StashStorage::F32Vec(_)
            | StashStorage::F64Vec(_)
            | StashStorage::StringArray(_, _)
            | StashStorage::ObjectArray(_, _)
            | StashStorage::CString(_)
            | StashStorage::Buffer(_)
            | StashStorage::PtrSlot(_)
            | StashStorage::StrV(_) => {}
        }
    }
}

macro_rules! impl_stash_from_vec {
    ($($descriptor:ty => $vec_variant:ident),+ $(,)?) => {
        $(
            impl From<Vec<$descriptor>> for Stash {
                fn from(mut vec: Vec<$descriptor>) -> Self {
                    let ptr = vec.as_mut_ptr() as *mut c_void;
                    Self::new(ptr, StashStorage::$vec_variant(vec))
                }
            }
        )+
    };
}

impl_stash_from_vec! {
    u8 => U8Vec,
    i8 => I8Vec,
    u16 => U16Vec,
    i16 => I16Vec,
    u32 => U32Vec,
    i32 => I32Vec,
    u64 => U64Vec,
    i64 => I64Vec,
    f32 => F32Vec,
    f64 => F64Vec,
}

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

#[derive(Debug)]
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

pub trait ListKind {
    type Node;
    const LABEL: &'static str;

    unsafe fn prepend(list: *mut Self::Node, ptr: *mut c_void) -> *mut Self::Node;

    unsafe fn free(list: *mut Self::Node);

    unsafe fn free_full(list: *mut Self::Node);

    fn pending_release() -> PendingRelease;

    fn handle_storage(
        handles: Vec<crate::handle::Handle>,
        list_ptr: *mut Self::Node,
        should_free: bool,
    ) -> StashStorage;

    fn string_storage(
        strings: Vec<std::ffi::CString>,
        list_ptr: *mut Self::Node,
        should_free: bool,
        elements_duped: bool,
    ) -> StashStorage;

    fn build_list(ptrs: &[*mut c_void]) -> *mut Self::Node {
        let mut list: *mut Self::Node = std::ptr::null_mut();
        for ptr in ptrs.iter().rev() {
            list = unsafe { Self::prepend(list, *ptr) };
        }
        list
    }

    unsafe fn free_handle_list(list_ptr: *mut Self::Node, should_free: bool) {
        if should_free && !list_ptr.is_null() {
            unsafe { Self::free(list_ptr) };
        }
    }

    unsafe fn free_string_list(list_ptr: *mut Self::Node, should_free: bool, elements_duped: bool) {
        if !should_free || list_ptr.is_null() {
            return;
        }
        if elements_duped {
            unsafe { Self::free_full(list_ptr) };
        } else {
            unsafe { Self::free(list_ptr) };
        }
    }
}

/// Generates a [`ListKind`] implementation for a GLib singly/doubly linked list,
/// along with its handle- and string-payload storage structs. Both `GList` and
/// `GSList` differ only in their node type, the `g_list_*`/`g_slist_*` free and
/// prepend functions, and the storage variants they map to.
macro_rules! impl_list_kind {
    (
        kind = $kind:ident,
        node = $node:path,
        handle_data = $handle_data:ident => $handle_variant:ident,
        string_data = $string_data:ident => $string_variant:ident,
        label = $label:literal,
        prepend = $prepend:path,
        free = $free:path,
        free_full = $free_full:path,
        pending = $pending:ident,
    ) => {
        #[derive(Debug)]
        pub struct $handle_data {
            pub handles: Vec<crate::handle::Handle>,
            pub list_ptr: *mut $node,
            pub should_free: bool,
        }

        #[derive(Debug)]
        pub struct $string_data {
            pub strings: Vec<std::ffi::CString>,
            pub list_ptr: *mut $node,
            pub should_free: bool,
            pub elements_duped: bool,
        }

        #[derive(Debug)]
        pub struct $kind;

        impl ListKind for $kind {
            type Node = $node;
            const LABEL: &'static str = $label;

            unsafe fn prepend(list: *mut $node, ptr: *mut c_void) -> *mut $node {
                unsafe { $prepend(list, ptr) }
            }

            unsafe fn free(list: *mut $node) {
                unsafe { $free(list) };
            }

            unsafe fn free_full(list: *mut $node) {
                unsafe { $free_full(list, Some(glib::ffi::g_free)) };
            }

            fn pending_release() -> PendingRelease {
                PendingRelease::$pending
            }

            fn handle_storage(
                handles: Vec<crate::handle::Handle>,
                list_ptr: *mut $node,
                should_free: bool,
            ) -> StashStorage {
                StashStorage::$handle_variant($handle_data {
                    handles,
                    list_ptr,
                    should_free,
                })
            }

            fn string_storage(
                strings: Vec<std::ffi::CString>,
                list_ptr: *mut $node,
                should_free: bool,
                elements_duped: bool,
            ) -> StashStorage {
                StashStorage::$string_variant($string_data {
                    strings,
                    list_ptr,
                    should_free,
                    elements_duped,
                })
            }
        }
    };
}

impl_list_kind! {
    kind = GListKind,
    node = glib::ffi::GList,
    handle_data = GListData => GList,
    string_data = StringGListData => StringGList,
    label = "GList",
    prepend = glib::ffi::g_list_prepend,
    free = glib::ffi::g_list_free,
    free_full = glib::ffi::g_list_free_full,
    pending = GListFree,
}

impl_list_kind! {
    kind = GSListKind,
    node = glib::ffi::GSList,
    handle_data = GSListData => GSList,
    string_data = StringGSListData => StringGSList,
    label = "GSList",
    prepend = glib::ffi::g_slist_prepend,
    free = glib::ffi::g_slist_free,
    free_full = glib::ffi::g_slist_free_full,
    pending = GSListFree,
}

#[derive(Debug)]
pub struct GArrayData {
    pub array_ptr: *mut glib::ffi::GArray,
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
    GList(GListData),
    GSList(GSListData),
    StringGList(StringGListData),
    StringGSList(StringGSListData),
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
        if data.should_free && !data.array_ptr.is_null() {
            unsafe { glib::ffi::g_array_unref(data.array_ptr) };
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
                    unsafe { glib::ffi::g_hash_table_unref(self.ptr as *mut glib::ffi::GHashTable) };
                }
            }
            StashStorage::GList(data) => unsafe {
                GListKind::free_handle_list(data.list_ptr, data.should_free);
            },
            StashStorage::GSList(data) => unsafe {
                GSListKind::free_handle_list(data.list_ptr, data.should_free);
            },
            StashStorage::GArray(data) => Self::free_garray(data),
            StashStorage::StringGList(data) => unsafe {
                GListKind::free_string_list(data.list_ptr, data.should_free, data.elements_duped);
            },
            StashStorage::StringGSList(data) => unsafe {
                GSListKind::free_string_list(data.list_ptr, data.should_free, data.elements_duped);
            },
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

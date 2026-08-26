use std::cell::Cell;
use std::ffi::c_void;

use glib::translate::IntoGlib as _;

use crate::handle::UnrefFn;

pub struct StashStorage {
    ptr: *mut c_void,
    data: StashData,
    pending_transfer: Cell<Vec<PendingTransfer>>,
}

impl std::fmt::Debug for StashStorage {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("StashStorage")
            .field("ptr", &self.ptr)
            .field("data", &self.data)
            .finish_non_exhaustive()
    }
}

#[derive(Debug)]
#[must_use = "a PendingTransfer owns memory and leaks unless it is stored or released"]
pub struct PendingTransfer {
    ptr: *mut c_void,
    release: ReleaseKind,
}

#[derive(Debug, Clone, Copy)]
pub enum ReleaseKind {
    GFree,
    ObjectUnref,
    BoxedFree(glib::Type),
    Fundamental(UnrefFn),
    StrFreeV,
    StringElements,
    HashTableUnref,
    GArrayUnref,
    GPtrArrayUnref,
    GByteArrayUnref,
    GListFree,
    GSListFree,
}

impl PendingTransfer {
    pub fn new(ptr: *mut c_void, release: ReleaseKind) -> Self {
        Self { ptr, release }
    }

    pub fn release_now(self) {
        if self.ptr.is_null() {
            return;
        }
        unsafe {
            match self.release {
                ReleaseKind::GFree => glib::ffi::g_free(self.ptr),
                ReleaseKind::ObjectUnref => {
                    glib::gobject_ffi::g_object_unref(
                        self.ptr.cast::<glib::gobject_ffi::GObject>(),
                    );
                }
                ReleaseKind::BoxedFree(type_) => {
                    glib::gobject_ffi::g_boxed_free(type_.into_glib(), self.ptr);
                }
                ReleaseKind::Fundamental(unref) => unref(self.ptr),
                ReleaseKind::StrFreeV => {
                    glib::ffi::g_strfreev(self.ptr.cast::<*mut std::ffi::c_char>());
                }
                ReleaseKind::StringElements => {
                    let mut slot = self.ptr.cast::<*mut std::ffi::c_char>();
                    while !(*slot).is_null() {
                        glib::ffi::g_free((*slot).cast());
                        slot = slot.add(1);
                    }
                }
                ReleaseKind::HashTableUnref => {
                    glib::ffi::g_hash_table_unref(self.ptr.cast::<glib::ffi::GHashTable>());
                }
                ReleaseKind::GArrayUnref => {
                    glib::ffi::g_array_unref(self.ptr.cast::<glib::ffi::GArray>());
                }
                ReleaseKind::GPtrArrayUnref => {
                    glib::ffi::g_ptr_array_unref(self.ptr.cast::<glib::ffi::GPtrArray>());
                }
                ReleaseKind::GByteArrayUnref => {
                    glib::ffi::g_byte_array_unref(self.ptr.cast::<glib::ffi::GByteArray>());
                }
                ReleaseKind::GListFree => {
                    glib::ffi::g_list_free(self.ptr.cast::<glib::ffi::GList>());
                }
                ReleaseKind::GSListFree => {
                    glib::ffi::g_slist_free(self.ptr.cast::<glib::ffi::GSList>());
                }
            }
        }
    }
}

pub struct ListNode {
    pub data: *mut c_void,
    pub next: *mut c_void,
}

#[derive(Debug)]
pub struct ListOps {
    pub label: &'static str,
    pub pending: ReleaseKind,
    pub prepend: unsafe fn(*mut c_void, *mut c_void) -> *mut c_void,
    pub node: unsafe fn(*mut c_void) -> ListNode,
    pub free: unsafe fn(*mut c_void),
    pub free_full: unsafe fn(*mut c_void),
}

unsafe fn glist_prepend(list: *mut c_void, data: *mut c_void) -> *mut c_void {
    unsafe { glib::ffi::g_list_prepend(list.cast::<glib::ffi::GList>(), data).cast() }
}

unsafe fn glist_node(node: *mut c_void) -> ListNode {
    let node = node.cast::<glib::ffi::GList>();
    unsafe {
        ListNode {
            data: (*node).data,
            next: (*node).next.cast(),
        }
    }
}

unsafe fn glist_free(list: *mut c_void) {
    unsafe { glib::ffi::g_list_free(list.cast::<glib::ffi::GList>()) };
}

unsafe fn glist_free_full(list: *mut c_void) {
    unsafe {
        glib::ffi::g_list_free_full(list.cast::<glib::ffi::GList>(), Some(glib::ffi::g_free));
    }
}

pub static GLIST_OPS: ListOps = ListOps {
    label: "GList",
    pending: ReleaseKind::GListFree,
    prepend: glist_prepend,
    node: glist_node,
    free: glist_free,
    free_full: glist_free_full,
};

unsafe fn gslist_prepend(list: *mut c_void, data: *mut c_void) -> *mut c_void {
    unsafe { glib::ffi::g_slist_prepend(list.cast::<glib::ffi::GSList>(), data).cast() }
}

unsafe fn gslist_node(node: *mut c_void) -> ListNode {
    let node = node.cast::<glib::ffi::GSList>();
    unsafe {
        ListNode {
            data: (*node).data,
            next: (*node).next.cast(),
        }
    }
}

unsafe fn gslist_free(list: *mut c_void) {
    unsafe { glib::ffi::g_slist_free(list.cast::<glib::ffi::GSList>()) };
}

unsafe fn gslist_free_full(list: *mut c_void) {
    unsafe {
        glib::ffi::g_slist_free_full(list.cast::<glib::ffi::GSList>(), Some(glib::ffi::g_free));
    }
}

pub static GSLIST_OPS: ListOps = ListOps {
    label: "GSList",
    pending: ReleaseKind::GSListFree,
    prepend: gslist_prepend,
    node: gslist_node,
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
        items_duped: bool,
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
pub struct GPtrArrayData {
    pub ptr: *mut glib::ffi::GPtrArray,
    pub should_free: bool,
}

#[derive(Debug)]
pub enum StashData {
    Unit,
    Owned(Box<dyn std::any::Any>, usize),
    StringArray(Vec<std::ffi::CString>, Vec<*mut c_void>),
    ObjectArray(Vec<crate::handle::Handle>, Vec<*mut c_void>),
    List(ListData),
    CString(std::ffi::CString),
    GArray(GArrayData),
    GPtrArray(GPtrArrayData),
    GByteArray(Option<glib::ByteArray>),
    Buffer(Vec<u8>),
    PtrSlot(Vec<*mut c_void>, Option<Box<StashStorage>>),
    StrV(glib::StrV),
    HashTable,
    CallerAllocation(CallerAllocation),
}

/// A zero-initialized `g_malloc`ed buffer handed to a callee that fills it in place, kept at
/// malloc alignment so SIMD-aligned element types can be written into it, and freed on drop.
#[derive(Debug)]
pub struct CallerAllocation {
    ptr: *mut c_void,
    byte_len: usize,
}

impl CallerAllocation {
    #[must_use]
    pub fn zeroed(byte_len: usize) -> Self {
        Self {
            ptr: unsafe { glib::ffi::g_malloc0(byte_len) },
            byte_len,
        }
    }

    #[must_use]
    pub fn ptr(&self) -> *mut c_void {
        self.ptr
    }
}

impl Drop for CallerAllocation {
    fn drop(&mut self) {
        unsafe { glib::ffi::g_free(self.ptr) };
    }
}

impl StashStorage {
    pub fn new(ptr: *mut c_void, data: StashData) -> Self {
        Self {
            ptr,
            data,
            pending_transfer: Cell::new(Vec::new()),
        }
    }

    pub fn unit(ptr: *mut c_void) -> Self {
        Self::new(ptr, StashData::Unit)
    }

    #[must_use]
    pub fn with_pending_transfer(self, ptr: *mut c_void, release: ReleaseKind) -> Self {
        let mut transfers = self.pending_transfer.take();
        transfers.push(PendingTransfer { ptr, release });
        self.pending_transfer.set(transfers);
        self
    }

    #[must_use]
    pub fn with_pending_transfers(self, transfers: Vec<PendingTransfer>) -> Self {
        let mut existing = self.pending_transfer.take();
        existing.extend(transfers);
        self.pending_transfer.set(existing);
        self
    }

    pub fn disarm_pending_transfer(&self) {
        self.pending_transfer.set(Vec::new());

        if let StashData::PtrSlot(_, Some(inner)) = &self.data {
            inner.disarm_pending_transfer();
        }
    }

    #[inline]
    pub fn ptr(&self) -> *mut c_void {
        self.ptr
    }

    #[inline]
    pub fn ptr_ref(&self) -> &*mut c_void {
        &self.ptr
    }

    pub fn data(&self) -> &StashData {
        &self.data
    }

    pub fn owns_element_buffer(&self) -> bool {
        self.byte_len().is_some()
    }

    pub fn byte_len(&self) -> Option<usize> {
        match &self.data {
            StashData::Owned(_, byte_len) => Some(*byte_len),
            StashData::Buffer(v) => Some(size_of_val(v.as_slice())),
            StashData::CallerAllocation(allocation) => Some(allocation.byte_len),
            StashData::Unit
            | StashData::StringArray(_, _)
            | StashData::ObjectArray(_, _)
            | StashData::List(_)
            | StashData::CString(_)
            | StashData::GArray(_)
            | StashData::GPtrArray(_)
            | StashData::GByteArray(_)
            | StashData::PtrSlot(_, _)
            | StashData::StrV(_)
            | StashData::HashTable => None,
        }
    }
}

impl StashStorage {
    fn free_garray(data: &GArrayData) {
        if data.should_free && !data.ptr.is_null() {
            unsafe { glib::ffi::g_array_unref(data.ptr) };
        }
    }

    fn free_gptrarray(data: &GPtrArrayData) {
        if data.should_free && !data.ptr.is_null() {
            unsafe { glib::ffi::g_ptr_array_unref(data.ptr) };
        }
    }
}

impl Drop for StashStorage {
    fn drop(&mut self) {
        for pending in self.pending_transfer.take() {
            pending.release_now();
        }
        match &self.data {
            StashData::HashTable => {
                if !self.ptr.is_null() {
                    unsafe {
                        glib::ffi::g_hash_table_unref(self.ptr.cast::<glib::ffi::GHashTable>());
                    }
                }
            }
            StashData::List(data) => {
                if data.should_free && !data.ptr.is_null() {
                    let free = match &data.payload {
                        ListPayload::Strings {
                            items_duped: true, ..
                        } => data.ops.free_full,
                        ListPayload::Handles(_) | ListPayload::Strings { .. } => data.ops.free,
                    };
                    unsafe { free(data.ptr) };
                }
            }
            StashData::GArray(data) => Self::free_garray(data),
            StashData::GPtrArray(data) => Self::free_gptrarray(data),
            StashData::GByteArray(_)
            | StashData::Unit
            | StashData::Owned(_, _)
            | StashData::StringArray(_, _)
            | StashData::ObjectArray(_, _)
            | StashData::CString(_)
            | StashData::Buffer(_)
            | StashData::PtrSlot(_, _)
            | StashData::StrV(_)
            | StashData::CallerAllocation(_) => {}
        }
    }
}

fn allocated_ptr<T>(vec: &mut Vec<T>) -> *mut c_void {
    if vec.capacity() == 0 {
        return std::ptr::null_mut();
    }

    vec.as_mut_ptr().cast::<c_void>()
}

pub trait ScalarElement: Copy + 'static {}

impl ScalarElement for u8 {}
impl ScalarElement for i8 {}
impl ScalarElement for u16 {}
impl ScalarElement for i16 {}
impl ScalarElement for u32 {}
impl ScalarElement for i32 {}
impl ScalarElement for u64 {}
impl ScalarElement for i64 {}
impl ScalarElement for f32 {}
impl ScalarElement for f64 {}

impl<T: ScalarElement> From<Vec<T>> for StashStorage {
    fn from(mut vec: Vec<T>) -> Self {
        let byte_len = size_of_val(vec.as_slice());
        let ptr = allocated_ptr(&mut vec);
        Self::new(ptr, StashData::Owned(Box::new(vec), byte_len))
    }
}

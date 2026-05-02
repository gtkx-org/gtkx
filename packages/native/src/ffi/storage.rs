use std::ffi::c_void;

use gtk4::glib;

use crate::types::IntegerKind;

#[derive(Debug)]
pub struct FfiStorage {
    ptr: *mut c_void,
    kind: FfiStorageKind,
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

#[derive(Debug)]
pub struct GArrayData {
    pub array_ptr: *mut glib::ffi::GArray,
    pub should_free: bool,
}

#[derive(Debug)]
pub struct GByteArrayData {
    pub array_ptr: *mut glib::ffi::GByteArray,
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
    GClosure,
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
    GByteArray(GByteArrayData),
    Buffer(Vec<u8>),
    BoxedValue(Box<super::FfiValue>),
    PtrStorage(Box<*mut c_void>),
    HashTable(HashTableData),
}

impl FfiStorage {
    pub fn new(ptr: *mut c_void, kind: FfiStorageKind) -> Self {
        Self { ptr, kind }
    }

    pub fn unit(ptr: *mut c_void) -> Self {
        Self {
            ptr,
            kind: FfiStorageKind::Unit,
        }
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

    pub fn closure(closure_ptr: *mut glib::gobject_ffi::GClosure) -> Self {
        Self {
            ptr: closure_ptr as *mut c_void,
            kind: FfiStorageKind::GClosure,
        }
    }
}

impl FfiStorage {
    fn drop_gclosure(&self) {
        if !self.ptr.is_null() {
            unsafe {
                glib::gobject_ffi::g_closure_unref(self.ptr as *mut glib::gobject_ffi::GClosure);
            };
        }
    }

    fn drop_string_glist(data: &StringGListData) {
        if !(data.should_free && !data.list_ptr.is_null()) {
            return;
        }
        if data.elements_duped {
            unsafe {
                glib::ffi::g_list_free_full(data.list_ptr, Some(glib::ffi::g_free));
            }
        } else {
            unsafe { glib::ffi::g_list_free(data.list_ptr) };
        }
    }

    fn drop_string_gslist(data: &StringGSListData) {
        if !(data.should_free && !data.list_ptr.is_null()) {
            return;
        }
        if data.elements_duped {
            unsafe {
                glib::ffi::g_slist_free_full(data.list_ptr, Some(glib::ffi::g_free));
            }
        } else {
            unsafe { glib::ffi::g_slist_free(data.list_ptr) };
        }
    }
}

impl Drop for FfiStorage {
    fn drop(&mut self) {
        match &self.kind {
            FfiStorageKind::GClosure => self.drop_gclosure(),
            FfiStorageKind::HashTable(data) => {
                if data.should_free && !data.handle.is_null() {
                    unsafe { glib::ffi::g_hash_table_unref(data.handle) };
                }
            }
            FfiStorageKind::GList(data) => {
                if data.should_free && !data.list_ptr.is_null() {
                    unsafe { glib::ffi::g_list_free(data.list_ptr) };
                }
            }
            FfiStorageKind::GSList(data) => {
                if data.should_free && !data.list_ptr.is_null() {
                    unsafe { glib::ffi::g_slist_free(data.list_ptr) };
                }
            }
            FfiStorageKind::GArray(data) => {
                if data.should_free && !data.array_ptr.is_null() {
                    unsafe { glib::ffi::g_array_unref(data.array_ptr) };
                }
            }
            FfiStorageKind::GByteArray(data) => {
                if data.should_free && !data.array_ptr.is_null() {
                    unsafe { glib::ffi::g_byte_array_unref(data.array_ptr) };
                }
            }
            FfiStorageKind::StringGList(data) => Self::drop_string_glist(data),
            FfiStorageKind::StringGSList(data) => Self::drop_string_gslist(data),
            FfiStorageKind::Unit
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
            | FfiStorageKind::BoxedValue(_)
            | FfiStorageKind::PtrStorage(_) => {}
        }
    }
}

macro_rules! impl_ffi_storage_from_integer_vecs {
    ($($variant:ident : $ty:ident : $vec_variant:ident),+ $(,)?) => {
        $(
            impl From<Vec<$ty>> for FfiStorage {
                fn from(vec: Vec<$ty>) -> Self {
                    Self {
                        ptr: vec.as_ptr() as *mut c_void,
                        kind: FfiStorageKind::$vec_variant(vec),
                    }
                }
            }
        )+
    };
}
with_integer_kinds!(impl_ffi_storage_from_integer_vecs);

impl From<Vec<f32>> for FfiStorage {
    fn from(vec: Vec<f32>) -> Self {
        Self {
            ptr: vec.as_ptr() as *mut c_void,
            kind: FfiStorageKind::F32Vec(vec),
        }
    }
}

impl From<Vec<f64>> for FfiStorage {
    fn from(vec: Vec<f64>) -> Self {
        Self {
            ptr: vec.as_ptr() as *mut c_void,
            kind: FfiStorageKind::F64Vec(vec),
        }
    }
}

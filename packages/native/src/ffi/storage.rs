//! Temporary storage for FFI call arguments.
//!
//! Provides [`FfiStorage`] for managing memory that must remain valid during
//! native function calls. This includes arrays, strings, and other heap-allocated
//! data that is passed by reference to native code.

use std::ffi::c_void;

use gtk4::glib;

use crate::types::IntegerKind;

#[derive(Debug)]
#[repr(C)]
pub struct FfiStorage {
    ptr: *mut c_void,
    kind: FfiStorageKind,
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
    CString(std::ffi::CString),
    Buffer(Vec<u8>),
    BoxedValue(Box<super::FfiValue>),
    PtrStorage(Box<*mut c_void>),
    HashTable(HashTableData),
    Callback(*mut c_void),
}

#[derive(Debug)]
pub struct HashTableData {
    pub handle: *mut glib::ffi::GHashTable,
    pub keys: HashTableStorage,
    pub values: HashTableStorage,
}

#[derive(Debug)]
pub enum HashTableStorage {
    Strings(Vec<std::ffi::CString>),
    Integers,
    Booleans,
    Floats,
    NativeHandles,
    PtrArrays,
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
    pub fn ptr(&self) -> *mut c_void {
        self.ptr
    }

    #[inline]
    pub fn ptr_ref(&self) -> &*mut c_void {
        &self.ptr
    }

    pub fn kind(&self) -> &FfiStorageKind {
        &self.kind
    }

    pub fn as_numeric_slice(&self, int_kind: IntegerKind) -> anyhow::Result<Vec<f64>> {
        match (&self.kind, int_kind) {
            (FfiStorageKind::U8Vec(v), IntegerKind::U8) => {
                Ok(v.iter().map(|&x| x as f64).collect())
            }
            (FfiStorageKind::I8Vec(v), IntegerKind::I8) => {
                Ok(v.iter().map(|&x| x as f64).collect())
            }
            (FfiStorageKind::U16Vec(v), IntegerKind::U16) => {
                Ok(v.iter().map(|&x| x as f64).collect())
            }
            (FfiStorageKind::I16Vec(v), IntegerKind::I16) => {
                Ok(v.iter().map(|&x| x as f64).collect())
            }
            (FfiStorageKind::U32Vec(v), IntegerKind::U32) => {
                Ok(v.iter().map(|&x| x as f64).collect())
            }
            (FfiStorageKind::I32Vec(v), IntegerKind::I32) => {
                Ok(v.iter().map(|&x| x as f64).collect())
            }
            (FfiStorageKind::U64Vec(v), IntegerKind::U64) => {
                Ok(v.iter().map(|&x| x as f64).collect())
            }
            (FfiStorageKind::I64Vec(v), IntegerKind::I64) => {
                Ok(v.iter().map(|&x| x as f64).collect())
            }
            _ => anyhow::bail!("FfiStorage does not match integer kind {:?}", int_kind),
        }
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

    pub fn as_bool_slice(&self) -> anyhow::Result<&[u8]> {
        match &self.kind {
            FfiStorageKind::U8Vec(v) => Ok(v),
            _ => anyhow::bail!("FfiStorage does not contain bool/u8 data"),
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

impl Drop for FfiStorage {
    fn drop(&mut self) {
        match &self.kind {
            FfiStorageKind::GClosure => {
                if !self.ptr.is_null() {
                    unsafe {
                        glib::gobject_ffi::g_closure_unref(
                            self.ptr as *mut glib::gobject_ffi::GClosure,
                        )
                    };
                }
            }
            FfiStorageKind::HashTable(data) => {
                if !data.handle.is_null() {
                    unsafe { glib::ffi::g_hash_table_unref(data.handle) };
                }
            }
            _ => {}
        }
    }
}

impl From<Vec<u8>> for FfiStorage {
    fn from(vec: Vec<u8>) -> Self {
        Self {
            ptr: vec.as_ptr() as *mut c_void,
            kind: FfiStorageKind::U8Vec(vec),
        }
    }
}

impl From<Vec<i8>> for FfiStorage {
    fn from(vec: Vec<i8>) -> Self {
        Self {
            ptr: vec.as_ptr() as *mut c_void,
            kind: FfiStorageKind::I8Vec(vec),
        }
    }
}

impl From<Vec<u16>> for FfiStorage {
    fn from(vec: Vec<u16>) -> Self {
        Self {
            ptr: vec.as_ptr() as *mut c_void,
            kind: FfiStorageKind::U16Vec(vec),
        }
    }
}

impl From<Vec<i16>> for FfiStorage {
    fn from(vec: Vec<i16>) -> Self {
        Self {
            ptr: vec.as_ptr() as *mut c_void,
            kind: FfiStorageKind::I16Vec(vec),
        }
    }
}

impl From<Vec<u32>> for FfiStorage {
    fn from(vec: Vec<u32>) -> Self {
        Self {
            ptr: vec.as_ptr() as *mut c_void,
            kind: FfiStorageKind::U32Vec(vec),
        }
    }
}

impl From<Vec<i32>> for FfiStorage {
    fn from(vec: Vec<i32>) -> Self {
        Self {
            ptr: vec.as_ptr() as *mut c_void,
            kind: FfiStorageKind::I32Vec(vec),
        }
    }
}

impl From<Vec<u64>> for FfiStorage {
    fn from(vec: Vec<u64>) -> Self {
        Self {
            ptr: vec.as_ptr() as *mut c_void,
            kind: FfiStorageKind::U64Vec(vec),
        }
    }
}

impl From<Vec<i64>> for FfiStorage {
    fn from(vec: Vec<i64>) -> Self {
        Self {
            ptr: vec.as_ptr() as *mut c_void,
            kind: FfiStorageKind::I64Vec(vec),
        }
    }
}

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

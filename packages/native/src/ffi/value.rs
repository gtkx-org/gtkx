//! FFI value representation for native calls.
//!
//! Defines [`FfiValue`], an enum that represents values in a form suitable
//! for passing to libffi. Each variant corresponds to a different primitive
//! or pointer type that can be marshaled across the FFI boundary.

use std::ffi::c_void;
use std::ptr::NonNull;

use gtk4::glib::{self, gobject_ffi};
use libffi::middle as libffi;

use super::storage::{FfiStorage, FfiStorageKind};

#[derive(Debug)]
pub struct TrampolineCallbackValue {
    pub trampoline_ptr: *mut c_void,
    pub closure: FfiStorage,
    pub destroy_ptr: Option<*mut c_void>,
    pub data_first: bool,
}

impl TrampolineCallbackValue {
    pub fn build(closure: glib::Closure, trampoline_fn: *mut c_void) -> FfiValue {
        use glib::translate::ToGlibPtr as _;

        let closure_ptr: *mut gobject_ffi::GClosure = closure.to_glib_full();
        // SAFETY: closure pointer from glib::Closure::to_glib_full is guaranteed non-null
        let closure_nonnull =
            NonNull::new(closure_ptr).expect("closure pointer should not be null");

        let callback_data = Box::new(crate::trampoline::ClosureCallbackData::new(closure_nonnull));
        let data_ptr = Box::into_raw(callback_data) as *mut c_void;

        FfiValue::TrampolineCallback(TrampolineCallbackValue {
            trampoline_ptr: trampoline_fn,
            closure: FfiStorage::new(data_ptr, FfiStorageKind::Callback(data_ptr)),
            destroy_ptr: Some(crate::trampoline::ClosureCallbackData::release as *mut c_void),
            data_first: false,
        })
    }
}

#[derive(Debug)]
pub enum FfiValue {
    U8(u8),
    I8(i8),
    U16(u16),
    I16(i16),
    U32(u32),
    I32(i32),
    U64(u64),
    I64(i64),
    F32(f32),
    F64(f64),
    Ptr(*mut c_void),
    Storage(FfiStorage),
    TrampolineCallback(TrampolineCallbackValue),
    Void,
}

impl FfiValue {
    #[must_use]
    pub fn as_raw_ptr(&self) -> *mut c_void {
        match self {
            FfiValue::U8(value) => value as *const u8 as *mut c_void,
            FfiValue::I8(value) => value as *const i8 as *mut c_void,
            FfiValue::U16(value) => value as *const u16 as *mut c_void,
            FfiValue::I16(value) => value as *const i16 as *mut c_void,
            FfiValue::U32(value) => value as *const u32 as *mut c_void,
            FfiValue::I32(value) => value as *const i32 as *mut c_void,
            FfiValue::U64(value) => value as *const u64 as *mut c_void,
            FfiValue::I64(value) => value as *const i64 as *mut c_void,
            FfiValue::F32(value) => value as *const f32 as *mut c_void,
            FfiValue::F64(value) => value as *const f64 as *mut c_void,
            FfiValue::Ptr(ptr) => ptr as *const *mut c_void as *mut c_void,
            FfiValue::Storage(storage) => storage as *const FfiStorage as *mut c_void,
            FfiValue::TrampolineCallback(_) => {
                unreachable!(
                    "TrampolineCallback should not be converted to a single pointer - it requires special handling in call.rs"
                )
            }
            FfiValue::Void => std::ptr::null_mut(),
        }
    }

    pub fn as_ptr(&self, type_name: &str) -> anyhow::Result<*mut c_void> {
        match self {
            FfiValue::Ptr(ptr) => Ok(*ptr),
            _ => anyhow::bail!(
                "Expected a pointer FfiValue for {}, got {:?}",
                type_name,
                self
            ),
        }
    }

    pub fn as_non_null_ptr(&self, type_name: &str) -> anyhow::Result<Option<*mut c_void>> {
        let ptr = self.as_ptr(type_name)?;
        Ok(if ptr.is_null() { None } else { Some(ptr) })
    }

    pub fn to_number(&self) -> anyhow::Result<f64> {
        match self {
            FfiValue::I8(v) => Ok(*v as f64),
            FfiValue::U8(v) => Ok(*v as f64),
            FfiValue::I16(v) => Ok(*v as f64),
            FfiValue::U16(v) => Ok(*v as f64),
            FfiValue::I32(v) => Ok(*v as f64),
            FfiValue::U32(v) => Ok(*v as f64),
            FfiValue::I64(v) => Ok(*v as f64),
            FfiValue::U64(v) => Ok(*v as f64),
            FfiValue::F32(v) => Ok(*v as f64),
            FfiValue::F64(v) => Ok(*v),
            _ => anyhow::bail!("Expected a numeric FfiValue, got {:?}", self),
        }
    }

    pub fn append_libffi_args<'a>(&'a self, args: &mut Vec<libffi::Arg<'a>>) {
        match self {
            FfiValue::TrampolineCallback(trampoline) => {
                if trampoline.data_first {
                    args.push(libffi::arg(trampoline.closure.ptr_ref()));
                    args.push(libffi::arg(&trampoline.trampoline_ptr));
                } else {
                    args.push(libffi::arg(&trampoline.trampoline_ptr));
                    args.push(libffi::arg(trampoline.closure.ptr_ref()));
                }
                if let Some(destroy_ptr) = &trampoline.destroy_ptr {
                    args.push(libffi::arg(destroy_ptr));
                }
            }
            other => args.push(other.into()),
        }
    }

    pub fn storage(&self) -> Option<&FfiStorage> {
        match self {
            FfiValue::Storage(storage) => Some(storage),
            _ => None,
        }
    }
}

impl<'a> From<&'a FfiValue> for libffi::Arg<'a> {
    fn from(arg: &'a FfiValue) -> Self {
        match arg {
            FfiValue::U8(value) => libffi::arg(value),
            FfiValue::I8(value) => libffi::arg(value),
            FfiValue::U16(value) => libffi::arg(value),
            FfiValue::I16(value) => libffi::arg(value),
            FfiValue::U32(value) => libffi::arg(value),
            FfiValue::I32(value) => libffi::arg(value),
            FfiValue::U64(value) => libffi::arg(value),
            FfiValue::I64(value) => libffi::arg(value),
            FfiValue::F32(value) => libffi::arg(value),
            FfiValue::F64(value) => libffi::arg(value),
            FfiValue::Ptr(ptr) => libffi::arg(ptr),
            FfiValue::Storage(storage) => libffi::arg(storage.ptr_ref()),
            FfiValue::TrampolineCallback(_) => {
                unreachable!(
                    "TrampolineCallback requires append_libffi_args for multiple arguments"
                )
            }
            FfiValue::Void => libffi::arg(&()),
        }
    }
}

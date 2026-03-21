use std::ffi::c_void;

use libffi::middle as libffi;

use super::storage::FfiStorage;
use crate::trampoline::TrampolineState;

#[derive(Debug)]
#[non_exhaustive]
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
    Trampoline(TrampolineValue),
    Void,
}

pub struct TrampolineValue {
    pub fn_ptr: *mut c_void,
    pub state_ptr: *mut c_void,
    pub destroy_ptr: Option<*mut c_void>,
    pub _owned_state: Option<Box<TrampolineState>>,
}

impl std::fmt::Debug for TrampolineValue {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("TrampolineValue")
            .field("fn_ptr", &self.fn_ptr)
            .field("state_ptr", &self.state_ptr)
            .field("destroy_ptr", &self.destroy_ptr)
            .finish()
    }
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
            FfiValue::Storage(storage) => storage.ptr(),
            FfiValue::Trampoline(_) => {
                unreachable!(
                    "Trampoline should not be converted to a single pointer - it requires special handling via append_libffi_args"
                )
            }
            FfiValue::Void => std::ptr::null_mut(),
        }
    }

    pub fn as_ptr(&self, type_name: &str) -> anyhow::Result<*mut c_void> {
        match self {
            FfiValue::Ptr(ptr) => Ok(*ptr),
            FfiValue::Storage(storage) => Ok(storage.ptr()),
            FfiValue::U8(_)
            | FfiValue::I8(_)
            | FfiValue::U16(_)
            | FfiValue::I16(_)
            | FfiValue::U32(_)
            | FfiValue::I32(_)
            | FfiValue::U64(_)
            | FfiValue::I64(_)
            | FfiValue::F32(_)
            | FfiValue::F64(_)
            | FfiValue::Trampoline(_)
            | FfiValue::Void => anyhow::bail!(
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
            FfiValue::Ptr(_) | FfiValue::Storage(_) | FfiValue::Trampoline(_) | FfiValue::Void => {
                anyhow::bail!("Expected a numeric FfiValue, got {:?}", self)
            }
        }
    }

    pub fn append_libffi_args<'a>(&'a self, args: &mut Vec<libffi::Arg<'a>>) {
        match self {
            FfiValue::Trampoline(tv) => {
                args.push(libffi::arg(&tv.fn_ptr));
                args.push(libffi::arg(&tv.state_ptr));
                if let Some(destroy_ptr) = &tv.destroy_ptr {
                    args.push(libffi::arg(destroy_ptr));
                }
            }
            FfiValue::U8(_)
            | FfiValue::I8(_)
            | FfiValue::U16(_)
            | FfiValue::I16(_)
            | FfiValue::U32(_)
            | FfiValue::I32(_)
            | FfiValue::U64(_)
            | FfiValue::I64(_)
            | FfiValue::F32(_)
            | FfiValue::F64(_)
            | FfiValue::Ptr(_)
            | FfiValue::Storage(_)
            | FfiValue::Void => args.push(self.into()),
        }
    }

    #[must_use]
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
            FfiValue::Trampoline(_) => {
                unreachable!("Trampoline requires append_libffi_args for multiple arguments")
            }
            FfiValue::Void => libffi::arg(&()),
        }
    }
}

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
    fn_ptr: *mut c_void,
    state_ptr: *mut c_void,
    destroy_ptr: Option<*mut c_void>,
    _owned_state: Option<Box<TrampolineState>>,
}

impl TrampolineValue {
    #[must_use]
    pub fn new(
        fn_ptr: *mut c_void,
        state_ptr: *mut c_void,
        destroy_ptr: Option<*mut c_void>,
        owned_state: Option<Box<TrampolineState>>,
    ) -> Self {
        Self {
            fn_ptr,
            state_ptr,
            destroy_ptr,
            _owned_state: owned_state,
        }
    }

    #[must_use]
    pub fn fn_ptr(&self) -> *mut c_void {
        self.fn_ptr
    }

    #[must_use]
    pub fn state_ptr(&self) -> *mut c_void {
        self.state_ptr
    }

    #[must_use]
    pub fn destroy_ptr(&self) -> Option<*mut c_void> {
        self.destroy_ptr
    }
}

impl std::fmt::Debug for TrampolineValue {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("TrampolineValue")
            .field("fn_ptr", &self.fn_ptr)
            .field("state_ptr", &self.state_ptr)
            .field("destroy_ptr", &self.destroy_ptr)
            .finish_non_exhaustive()
    }
}

impl FfiValue {
    #[must_use]
    pub fn as_raw_ptr(&self) -> *mut c_void {
        match self {
            Self::U8(value) => value as *const u8 as *mut c_void,
            Self::I8(value) => value as *const i8 as *mut c_void,
            Self::U16(value) => value as *const u16 as *mut c_void,
            Self::I16(value) => value as *const i16 as *mut c_void,
            Self::U32(value) => value as *const u32 as *mut c_void,
            Self::I32(value) => value as *const i32 as *mut c_void,
            Self::U64(value) => value as *const u64 as *mut c_void,
            Self::I64(value) => value as *const i64 as *mut c_void,
            Self::F32(value) => value as *const f32 as *mut c_void,
            Self::F64(value) => value as *const f64 as *mut c_void,
            Self::Ptr(ptr) => ptr as *const *mut c_void as *mut c_void,
            Self::Storage(storage) => storage.ptr(),
            Self::Trampoline(_) => {
                unreachable!(
                    "Trampoline should not be converted to a single pointer - it requires special handling via append_libffi_args"
                )
            }
            Self::Void => std::ptr::null_mut(),
        }
    }

    pub fn as_ptr(&self, type_name: &str) -> anyhow::Result<*mut c_void> {
        match self {
            Self::Ptr(ptr) => Ok(*ptr),
            Self::Storage(storage) => Ok(storage.ptr()),
            Self::U8(_)
            | Self::I8(_)
            | Self::U16(_)
            | Self::I16(_)
            | Self::U32(_)
            | Self::I32(_)
            | Self::U64(_)
            | Self::I64(_)
            | Self::F32(_)
            | Self::F64(_)
            | Self::Trampoline(_)
            | Self::Void => {
                anyhow::bail!("Expected a pointer FfiValue for {type_name}, got {self:?}")
            }
        }
    }

    pub fn as_non_null_ptr(&self, type_name: &str) -> anyhow::Result<Option<*mut c_void>> {
        let ptr = self.as_ptr(type_name)?;
        Ok(if ptr.is_null() { None } else { Some(ptr) })
    }

    pub fn to_number(&self) -> anyhow::Result<f64> {
        match self {
            Self::I8(v) => Ok(*v as f64),
            Self::U8(v) => Ok(*v as f64),
            Self::I16(v) => Ok(*v as f64),
            Self::U16(v) => Ok(*v as f64),
            Self::I32(v) => Ok(*v as f64),
            Self::U32(v) => Ok(*v as f64),
            Self::I64(v) => Ok(*v as f64),
            Self::U64(v) => Ok(*v as f64),
            Self::F32(v) => Ok(*v as f64),
            Self::F64(v) => Ok(*v),
            Self::Ptr(_) | Self::Storage(_) | Self::Trampoline(_) | Self::Void => {
                anyhow::bail!("Expected a numeric FfiValue, got {self:?}")
            }
        }
    }

    pub fn append_libffi_args<'a>(&'a self, args: &mut Vec<libffi::Arg<'a>>) {
        match self {
            Self::Trampoline(tv) => {
                args.push(libffi::arg(&tv.fn_ptr));
                args.push(libffi::arg(&tv.state_ptr));
                if let Some(destroy_ptr) = &tv.destroy_ptr {
                    args.push(libffi::arg(destroy_ptr));
                }
            }
            Self::U8(_)
            | Self::I8(_)
            | Self::U16(_)
            | Self::I16(_)
            | Self::U32(_)
            | Self::I32(_)
            | Self::U64(_)
            | Self::I64(_)
            | Self::F32(_)
            | Self::F64(_)
            | Self::Ptr(_)
            | Self::Storage(_)
            | Self::Void => args.push(self.into()),
        }
    }

    #[must_use]
    pub fn storage(&self) -> Option<&FfiStorage> {
        match self {
            Self::Storage(storage) => Some(storage),
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

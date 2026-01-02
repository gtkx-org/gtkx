mod array;
mod callback;
mod from_arg;
mod helpers;
mod owned_ptr;
mod r#ref;
mod trampoline;

use std::ffi::c_void;

use libffi::middle as libffi;

pub use helpers::{closure_ptr_for_transfer, closure_to_glib_full};
pub use owned_ptr::OwnedPtr;
pub use trampoline::TrampolineCallbackValue;

#[derive(Debug)]
pub enum Value {
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
    OwnedPtr(OwnedPtr),
    TrampolineCallback(TrampolineCallbackValue),
    Void,
}

impl std::fmt::Display for Value {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Value::U8(v) => write!(f, "u8({})", v),
            Value::I8(v) => write!(f, "i8({})", v),
            Value::U16(v) => write!(f, "u16({})", v),
            Value::I16(v) => write!(f, "i16({})", v),
            Value::U32(v) => write!(f, "u32({})", v),
            Value::I32(v) => write!(f, "i32({})", v),
            Value::U64(v) => write!(f, "u64({})", v),
            Value::I64(v) => write!(f, "i64({})", v),
            Value::F32(v) => write!(f, "f32({})", v),
            Value::F64(v) => write!(f, "f64({})", v),
            Value::Ptr(ptr) => write!(f, "ptr({:p})", ptr),
            Value::OwnedPtr(owned) => write!(f, "owned_ptr({:p})", owned.ptr),
            Value::TrampolineCallback(cb) => write!(f, "trampoline_callback({:p})", cb.trampoline_ptr),
            Value::Void => write!(f, "void"),
        }
    }
}

impl Value {
    pub fn as_ptr(&self) -> *mut c_void {
        match self {
            Value::U8(value) => value as *const u8 as *mut c_void,
            Value::I8(value) => value as *const i8 as *mut c_void,
            Value::U16(value) => value as *const u16 as *mut c_void,
            Value::I16(value) => value as *const i16 as *mut c_void,
            Value::U32(value) => value as *const u32 as *mut c_void,
            Value::I32(value) => value as *const i32 as *mut c_void,
            Value::U64(value) => value as *const u64 as *mut c_void,
            Value::I64(value) => value as *const i64 as *mut c_void,
            Value::F32(value) => value as *const f32 as *mut c_void,
            Value::F64(value) => value as *const f64 as *mut c_void,
            Value::Ptr(ptr) => ptr as *const *mut c_void as *mut c_void,
            Value::OwnedPtr(owned_ptr) => owned_ptr as *const OwnedPtr as *mut c_void,
            Value::TrampolineCallback(_) => {
                unreachable!(
                    "TrampolineCallback should not be converted to a single pointer - it requires special handling in call.rs"
                )
            }
            Value::Void => std::ptr::null_mut(),
        }
    }
}

impl<'a> From<&'a Value> for libffi::Arg<'a> {
    fn from(arg: &'a Value) -> Self {
        match arg {
            Value::U8(value) => libffi::arg(value),
            Value::I8(value) => libffi::arg(value),
            Value::U16(value) => libffi::arg(value),
            Value::I16(value) => libffi::arg(value),
            Value::U32(value) => libffi::arg(value),
            Value::I32(value) => libffi::arg(value),
            Value::U64(value) => libffi::arg(value),
            Value::I64(value) => libffi::arg(value),
            Value::F32(value) => libffi::arg(value),
            Value::F64(value) => libffi::arg(value),
            Value::Ptr(ptr) => libffi::arg(ptr),
            Value::OwnedPtr(owned_ptr) => libffi::arg(&owned_ptr.ptr),
            Value::TrampolineCallback(_) => {
                unreachable!("TrampolineCallback should be handled specially in call.rs")
            }
            Value::Void => libffi::arg(&()),
        }
    }
}

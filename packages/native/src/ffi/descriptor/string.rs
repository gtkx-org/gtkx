use std::ffi::{CString, c_char};

use anyhow::bail;
use glib::translate::ToGlibPtr;

use super::prelude::*;

pub fn str_to_glib_full(s: &str) -> anyhow::Result<*mut c_char> {
    if s.as_bytes().contains(&0) {
        bail!("String contains an interior NUL byte");
    }
    Ok(ToGlibPtr::<*mut c_char>::to_glib_full(s))
}

#[derive(Debug, Clone, Copy)]
pub struct StringDescriptor {
    pub ownership: Ownership,
    pub length: Option<usize>,
}

impl FfiEncoder for StringDescriptor {
    fn encode(&self, value: &value::Value) -> anyhow::Result<ffi::StashedValue> {
        match value {
            value::Value::String(s) => {
                if self.ownership.is_full() {
                    let glib_ptr = str_to_glib_full(s)? as *mut c_void;
                    Ok(ffi::StashedValue::Storage(
                        ffi::Stash::unit(glib_ptr)
                            .with_pending_transfer(glib_ptr, ffi::PendingRelease::GFree),
                    ))
                } else {
                    let cstring = CString::new(s.as_bytes())?;
                    let ptr = cstring.as_ptr() as *mut c_void;
                    Ok(ffi::StashedValue::Storage(ffi::Stash::new(
                        ptr,
                        ffi::StashKind::CString(cstring),
                    )))
                }
            }
            value::Value::Null | value::Value::Undefined => {
                Ok(ffi::StashedValue::Ptr(std::ptr::null_mut()))
            }
            _ => bail!("Expected a String for string descriptor, got {value:?}"),
        }
    }
}

impl FfiDecoder for StringDescriptor {
    fn read_call(&self, stashed_value: &ffi::StashedValue) -> anyhow::Result<value::Value> {
        let Some(str_ptr) = stashed_value.as_non_null_ptr("string")? else {
            return Ok(value::Value::Null);
        };

        let string = unsafe { glib::GStr::from_ptr_lossy(str_ptr as *const c_char) }.to_string();

        if self.ownership.is_full() {
            unsafe { glib::ffi::g_free(str_ptr) };
        }

        Ok(value::Value::String(string))
    }

    unsafe fn read_value(&self, ptr: *mut c_void, _context: &str) -> anyhow::Result<value::Value> {
        self.null_guarded(ptr, |ptr| {
            let string = unsafe { glib::GStr::from_ptr_lossy(ptr as *const c_char) }.to_string();
            Ok(value::Value::String(string))
        })
    }
}

impl PointerWriter for StringDescriptor {
    unsafe fn write_return_to_pointer(&self, ret: *mut c_void, value: &Result<value::Value, ()>) {
        let ptr = match value {
            Ok(value::Value::String(s)) => {
                str_to_glib_full(s).map_or(std::ptr::null_mut(), |p| p as *mut c_void)
            }
            _ => std::ptr::null_mut(),
        };
        unsafe { *(ret as *mut *mut c_void) = ptr };
    }

    unsafe fn write_value_to_pointer(
        &self,
        ptr: *mut c_void,
        value: &value::Value,
    ) -> anyhow::Result<()> {
        match value {
            value::Value::String(s) => {
                let duped = str_to_glib_full(s)?;
                unsafe { (ptr as *mut *mut c_char).write_unaligned(duped) };
            }
            value::Value::Null | value::Value::Undefined => unsafe {
                (ptr as *mut *const c_char).write_unaligned(std::ptr::null());
            },
            _ => bail!("Expected a String for string field write, got {value:?}"),
        }
        Ok(())
    }
}

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
pub struct StringCodec {
    pub ownership: Ownership,
    pub length: Option<usize>,
}

impl Encoder for StringCodec {
    fn encode(&self, value: &value::Value) -> anyhow::Result<ffi::StashedValue> {
        match value {
            value::Value::String(s) => {
                if self.ownership.is_full() {
                    let glib_ptr = str_to_glib_full(s)? as *mut c_void;
                    Ok(full_transfer_stashed(glib_ptr, ffi::PendingRelease::GFree))
                } else {
                    let cstring = CString::new(s.as_bytes())?;
                    let ptr = cstring.as_ptr() as *mut c_void;
                    Ok(ffi::StashedValue::Stashed(ffi::Stash::new(
                        ptr,
                        ffi::StashStorage::CString(cstring),
                    )))
                }
            }
            value::Value::Null | value::Value::Undefined => {
                Ok(ffi::StashedValue::Ptr(std::ptr::null_mut()))
            }
            _ => bail!("Expected a String for string codec, got {value:?}"),
        }
    }
}

impl Decoder for StringCodec {
    fn read_call(&self, stashed_value: &ffi::StashedValue) -> anyhow::Result<value::Value> {
        self.read_call_non_null(stashed_value, "string", |str_ptr| {
            let string = unsafe { lossy_c_string(str_ptr as *const c_char) };

            if self.ownership.is_full() {
                unsafe { glib::ffi::g_free(str_ptr) };
            }

            Ok(value::Value::String(string))
        })
    }

    unsafe fn read_value(&self, ptr: *mut c_void, _context: &str) -> anyhow::Result<value::Value> {
        self.decode_non_null(ptr, |ptr| {
            let string = unsafe { lossy_c_string(ptr as *const c_char) };
            Ok(value::Value::String(string))
        })
    }
}

impl PtrWriter for StringCodec {
    unsafe fn write_return_to_ptr(&self, ret: *mut c_void, value: &Result<value::Value, ()>) {
        let ptr = match value {
            Ok(value::Value::String(s)) => {
                str_to_glib_full(s).map_or(std::ptr::null_mut(), |p| p as *mut c_void)
            }
            _ => std::ptr::null_mut(),
        };
        unsafe { ffi::Slot::new(ret).store(ptr) };
    }

    unsafe fn write_value_to_ptr(
        &self,
        ptr: *mut c_void,
        value: &value::Value,
    ) -> anyhow::Result<()> {
        match value {
            value::Value::String(s) => {
                let duped = str_to_glib_full(s)?;
                unsafe { ffi::Slot::new(ptr).store(duped.cast()) };
            }
            value::Value::Null | value::Value::Undefined => unsafe {
                ffi::Slot::new(ptr).store(std::ptr::null_mut());
            },
            _ => bail!("Expected a String for string field write, got {value:?}"),
        }
        Ok(())
    }
}

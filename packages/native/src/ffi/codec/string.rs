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
    fn encode(&self, value: &value::Value) -> anyhow::Result<ffi::Stash> {
        match value {
            value::Value::String(s) => {
                if self.ownership.is_full() {
                    let glib_ptr = str_to_glib_full(s)? as *mut c_void;
                    Ok(full_transfer_stash(glib_ptr, ffi::ReleaseKind::GFree))
                } else {
                    let cstring = CString::new(s.as_bytes())?;
                    let ptr = cstring.as_ptr() as *mut c_void;
                    Ok(ffi::Stash::Storage(ffi::StashStorage::new(
                        ptr,
                        ffi::StashData::CString(cstring),
                    )))
                }
            }
            value::Value::Null | value::Value::Undefined => {
                Ok(ffi::Stash::Ptr(std::ptr::null_mut()))
            }
            _ => bail_expected!("a String", "string", value),
        }
    }
}

impl Decoder for StringCodec {
    fn decode_call(&self, stash: &ffi::Stash) -> anyhow::Result<value::Value> {
        self.decode_call_non_null(stash, "string", |str_ptr| {
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
    fn write_return_to_ptr(&self, ret: ffi::Slot, value: &Result<value::Value, ()>) {
        let ptr = match value {
            Ok(value::Value::String(s)) => {
                str_to_glib_full(s).map_or(std::ptr::null_mut(), |p| p as *mut c_void)
            }
            _ => std::ptr::null_mut(),
        };
        unsafe { ret.store(ptr) };
    }

    fn write_value_to_ptr(&self, slot: ffi::Slot, value: &value::Value) -> anyhow::Result<()> {
        match value {
            value::Value::String(s) => {
                let glib_ptr = str_to_glib_full(s)?;
                unsafe { slot.store(glib_ptr.cast()) };
            }
            value::Value::Null | value::Value::Undefined => {
                unsafe { slot.store(std::ptr::null_mut()) };
            }
            _ => bail!("Expected a String for string field write, got {value:?}"),
        }
        Ok(())
    }
}

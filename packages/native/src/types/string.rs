use std::ffi::{CString, c_char};

use anyhow::bail;
use glib::translate::ToGlibPtr;
use napi::{Env, JsObject};

use super::prelude::*;

pub fn str_to_glib_full(s: &str) -> anyhow::Result<*mut c_char> {
    if s.as_bytes().contains(&0) {
        bail!("String contains an interior NUL byte");
    }
    Ok(ToGlibPtr::<*mut c_char>::to_glib_full(s))
}

#[derive(Debug, Clone, Copy)]
pub struct StringType {
    pub ownership: Ownership,
    pub length: Option<usize>,
}

impl FromDescriptor for StringType {
    #[cfg_attr(coverage_nightly, coverage(off))]
    fn from_descriptor(_env: &Env, obj: &JsObject) -> napi::Result<Self> {
        let ownership = Ownership::from_js_value(obj, "string")?;

        let length: Option<usize> =
            super::optional_descriptor_property::<f64>(obj, "length")?.map(|n| n as usize);

        Ok(Self { ownership, length })
    }
}

impl FfiEncoder for StringType {
    fn encode(&self, value: &value::Value) -> anyhow::Result<ffi::FfiValue> {
        match value {
            value::Value::String(s) => {
                if self.ownership.is_full() {
                    let glib_ptr = str_to_glib_full(s)? as *mut c_void;
                    Ok(ffi::FfiValue::Storage(
                        ffi::FfiStorage::unit(glib_ptr)
                            .with_pending_transfer(glib_ptr, ffi::PendingRelease::GFree),
                    ))
                } else {
                    let cstring = CString::new(s.as_bytes())?;
                    let ptr = cstring.as_ptr() as *mut c_void;
                    Ok(ffi::FfiValue::Storage(ffi::FfiStorage::new(
                        ptr,
                        ffi::FfiStorageKind::CString(cstring),
                    )))
                }
            }
            value::Value::Null | value::Value::Undefined => {
                Ok(ffi::FfiValue::Ptr(std::ptr::null_mut()))
            }
            _ => bail!("Expected a String for string type, got {value:?}"),
        }
    }
}

impl FfiDecoder for StringType {
    fn read_call(&self, ffi_value: &ffi::FfiValue) -> anyhow::Result<value::Value> {
        let Some(str_ptr) = ffi_value.as_non_null_ptr("string")? else {
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

impl RawPtrCodec for StringType {
    unsafe fn write_return_to_raw_ptr(&self, ret: *mut c_void, value: &Result<value::Value, ()>) {
        let ptr = match value {
            Ok(value::Value::String(s)) => {
                str_to_glib_full(s).map_or(std::ptr::null_mut(), |p| p as *mut c_void)
            }
            _ => std::ptr::null_mut(),
        };
        unsafe { *(ret as *mut *mut c_void) = ptr };
    }

    unsafe fn write_value_to_raw_ptr(
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

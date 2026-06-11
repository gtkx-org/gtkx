use std::ffi::{CString, c_char};

use anyhow::bail;
use gtk4::glib;
use gtk4::glib::translate::ToGlibPtr;
use napi::{Env, JsObject};

use super::prelude::*;

/// Duplicates `s` into a single `g_malloc`-owned, NUL-terminated C string the
/// callee (or a transfer-full slot) takes ownership of.
///
/// Performs one allocation (`g_strndup`) instead of the `CString` + `g_strdup`
/// pair. Interior NUL bytes are rejected up front so a JS string containing
/// U+0000 surfaces as an error instead of being silently truncated.
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

impl StringType {
    #[cfg_attr(coverage_nightly, coverage(off))]
    pub fn from_js_value(_env: &Env, obj: &JsObject) -> napi::Result<Self> {
        let ownership = Ownership::from_js_value(obj, "string")?;

        let length: Option<usize> =
            super::optional_descriptor_property::<f64>(obj, "length")?.map(|n| n as usize);

        Ok(Self { ownership, length })
    }
}

impl FfiEncoder for StringType {
    fn encode(&self, value: &value::Value, _optional: bool) -> anyhow::Result<ffi::FfiValue> {
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
    fn decode(&self, ffi_value: &ffi::FfiValue) -> anyhow::Result<value::Value> {
        let Some(str_ptr) = ffi_value.as_non_null_ptr("string")? else {
            return Ok(value::Value::Null);
        };

        // SAFETY: A non-null string return from the native call is a live
        // NUL-terminated C string.
        let string = unsafe { glib::GStr::from_ptr_lossy(str_ptr as *const c_char) }.to_string();

        if self.ownership.is_full() {
            // SAFETY: A transfer-full return hands this decode the one
            // owned allocation, released here exactly once after copying.
            unsafe { glib::ffi::g_free(str_ptr) };
        }

        Ok(value::Value::String(string))
    }
}

impl RawPtrCodec for StringType {
    unsafe fn ptr_to_value(
        &self,
        ptr: *mut c_void,
        _context: &str,
    ) -> anyhow::Result<value::Value> {
        null_guarded(ptr, |ptr| {
            // SAFETY: The caller guarantees the non-null `ptr` addresses a
            // live NUL-terminated C string.
            let string = unsafe { glib::GStr::from_ptr_lossy(ptr as *const c_char) }.to_string();
            Ok(value::Value::String(string))
        })
    }

    unsafe fn write_return_to_raw_ptr(&self, ret: *mut c_void, value: &Result<value::Value, ()>) {
        let ptr = match value {
            Ok(value::Value::String(s)) => {
                str_to_glib_full(s).map_or(std::ptr::null_mut(), |p| p as *mut c_void)
            }
            _ => std::ptr::null_mut(),
        };
        // SAFETY: The caller guarantees `ret` is a writable pointer-sized
        // return slot.
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
                // SAFETY: The caller guarantees `ptr` is a writable
                // pointer-sized slot; the write is unaligned-tolerant.
                unsafe { (ptr as *mut *mut c_char).write_unaligned(duped) };
            }
            // SAFETY: The caller guarantees `ptr` is a writable
            // pointer-sized slot; the write is unaligned-tolerant.
            value::Value::Null | value::Value::Undefined => unsafe {
                (ptr as *mut *const c_char).write_unaligned(std::ptr::null());
            },
            _ => bail!("Expected a String for string field write, got {value:?}"),
        }
        Ok(())
    }
}

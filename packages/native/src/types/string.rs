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

        // SAFETY: `str_ptr` is the non-null `char*` returned by the C call; `from_ptr_lossy` reads
        // a NUL-terminated C string from it, which the callee guarantees for a string return.
        let string = unsafe { glib::GStr::from_ptr_lossy(str_ptr as *const c_char) }.to_string();

        if self.ownership.is_full() {
            // SAFETY: full ownership means the callee transferred the string to us; `str_ptr` is a
            // `g_malloc`-allocated C string, so `g_free` releases it exactly once after we copied it.
            unsafe { glib::ffi::g_free(str_ptr) };
        }

        Ok(value::Value::String(string))
    }

    unsafe fn read_value(&self, ptr: *mut c_void, _context: &str) -> anyhow::Result<value::Value> {
        self.null_guarded(ptr, |ptr| {
            // SAFETY: `null_guarded` only invokes this with a non-null `ptr`; per `read_value`'s
            // contract it points to a NUL-terminated C string, which `from_ptr_lossy` reads.
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
        // SAFETY: `ret` is a marshalling-provided return slot for a pointer-sized value; writing the
        // owned (`g_malloc`-allocated) or null string pointer into it transfers ownership to the callee.
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
                // SAFETY: `ptr` is a marshalling-provided field slot of pointer size; `write_unaligned`
                // stores the freshly owned C string into it without an alignment requirement.
                unsafe { (ptr as *mut *mut c_char).write_unaligned(duped) };
            }
            // SAFETY: `ptr` is a marshalling-provided field slot of pointer size; `write_unaligned`
            // stores a null pointer into it without an alignment requirement.
            value::Value::Null | value::Value::Undefined => unsafe {
                (ptr as *mut *const c_char).write_unaligned(std::ptr::null());
            },
            _ => bail!("Expected a String for string field write, got {value:?}"),
        }
        Ok(())
    }
}

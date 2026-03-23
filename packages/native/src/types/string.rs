use std::ffi::{CStr, CString, c_char, c_void};

use anyhow::bail;
use gtk4::glib;
use neon::prelude::*;

use super::{FfiCodec, Ownership};
use crate::{ffi, value};

#[derive(Debug, Clone, Copy)]
pub struct StringType {
    pub ownership: Ownership,
    pub length: Option<usize>,
}

impl StringType {
    pub fn from_js_value(cx: &mut FunctionContext, value: Handle<JsValue>) -> NeonResult<Self> {
        let obj = value.downcast::<JsObject, _>(cx).or_throw(cx)?;
        let ownership = Ownership::from_js_value(cx, obj, "string")?;

        let length_prop: Handle<'_, JsValue> = obj.prop(cx, "length").get()?;
        let length = length_prop
            .downcast::<JsNumber, _>(cx)
            .map(|n| n.value(cx) as usize)
            .ok();

        Ok(StringType { ownership, length })
    }
}

impl FfiCodec for StringType {
    fn encode(&self, value: &value::Value, _optional: bool) -> anyhow::Result<ffi::FfiValue> {
        match value {
            value::Value::String(s) => {
                let cstring = CString::new(s.as_bytes())?;
                if self.ownership.is_full() {
                    let glib_ptr = unsafe { glib::ffi::g_strdup(cstring.as_ptr()) };
                    Ok(ffi::FfiValue::Ptr(glib_ptr as *mut c_void))
                } else {
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
            _ => bail!("Expected a String for string type, got {:?}", value),
        }
    }

    fn decode(&self, ffi_value: &ffi::FfiValue) -> anyhow::Result<value::Value> {
        let Some(str_ptr) = ffi_value.as_non_null_ptr("string")? else {
            return Ok(value::Value::Null);
        };

        let c_str = unsafe { CStr::from_ptr(str_ptr as *const c_char) };
        let string = c_str.to_string_lossy().into_owned();

        if self.ownership.is_full() {
            unsafe { glib::ffi::g_free(str_ptr) };
        }

        Ok(value::Value::String(string))
    }

    fn from_glib_value(&self, gvalue: &glib::Value) -> anyhow::Result<value::Value> {
        let string: String = gvalue
            .get()
            .map_err(|e| anyhow::anyhow!("Failed to get String from GValue: {}", e))?;
        Ok(value::Value::String(string))
    }

    fn ptr_to_value(&self, ptr: *mut c_void, _context: &str) -> anyhow::Result<value::Value> {
        if ptr.is_null() {
            return Ok(value::Value::Null);
        }
        let c_str = unsafe { CStr::from_ptr(ptr as *const c_char) };
        Ok(value::Value::String(c_str.to_string_lossy().into_owned()))
    }

    fn read_from_raw_ptr(&self, ptr: *const c_void, context: &str) -> anyhow::Result<value::Value> {
        let inner_ptr = unsafe { *(ptr as *const *mut c_void) };
        self.ptr_to_value(inner_ptr, context)
    }

    fn write_return_to_raw_ptr(&self, ret: *mut c_void, value: &Result<value::Value, ()>) {
        let ptr = match value {
            Ok(value::Value::String(s)) => CString::new(s.as_bytes())
                .ok()
                .map(|cs| unsafe { glib::ffi::g_strdup(cs.as_ptr()) as *mut c_void })
                .unwrap_or(std::ptr::null_mut()),
            _ => std::ptr::null_mut(),
        };
        unsafe { *(ret as *mut *mut c_void) = ptr };
    }
}

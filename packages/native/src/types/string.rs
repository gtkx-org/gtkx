use std::ffi::{CStr, CString, c_char, c_void};

use anyhow::bail;
use gtk4::glib;
use libffi::middle as libffi;
use neon::prelude::*;

use super::Ownership;
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

impl From<&StringType> for libffi::Type {
    fn from(_: &StringType) -> Self {
        libffi::Type::pointer()
    }
}

impl StringType {
    pub fn encode(&self, value: &value::Value, _optional: bool) -> anyhow::Result<ffi::FfiValue> {
        match value {
            value::Value::String(s) => {
                let cstring = CString::new(s.as_bytes())?;
                let ptr = cstring.as_ptr() as *mut c_void;
                Ok(ffi::FfiValue::Storage(ffi::FfiStorage::new(
                    ptr,
                    ffi::FfiStorageKind::CString(cstring),
                )))
            }
            value::Value::Null | value::Value::Undefined => {
                Ok(ffi::FfiValue::Ptr(std::ptr::null_mut()))
            }
            _ => bail!("Expected a String for string type, got {:?}", value),
        }
    }

    pub fn decode(&self, ffi_value: &ffi::FfiValue) -> anyhow::Result<value::Value> {
        let Some(str_ptr) = ffi_value.as_non_null_ptr("string")? else {
            return Ok(value::Value::Null);
        };

        let c_str = unsafe { CStr::from_ptr(str_ptr as *const c_char) };
        let string = c_str.to_str()?.to_string();

        if self.ownership.is_full() {
            unsafe { glib::ffi::g_free(str_ptr) };
        }

        Ok(value::Value::String(string))
    }

    /// # Safety
    /// `ptr` must be null or point to a valid null-terminated C string.
    pub unsafe fn ptr_to_value(ptr: *mut c_void) -> value::Value {
        if ptr.is_null() {
            return value::Value::Null;
        }
        let c_str = unsafe { CStr::from_ptr(ptr as *const c_char) };
        value::Value::String(c_str.to_string_lossy().into_owned())
    }

    pub fn from_glib_value(gvalue: &glib::Value) -> anyhow::Result<value::Value> {
        let string: String = gvalue
            .get()
            .map_err(|e| anyhow::anyhow!("Failed to get String from GValue: {}", e))?;
        Ok(value::Value::String(string))
    }

    /// # Safety
    /// `ret` must point to a writable return value buffer.
    pub unsafe fn write_return_value(ret: *mut c_void, js_result: &Result<value::Value, ()>) {
        let ptr = match js_result {
            Ok(value::Value::String(s)) => CString::new(s.as_bytes())
                .ok()
                .map(|cs| unsafe { glib::ffi::g_strdup(cs.as_ptr()) as *mut c_void })
                .unwrap_or(std::ptr::null_mut()),
            _ => std::ptr::null_mut(),
        };
        unsafe { *(ret as *mut *mut c_void) = ptr };
    }
}

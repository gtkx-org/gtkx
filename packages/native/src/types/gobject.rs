use std::ffi::c_void;

use anyhow::bail;
use gtk4::glib::{
    self,
    translate::{FromGlibPtrFull as _, FromGlibPtrNone as _, ToGlibPtr as _},
};
use neon::prelude::*;

use super::{FfiCodec, Ownership};
use crate::managed::NativeValue;
use crate::{ffi, value};

fn extract_object_ptr(value: &Result<value::Value, ()>) -> *mut c_void {
    match value {
        Ok(value::Value::Object(handle)) => handle.get_ptr().unwrap_or(std::ptr::null_mut()),
        _ => std::ptr::null_mut(),
    }
}

#[derive(Debug, Clone, Copy)]
pub struct GObjectType {
    pub ownership: Ownership,
}

impl GObjectType {
    pub fn from_js_value(cx: &mut FunctionContext, value: Handle<JsValue>) -> NeonResult<Self> {
        let obj = value.downcast::<JsObject, _>(cx).or_throw(cx)?;
        let ownership = Ownership::from_js_value(cx, obj, "gobject")?;
        Ok(Self { ownership })
    }
}

impl FfiCodec for GObjectType {
    fn encode(&self, value: &value::Value, _optional: bool) -> anyhow::Result<ffi::FfiValue> {
        let ptr = value.object_ptr("GObject")?;

        if self.ownership.is_full() && !ptr.is_null() {
            unsafe { glib::gobject_ffi::g_object_ref(ptr as *mut _) };
        }

        Ok(ffi::FfiValue::Ptr(ptr))
    }

    fn decode(&self, ffi_value: &ffi::FfiValue) -> anyhow::Result<value::Value> {
        let Some(object_ptr) = ffi_value.as_non_null_ptr("GObject")? else {
            return Ok(value::Value::Null);
        };

        let gobject_ptr = object_ptr as *mut glib::gobject_ffi::GObject;

        let type_class = unsafe { (*gobject_ptr).g_type_instance.g_class };
        if type_class.is_null() {
            bail!("GObject has invalid type class (object may have been freed)");
        }

        let is_floating = unsafe { glib::gobject_ffi::g_object_is_floating(gobject_ptr) != 0 };

        let object = if is_floating {
            unsafe { glib::gobject_ffi::g_object_ref_sink(gobject_ptr) };
            NativeValue::GObject(unsafe { glib::Object::from_glib_full(gobject_ptr) })
        } else if self.ownership.is_full() {
            NativeValue::GObject(unsafe { glib::Object::from_glib_full(gobject_ptr) })
        } else {
            NativeValue::GObject(unsafe { glib::Object::from_glib_none(gobject_ptr) })
        };

        Ok(value::Value::Object(object.into()))
    }

    fn from_glib_value(&self, gvalue: &glib::Value) -> anyhow::Result<value::Value> {
        let obj_ptr =
            unsafe { glib::gobject_ffi::g_value_get_object(gvalue.to_glib_none().0 as *const _) };
        if obj_ptr.is_null() {
            return Ok(value::Value::Null);
        }
        let type_class = unsafe { (*obj_ptr).g_type_instance.g_class };
        if type_class.is_null() {
            bail!("GObject has invalid type class (object may have been freed)");
        }
        let obj = unsafe { glib::Object::from_glib_none(obj_ptr) };
        Ok(value::Value::Object(NativeValue::GObject(obj).into()))
    }

    fn ptr_to_value(&self, ptr: *mut c_void, _context: &str) -> anyhow::Result<value::Value> {
        if ptr.is_null() {
            return Ok(value::Value::Null);
        }
        let gobject_ptr = ptr as *mut glib::gobject_ffi::GObject;
        let type_class = unsafe { (*gobject_ptr).g_type_instance.g_class };
        if type_class.is_null() {
            bail!("GObject has invalid type class (object may have been freed)");
        }
        let object = unsafe { glib::Object::from_glib_none(gobject_ptr) };
        Ok(value::Value::Object(NativeValue::GObject(object).into()))
    }

    fn read_from_raw_ptr(&self, ptr: *const c_void, context: &str) -> anyhow::Result<value::Value> {
        let inner_ptr = unsafe { *(ptr as *const *mut c_void) };
        self.ptr_to_value(inner_ptr, context)
    }

    fn write_return_to_raw_ptr(&self, ret: *mut c_void, value: &Result<value::Value, ()>) {
        let ptr = extract_object_ptr(value);
        if !ptr.is_null() {
            unsafe {
                glib::gobject_ffi::g_object_ref(ptr as *mut glib::gobject_ffi::GObject);
            }
        }
        unsafe { *(ret as *mut *mut c_void) = ptr };
    }

    fn ref_for_transfer(&self, ptr: *mut c_void) -> anyhow::Result<*mut c_void> {
        if self.ownership.is_full() && !ptr.is_null() {
            unsafe { glib::gobject_ffi::g_object_ref(ptr as *mut _) };
        }
        Ok(ptr)
    }
}

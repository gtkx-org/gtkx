use std::ffi::c_void;

use anyhow::bail;
use gtk4::glib::{
    self,
    translate::{FromGlibPtrFull as _, FromGlibPtrNone as _, ToGlibPtr as _},
};
use libffi::middle as libffi;
use neon::prelude::*;

use super::Ownership;
use crate::managed::NativeValue;
use crate::{ffi, value};

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

impl From<&GObjectType> for libffi::Type {
    fn from(_: &GObjectType) -> Self {
        libffi::Type::pointer()
    }
}

impl GObjectType {
    pub fn encode(&self, value: &value::Value, _optional: bool) -> anyhow::Result<ffi::FfiValue> {
        let ptr = value.object_ptr("GObject")?;

        if self.ownership.is_full() && !ptr.is_null() {
            unsafe { glib::gobject_ffi::g_object_ref(ptr as *mut _) };
        }

        Ok(ffi::FfiValue::Ptr(ptr))
    }

    pub fn decode(&self, ffi_value: &ffi::FfiValue) -> anyhow::Result<value::Value> {
        let Some(object_ptr) = ffi_value.as_non_null_ptr("GObject")? else {
            return Ok(value::Value::Null);
        };

        let gobject_ptr = object_ptr as *mut glib::gobject_ffi::GObject;

        let object = if self.ownership.is_full() {
            let is_floating = unsafe { glib::gobject_ffi::g_object_is_floating(gobject_ptr) != 0 };
            if is_floating {
                unsafe { glib::gobject_ffi::g_object_ref_sink(gobject_ptr) };
            }
            NativeValue::GObject(unsafe { glib::Object::from_glib_full(gobject_ptr) })
        } else {
            NativeValue::GObject(unsafe { glib::Object::from_glib_none(gobject_ptr) })
        };

        Ok(value::Value::Object(object.into()))
    }

    /// # Safety
    /// `ptr` must be null or point to a valid GObject.
    pub unsafe fn ptr_to_value(ptr: *mut c_void) -> value::Value {
        if ptr.is_null() {
            return value::Value::Null;
        }
        let object =
            unsafe { glib::Object::from_glib_none(ptr as *mut glib::gobject_ffi::GObject) };
        value::Value::Object(NativeValue::GObject(object).into())
    }

    pub fn from_glib_value(gvalue: &glib::Value) -> anyhow::Result<value::Value> {
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

    /// # Safety
    /// `ret` must point to a writable return value buffer, and `ptr` must be null
    /// or point to a valid GObject.
    pub unsafe fn write_return_ptr(ret: *mut c_void, ptr: *mut c_void) {
        if !ptr.is_null() {
            unsafe {
                glib::gobject_ffi::g_object_ref(ptr as *mut glib::gobject_ffi::GObject);
            }
        }
        unsafe { *(ret as *mut *mut c_void) = ptr };
    }
}

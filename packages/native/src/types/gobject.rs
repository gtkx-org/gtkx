use gtk4::glib::{self, translate::FromGlibPtrFull as _, translate::FromGlibPtrNone as _};
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
    pub fn new(ownership: Ownership) -> Self {
        GObjectType { ownership }
    }

    pub fn from_js_value(cx: &mut FunctionContext, value: Handle<JsValue>) -> NeonResult<Self> {
        let obj = value.downcast::<JsObject, _>(cx).or_throw(cx)?;
        let ownership = Ownership::from_js_value(cx, obj, "gobject")?;
        Ok(Self::new(ownership))
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
}

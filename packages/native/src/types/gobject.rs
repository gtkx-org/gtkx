use std::ffi::c_void;

use anyhow::bail;
use gtk4::glib::{
    self,
    prelude::{ObjectExt as _, ObjectType as _},
    translate::{FromGlibPtrFull as _, FromGlibPtrNone as _, ToGlibPtr as _, ToGlibPtrMut as _},
};
use napi::{Env, JsObject};

use super::{FfiDecoder, FfiEncoder, GlibValueCodec, Ownership, RawPtrCodec};
use crate::managed::NativeValue;
use crate::{ffi, value};

#[derive(Debug, Clone, Copy)]
pub struct GObjectType {
    pub ownership: Ownership,
}

impl GObjectType {
    pub fn from_js_value(_env: &Env, obj: &JsObject) -> napi::Result<Self> {
        let ownership = Ownership::from_js_value(obj, "gobject")?;
        Ok(Self { ownership })
    }
}

impl FfiEncoder for GObjectType {
    fn encode(&self, value: &value::Value, _optional: bool) -> anyhow::Result<ffi::FfiValue> {
        let ptr = value.object_ptr("GObject")?;

        if self.ownership.is_full() && !ptr.is_null() {
            unsafe { glib::gobject_ffi::g_object_ref(ptr as *mut _) };
        }

        Ok(ffi::FfiValue::Ptr(ptr))
    }

    fn ref_for_transfer(&self, ptr: *mut c_void) -> anyhow::Result<*mut c_void> {
        if self.ownership.is_full() && !ptr.is_null() {
            unsafe { glib::gobject_ffi::g_object_ref(ptr as *mut _) };
        }
        Ok(ptr)
    }
}

impl FfiDecoder for GObjectType {
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
}

impl RawPtrCodec for GObjectType {
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

    fn write_return_to_raw_ptr(&self, ret: *mut c_void, value: &Result<value::Value, ()>) {
        let ptr = value::Value::result_to_ptr(value);
        if !ptr.is_null() {
            unsafe {
                glib::gobject_ffi::g_object_ref(ptr as *mut glib::gobject_ffi::GObject);
            }
        }
        unsafe { *(ret as *mut *mut c_void) = ptr };
    }

    fn write_value_to_raw_ptr(&self, ptr: *mut c_void, value: &value::Value) -> anyhow::Result<()> {
        let obj_ptr = value.object_ptr("GObject field write")?;
        unsafe { (ptr as *mut *mut c_void).write_unaligned(obj_ptr) };
        Ok(())
    }
}

impl GlibValueCodec for GObjectType {
    fn to_glib_value(&self, val: &value::Value) -> anyhow::Result<Option<glib::Value>> {
        let ptr = match val {
            value::Value::Object(handle) => handle.ptr(),
            value::Value::Null | value::Value::Undefined => {
                return Ok(Some(Option::<glib::Object>::None.into()));
            }
            _ => return Ok(None),
        };
        if ptr.is_null() {
            return Ok(Some(Option::<glib::Object>::None.into()));
        }
        let obj: glib::Object =
            unsafe { glib::Object::from_glib_none(ptr as *mut glib::gobject_ffi::GObject) };
        let mut gvalue = glib::Value::from_type(obj.type_());
        unsafe {
            glib::gobject_ffi::g_value_set_object(
                gvalue.to_glib_none_mut().0,
                obj.as_ptr() as *mut _,
            );
        }
        Ok(Some(gvalue))
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
}

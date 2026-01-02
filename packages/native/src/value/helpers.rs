use std::ffi::{CStr, c_void};

use anyhow::bail;
use gtk4::glib::{self, translate::ToGlibPtr as _};

use super::Value;
use crate::{
    boxed::Boxed,
    cif,
    object::Object,
    types::Type,
};

pub(super) struct GListGuard {
    ptr: *mut glib::ffi::GList,
    should_free: bool,
}

impl GListGuard {
    pub fn new(ptr: *mut c_void, should_free: bool) -> Self {
        Self {
            ptr: ptr as *mut glib::ffi::GList,
            should_free,
        }
    }
}

impl Drop for GListGuard {
    fn drop(&mut self) {
        if self.should_free && !self.ptr.is_null() {
            unsafe {
                glib::ffi::g_list_free(self.ptr);
            }
        }
    }
}

pub(super) fn gobject_from_raw_ptr(obj_ptr: *mut glib::gobject_ffi::GObject) -> anyhow::Result<Value> {
    use glib::translate::FromGlibPtrNone as _;

    if obj_ptr.is_null() {
        return Ok(Value::Null);
    }

    let type_class = unsafe { (*obj_ptr).g_type_instance.g_class };
    if type_class.is_null() {
        bail!("GObject has invalid type class (object may have been freed)");
    }

    let obj = unsafe { glib::Object::from_glib_none(obj_ptr) };
    Ok(Value::Object(Object::GObject(obj).into()))
}

pub(super) fn gobject_from_gvalue(gvalue: &glib::Value) -> anyhow::Result<Value> {
    let obj_ptr = unsafe {
        glib::gobject_ffi::g_value_get_object(gvalue.to_glib_none().0 as *const _)
    };
    gobject_from_raw_ptr(obj_ptr)
}

pub(super) fn extract_ptr_from_cif(cif_value: &cif::Value, type_name: &str) -> anyhow::Result<*mut c_void> {
    match cif_value {
        cif::Value::Ptr(ptr) => Ok(*ptr),
        _ => bail!(
            "Expected a pointer cif::Value for {}, got {:?}",
            type_name,
            cif_value
        ),
    }
}

pub(super) fn cif_to_number(cif_value: &cif::Value) -> anyhow::Result<f64> {
    match cif_value {
        cif::Value::I8(v) => Ok(*v as f64),
        cif::Value::U8(v) => Ok(*v as f64),
        cif::Value::I16(v) => Ok(*v as f64),
        cif::Value::U16(v) => Ok(*v as f64),
        cif::Value::I32(v) => Ok(*v as f64),
        cif::Value::U32(v) => Ok(*v as f64),
        cif::Value::I64(v) => Ok(*v as f64),
        cif::Value::U64(v) => Ok(*v as f64),
        cif::Value::F32(v) => Ok(*v as f64),
        cif::Value::F64(v) => Ok(*v),
        _ => bail!("Expected a number cif::Value, got {:?}", cif_value),
    }
}

pub(super) fn glist_item_to_value(data: *mut c_void, item_type: &Type) -> anyhow::Result<Value> {
    use glib::translate::FromGlibPtrNone as _;

    match item_type {
        Type::GObject(_) => {
            if data.is_null() {
                Ok(Value::Null)
            } else {
                let object =
                    unsafe { glib::Object::from_glib_none(data as *mut glib::gobject_ffi::GObject) };
                Ok(Value::Object(Object::GObject(object).into()))
            }
        }
        Type::Boxed(boxed_type) => {
            if data.is_null() {
                Ok(Value::Null)
            } else {
                let gtype = boxed_type.get_gtype();
                let boxed = Boxed::from_glib_none(gtype, data);
                Ok(Value::Object(Object::Boxed(boxed).into()))
            }
        }
        Type::String(_) => {
            if data.is_null() {
                Ok(Value::Null)
            } else {
                let c_str = unsafe { CStr::from_ptr(data as *const i8) };
                Ok(Value::String(c_str.to_string_lossy().into_owned()))
            }
        }
        _ => bail!("Unsupported GList item type: {:?}", item_type),
    }
}

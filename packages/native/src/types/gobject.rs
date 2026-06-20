use anyhow::bail;
use glib::{
    self,
    prelude::StaticType as _,
    translate::{
        Borrowed, FromGlibPtrNone as _, IntoGlibPtr, ToGlibPtr, from_glib, from_glib_borrow,
        from_glib_full,
    },
};
use napi::{Env, JsObject};

use super::prelude::*;
use crate::managed::NativeHandle;
use crate::toggle_ref;

unsafe fn load_type_class(
    ptr: *mut glib::gobject_ffi::GObject,
) -> anyhow::Result<*mut glib::gobject_ffi::GTypeClass> {
    let type_class = unsafe { (*ptr).g_type_instance.g_class };
    if type_class.is_null() {
        bail!("GObject has invalid type class (object may have been freed)");
    }
    Ok(type_class)
}

#[cfg_attr(coverage_nightly, coverage(off))]
fn tracked_gobject_value(
    gobject_ptr: *mut glib::gobject_ffi::GObject,
    ownership: Ownership,
) -> anyhow::Result<value::Value> {
    let type_class = unsafe { load_type_class(gobject_ptr)? };
    let gtype: glib::Type = unsafe { from_glib((*type_class).g_type) };
    let is_initially_unowned = gtype.is_a(glib::InitiallyUnowned::static_type());
    let is_floating = unsafe { glib::gobject_ffi::g_object_is_floating(gobject_ptr) != 0 };
    let has_wrapper = unsafe { toggle_ref::WrapperRegistry::global().has_wrapper(gobject_ptr) };

    if ownership.is_full() {
        if is_floating || (!has_wrapper && is_initially_unowned) {
            unsafe { glib::gobject_ffi::g_object_ref_sink(gobject_ptr) };
        }
    } else {
        unsafe { glib::gobject_ffi::g_object_ref(gobject_ptr) };
    }

    Ok(value::Value::Object(NativeHandle::decoded_gobject(
        gobject_ptr.cast(),
    )))
}

#[derive(Debug, Clone, Copy)]
pub struct GObjectType {
    pub ownership: Ownership,
}

impl FromDescriptor for GObjectType {
    #[cfg_attr(coverage_nightly, coverage(off))]
    fn from_descriptor(_env: &Env, obj: &JsObject) -> napi::Result<Self> {
        let ownership = Ownership::from_js_value(obj, "gobject")?;
        Ok(Self { ownership })
    }
}

impl FfiEncoder for GObjectType {
    fn encode(&self, value: &value::Value) -> anyhow::Result<ffi::FfiValue> {
        let ptr = value.object_ptr("GObject")?;
        let transferred = unsafe { self.ref_for_transfer(ptr)? };
        if self.ownership.is_full() && !transferred.is_null() {
            return Ok(full_transfer_storage(
                transferred,
                ffi::PendingRelease::ObjectUnref,
            ));
        }
        Ok(ffi::FfiValue::Ptr(transferred))
    }

    fn transfer_release(&self) -> Option<ffi::PendingRelease> {
        self.ownership
            .is_full()
            .then_some(ffi::PendingRelease::ObjectUnref)
    }

    unsafe fn ref_for_transfer(&self, ptr: *mut c_void) -> anyhow::Result<*mut c_void> {
        if self.ownership.is_full() && !ptr.is_null() {
            let obj: glib::Object =
                unsafe { glib::Object::from_glib_none(ptr as *mut glib::gobject_ffi::GObject) };
            return Ok(
                IntoGlibPtr::<*mut glib::gobject_ffi::GObject>::into_glib_ptr(obj).cast::<c_void>(),
            );
        }
        Ok(ptr)
    }
}

impl FfiDecoder for GObjectType {
    unsafe fn read(&self, src: ReadSource<'_>) -> anyhow::Result<value::Value> {
        match src {
            ReadSource::Call(ffi_value) => {
                let Some(object_ptr) = ffi_value.as_non_null_ptr("GObject")? else {
                    return Ok(value::Value::Null);
                };
                tracked_gobject_value(
                    object_ptr as *mut glib::gobject_ffi::GObject,
                    self.ownership,
                )
            }
            ReadSource::Value(ptr, _context) => self.null_guarded(ptr, |ptr| {
                tracked_gobject_value(ptr as *mut glib::gobject_ffi::GObject, Ownership::Borrowed)
            }),
            ReadSource::Slot(ptr, context) => unsafe { self.read_pointer_slot(ptr, context) },
        }
    }
}

impl RawPtrCodec for GObjectType {
    unsafe fn write_return_to_raw_ptr(&self, ret: *mut c_void, value: &Result<value::Value, ()>) {
        self.write_return_with_ownership(ret, value, self.ownership, |ptr| {
            let obj: glib::Object =
                unsafe { glib::Object::from_glib_none(ptr as *mut glib::gobject_ffi::GObject) };
            IntoGlibPtr::<*mut glib::gobject_ffi::GObject>::into_glib_ptr(obj).cast::<c_void>()
        });
    }

    unsafe fn write_value_to_raw_ptr(
        &self,
        ptr: *mut c_void,
        value: &value::Value,
    ) -> anyhow::Result<()> {
        unsafe {
            swap_owned_slot(
                ptr,
                value,
                "GObject field write",
                |new_ptr| {
                    let borrowed_new: Borrowed<glib::Object> =
                        from_glib_borrow(new_ptr as *mut glib::gobject_ffi::GObject);
                    ToGlibPtr::<*mut glib::gobject_ffi::GObject>::to_glib_full(&*borrowed_new)
                        .cast()
                },
                |old_ptr| {
                    let released: glib::Object =
                        from_glib_full(old_ptr as *mut glib::gobject_ffi::GObject);
                    drop(released);
                },
            )
        }
    }
}

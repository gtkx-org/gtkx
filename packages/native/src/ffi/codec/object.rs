use super::prelude::*;
use crate::handle::Handle;
use crate::handle::wrapper;
use glib::{
    self,
    prelude::StaticType as _,
    translate::{
        Borrowed, FromGlibPtrNone as _, IntoGlibPtr, ToGlibPtr, from_glib, from_glib_borrow,
        from_glib_full,
    },
};

unsafe fn tracked_gobject_value(
    gobject_ptr: *mut glib::gobject_ffi::GObject,
    ownership: Ownership,
) -> value::Value {
    let gtype: glib::Type = unsafe { from_glib((*(*gobject_ptr).g_type_instance.g_class).g_type) };
    let is_initially_unowned = gtype.is_a(glib::InitiallyUnowned::static_type());
    let is_floating = unsafe { glib::gobject_ffi::g_object_is_floating(gobject_ptr) != 0 };
    let has_wrapper = unsafe { wrapper::WrapperRegistry::global().has_wrapper(gobject_ptr) };

    if ownership.is_full() {
        if is_floating || (!has_wrapper && is_initially_unowned) {
            unsafe { glib::gobject_ffi::g_object_ref_sink(gobject_ptr) };
        }
    } else {
        unsafe { glib::gobject_ffi::g_object_ref(gobject_ptr) };
    }

    value::Value::Object(Handle::decoded_gobject(gobject_ptr.cast()))
}

#[derive(Debug, Clone, Copy)]
pub struct ObjectCodec {
    pub ownership: Ownership,
}

impl Encoder for ObjectCodec {
    fn object_ptr_context(&self) -> &'static str {
        "Object"
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

impl Decoder for ObjectCodec {
    fn read_call(&self, stashed_value: &ffi::StashedValue) -> anyhow::Result<value::Value> {
        let Some(object_ptr) = stashed_value.as_non_null_ptr("Object")? else {
            return Ok(value::Value::Null);
        };
        Ok(unsafe {
            tracked_gobject_value(
                object_ptr as *mut glib::gobject_ffi::GObject,
                self.ownership,
            )
        })
    }

    unsafe fn read_value(&self, ptr: *mut c_void, _context: &str) -> anyhow::Result<value::Value> {
        self.null_guarded(ptr, |ptr| {
            Ok(unsafe {
                tracked_gobject_value(ptr as *mut glib::gobject_ffi::GObject, Ownership::Borrowed)
            })
        })
    }
}

impl PointerWriter for ObjectCodec {
    unsafe fn write_return_to_pointer(&self, ret: *mut c_void, value: &Result<value::Value, ()>) {
        self.write_return_with_ownership(ret, value, self.ownership, |ptr| {
            let obj: glib::Object =
                unsafe { glib::Object::from_glib_none(ptr as *mut glib::gobject_ffi::GObject) };
            IntoGlibPtr::<*mut glib::gobject_ffi::GObject>::into_glib_ptr(obj).cast::<c_void>()
        });
    }

    unsafe fn write_value_to_pointer(
        &self,
        ptr: *mut c_void,
        value: &value::Value,
    ) -> anyhow::Result<()> {
        unsafe {
            swap_owned_slot(
                ptr,
                value,
                "Object field write",
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

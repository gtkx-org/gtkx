use super::prelude::*;
use crate::handle::Handle;
use crate::handle::wrapper;
use glib::{
    self,
    translate::{
        Borrowed, FromGlibPtrNone as _, IntoGlibPtr, ToGlibPtr, from_glib_borrow, from_glib_full,
    },
};

unsafe fn tracked_gobject_value<'e>(
    env: &'e Env,
    gobject_ptr: *mut glib::gobject_ffi::GObject,
    ownership: Ownership,
) -> anyhow::Result<Unknown<'e>> {
    if ownership.is_full() {
        let is_initially_unowned =
            unsafe { glib::types::instance_of::<glib::InitiallyUnowned>(gobject_ptr.cast()) };
        let is_floating = unsafe { glib::gobject_ffi::g_object_is_floating(gobject_ptr) != 0 };
        let has_wrapper = unsafe { wrapper::has_wrapper(gobject_ptr) };
        if is_floating || (!has_wrapper && is_initially_unowned) {
            unsafe { glib::gobject_ffi::g_object_ref_sink(gobject_ptr) };
        }
    } else {
        unsafe { glib::gobject_ffi::g_object_ref(gobject_ptr) };
    }

    let object: glib::Object = unsafe { from_glib_full(gobject_ptr) };
    Ok(value::handle_to_unknown(
        env,
        Handle::decoded_gobject(object),
    )?)
}

unsafe fn object_ref_full(ptr: *mut c_void) -> *mut c_void {
    let obj: glib::Object =
        unsafe { glib::Object::from_glib_none(ptr as *mut glib::gobject_ffi::GObject) };
    IntoGlibPtr::<*mut glib::gobject_ffi::GObject>::into_glib_ptr(obj).cast::<c_void>()
}

#[derive(Debug, Clone, Copy)]
pub struct ObjectCodec {
    pub ownership: Ownership,
}

impl Encoder for ObjectCodec {
    fn object_ptr_context(&self) -> &'static str {
        "Object"
    }

    fn transfer_release(&self) -> Option<ffi::ReleaseKind> {
        self.ownership
            .is_full()
            .then_some(ffi::ReleaseKind::ObjectUnref)
    }

    unsafe fn ref_for_transfer(&self, ptr: *mut c_void) -> anyhow::Result<*mut c_void> {
        if self.ownership.is_full() && !ptr.is_null() {
            return Ok(unsafe { object_ref_full(ptr) });
        }
        Ok(ptr)
    }
}

impl Decoder for ObjectCodec {
    fn decode_call<'e>(&self, env: &'e Env, stash: &ffi::Stash) -> anyhow::Result<Unknown<'e>> {
        self.decode_call_non_null(env, stash, "Object", |object_ptr| unsafe {
            tracked_gobject_value(
                env,
                object_ptr as *mut glib::gobject_ffi::GObject,
                self.ownership,
            )
        })
    }

    unsafe fn read_value<'e>(
        &self,
        env: &'e Env,
        ptr: *mut c_void,
        _context: &str,
    ) -> anyhow::Result<Unknown<'e>> {
        self.decode_non_null(env, ptr, |ptr| unsafe {
            tracked_gobject_value(
                env,
                ptr as *mut glib::gobject_ffi::GObject,
                Ownership::Borrowed,
            )
        })
    }
}

impl PtrWriter for ObjectCodec {
    fn write_return_to_ptr(
        &self,
        env: &Env,
        ret: ffi::Slot,
        value: &std::result::Result<Unknown<'_>, ()>,
    ) {
        self.write_return_with_ownership(env, ret, value, self.ownership, |ptr| unsafe {
            object_ref_full(ptr)
        });
    }

    fn write_value_to_ptr(
        &self,
        env: &Env,
        slot: ffi::Slot,
        value: Unknown<'_>,
    ) -> anyhow::Result<()> {
        swap_owned_slot(
            env,
            slot,
            value,
            "Object field write",
            |new_ptr| unsafe {
                let borrowed_new: Borrowed<glib::Object> =
                    from_glib_borrow(new_ptr as *mut glib::gobject_ffi::GObject);
                ToGlibPtr::<*mut glib::gobject_ffi::GObject>::to_glib_full(&*borrowed_new).cast()
            },
            |old_ptr| unsafe {
                let released: glib::Object =
                    from_glib_full(old_ptr as *mut glib::gobject_ffi::GObject);
                drop(released);
            },
        )
    }
}

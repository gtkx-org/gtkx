use glib::translate::{
    Borrowed, FromGlibPtrNone as _, IntoGlibPtr, ToGlibPtr, from_glib_borrow, from_glib_full,
};
use glib::{self};

use super::prelude::*;
use crate::handle::Handle;
use crate::value::wrapper;

unsafe fn keeps_own_construction_ref(gobject_ptr: *mut glib::gobject_ffi::GObject) -> bool {
    unsafe { glib::types::instance_of::<glib::InitiallyUnowned>(gobject_ptr.cast()) }
}

unsafe fn acquire_decoded_ref(gobject_ptr: *mut glib::gobject_ffi::GObject, ownership: Ownership) {
    if ownership.is_borrowed() {
        unsafe { glib::gobject_ffi::g_object_ref(gobject_ptr) };
        return;
    }
    let is_floating = unsafe { glib::gobject_ffi::g_object_is_floating(gobject_ptr) != 0 };
    if is_floating {
        unsafe { glib::gobject_ffi::g_object_ref_sink(gobject_ptr) };
    }
}

pub(crate) unsafe fn acquire_construction_ref(gobject_ptr: *mut glib::gobject_ffi::GObject) {
    let is_floating = unsafe { glib::gobject_ffi::g_object_is_floating(gobject_ptr) != 0 };
    if !is_floating && unsafe { keeps_own_construction_ref(gobject_ptr) } {
        unsafe { glib::gobject_ffi::g_object_ref(gobject_ptr) };
    }
}

pub(crate) unsafe fn release_construction_ref(gobject_ptr: *mut glib::gobject_ffi::GObject) {
    if unsafe { keeps_own_construction_ref(gobject_ptr) } {
        return;
    }
    unsafe { glib::gobject_ffi::g_object_unref(gobject_ptr) };
}

pub(crate) unsafe fn tracked_gobject_value(
    env: &Env,
    gobject_ptr: *mut glib::gobject_ffi::GObject,
    ownership: Ownership,
) -> anyhow::Result<Unknown<'_>> {
    unsafe { acquire_decoded_ref(gobject_ptr, ownership) };

    let object: glib::Object = unsafe { from_glib_full(gobject_ptr) };

    if let Some(existing) = unsafe { wrapper::wrapper_value(env, gobject_ptr) } {
        drop(object);
        return Ok(existing.into_unknown(env)?);
    }

    Ok(value::handle_to_unknown(
        env,
        Handle::decoded_gobject(object),
    )?)
}

pub(crate) unsafe fn call_scoped_gobject_value(
    env: &Env,
    gobject_ptr: *mut glib::gobject_ffi::GObject,
) -> anyhow::Result<Unknown<'_>> {
    if let Some(existing) = unsafe { wrapper::wrapper_value(env, gobject_ptr) } {
        return Ok(existing.into_unknown(env)?);
    }

    Ok(value::handle_to_unknown(
        env,
        Handle::borrowed_gobject(gobject_ptr),
    )?)
}

unsafe fn object_ref_full(ptr: *mut c_void) -> *mut c_void {
    let obj: glib::Object =
        unsafe { glib::Object::from_glib_none(ptr.cast::<glib::gobject_ffi::GObject>()) };
    IntoGlibPtr::<*mut glib::gobject_ffi::GObject>::into_glib_ptr(obj).cast::<c_void>()
}

#[derive(Debug, Clone, Copy)]
pub struct ObjectCodec {
    pub ownership: Ownership,
    pub is_call_scoped: bool,
}

impl ObjectCodec {
    unsafe fn gobject_value<'e>(
        &self,
        env: &'e Env,
        gobject_ptr: *mut glib::gobject_ffi::GObject,
        ownership: Ownership,
    ) -> anyhow::Result<Unknown<'e>> {
        if self.is_call_scoped {
            return unsafe { call_scoped_gobject_value(env, gobject_ptr) };
        }

        unsafe { tracked_gobject_value(env, gobject_ptr, ownership) }
    }
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
        ref_for_full_transfer(self.ownership, ptr, |ptr| {
            Ok(unsafe { object_ref_full(ptr) })
        })
    }
}

impl Decoder for ObjectCodec {
    fn decode_call<'e>(&self, env: &'e Env, stash: &ffi::Stash) -> anyhow::Result<Unknown<'e>> {
        self.decode_call_non_null(env, stash, "Object", |object_ptr| unsafe {
            self.gobject_value(
                env,
                object_ptr.cast::<glib::gobject_ffi::GObject>(),
                self.ownership,
            )
        })
    }

    read_value_non_null!(|self, env, ptr, transfer| unsafe {
        self.gobject_value(env, ptr.cast::<glib::gobject_ffi::GObject>(), transfer)
    });
}

impl PtrWriter for ObjectCodec {
    write_return_transferred!("Object return: cannot transfer ownership");

    fn write_value_to_ptr(
        &self,
        _env: &Env,
        slot: ffi::Slot,
        value: Unknown<'_>,
        init: SlotInit,
    ) -> anyhow::Result<Option<ffi::PendingTransfer>> {
        if self.ownership.is_borrowed() {
            return write_object_ptr(slot, value, "Object field write");
        }
        swap_owned_slot(
            slot,
            value,
            init,
            "Object field write",
            |new_ptr| unsafe {
                let borrowed_new: Borrowed<glib::Object> =
                    from_glib_borrow(new_ptr.cast::<glib::gobject_ffi::GObject>());
                ToGlibPtr::<*mut glib::gobject_ffi::GObject>::to_glib_full(&*borrowed_new).cast()
            },
            |old_ptr| unsafe {
                let released: glib::Object =
                    from_glib_full(old_ptr.cast::<glib::gobject_ffi::GObject>());
                drop(released);
            },
        )
    }
}

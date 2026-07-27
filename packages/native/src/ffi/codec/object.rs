use super::prelude::*;
use crate::handle::Handle;
use crate::value::wrapper;
use glib::{
    self,
    translate::{
        Borrowed, FromGlibPtrNone as _, IntoGlibPtr, ToGlibPtr, from_glib_borrow, from_glib_full,
    },
};

// A transfer-none pointer is decoded by taking a reference of our own and leaving any floating
// reference alone: the float is the creator's only claim on the object, so sinking it here would
// take over a lifetime the caller still expects to control. A floating transfer-full pointer is the
// caller handing that claim over, so it is sunk. An already-sunk transfer-full `GInitiallyUnowned`
// carries only the transferred reference, which the wrapper's toggle reference has to replace
// before it lapses; the extra reference pins it across that window.
unsafe fn acquire_decoded_ref(gobject_ptr: *mut glib::gobject_ffi::GObject, ownership: Ownership) {
    if ownership.is_borrowed() {
        unsafe { glib::gobject_ffi::g_object_ref(gobject_ptr) };
        return;
    }
    let is_floating = unsafe { glib::gobject_ffi::g_object_is_floating(gobject_ptr) != 0 };
    if is_floating {
        unsafe { glib::gobject_ffi::g_object_ref_sink(gobject_ptr) };
        return;
    }
    let pin_until_wrapper_adopts = unsafe {
        glib::types::instance_of::<glib::InitiallyUnowned>(gobject_ptr.cast())
            && !wrapper::has_wrapper(gobject_ptr)
    };
    if pin_until_wrapper_adopts {
        unsafe { glib::gobject_ffi::g_object_ref(gobject_ptr) };
    }
}

unsafe fn tracked_gobject_value(
    env: &Env,
    gobject_ptr: *mut glib::gobject_ffi::GObject,
    ownership: Ownership,
) -> anyhow::Result<Unknown<'_>> {
    unsafe { acquire_decoded_ref(gobject_ptr, ownership) };

    let object: glib::Object = unsafe { from_glib_full(gobject_ptr) };
    Ok(value::handle_to_unknown(
        env,
        Handle::decoded_gobject(object),
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
            tracked_gobject_value(
                env,
                object_ptr.cast::<glib::gobject_ffi::GObject>(),
                self.ownership,
            )
        })
    }

    read_value_non_null!(|self, env, ptr| unsafe {
        tracked_gobject_value(
            env,
            ptr.cast::<glib::gobject_ffi::GObject>(),
            Ownership::Borrowed,
        )
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
    ) -> anyhow::Result<()> {
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

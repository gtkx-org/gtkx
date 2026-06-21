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

/// Reads the `GTypeClass` pointer out of a live `GObject` instance.
///
/// # Safety
///
/// `ptr` must point to a live `GObject` instance owned by the gtkx-glib thread; a freed object may
/// carry a null class pointer, which is reported as an error rather than dereferenced further.
unsafe fn load_type_class(
    ptr: *mut glib::gobject_ffi::GObject,
) -> anyhow::Result<*mut glib::gobject_ffi::GTypeClass> {
    // SAFETY: `ptr` is a live GObject per the contract; its embedded `g_type_instance.g_class`
    // is the class pointer (possibly null for a freed object, checked below).
    let type_class = unsafe { (*ptr).g_type_instance.g_class };
    if type_class.is_null() {
        bail!("GObject has invalid type class (object may have been freed)");
    }
    Ok(type_class)
}

/// Builds a tracked [`value::Value`] handle for a live `GObject`, taking the reference the chosen
/// [`Ownership`] implies (sinking a floating/initially-unowned object on full transfer, or
/// adding a strong reference for a borrow).
///
/// # Safety
///
/// `gobject_ptr` must point to a live `GObject` owned by the gtkx-glib thread.
unsafe fn tracked_gobject_value(
    gobject_ptr: *mut glib::gobject_ffi::GObject,
    ownership: Ownership,
) -> anyhow::Result<value::Value> {
    // SAFETY: `gobject_ptr` is a live GObject per the contract.
    let type_class = unsafe { load_type_class(gobject_ptr)? };
    // SAFETY: `type_class` is the object's non-null class struct; `g_type` is its registered GType.
    let gtype: glib::Type = unsafe { from_glib((*type_class).g_type) };
    let is_initially_unowned = gtype.is_a(glib::InitiallyUnowned::static_type());
    // SAFETY: `gobject_ptr` is a live GObject; `g_object_is_floating` queries its floating state.
    let is_floating = unsafe { glib::gobject_ffi::g_object_is_floating(gobject_ptr) != 0 };
    // SAFETY: `gobject_ptr` is a live GObject; `has_wrapper` only reads its qdata under the
    // registry lock.
    let has_wrapper = unsafe { toggle_ref::WrapperRegistry::global().has_wrapper(gobject_ptr) };

    if ownership.is_full() {
        if is_floating || (!has_wrapper && is_initially_unowned) {
            // SAFETY: `gobject_ptr` is live; ref-sinking converts the floating/initial reference
            // into the strong reference this full-ownership handle keeps.
            unsafe { glib::gobject_ffi::g_object_ref_sink(gobject_ptr) };
        }
    } else {
        // SAFETY: `gobject_ptr` is live; this adds the strong reference the borrowed handle owns.
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
    fn object_ptr_context(&self) -> &'static str {
        "GObject"
    }

    fn transfer_release(&self) -> Option<ffi::PendingRelease> {
        self.ownership
            .is_full()
            .then_some(ffi::PendingRelease::ObjectUnref)
    }

    /// # Safety
    ///
    /// `ptr` must be either null or a pointer to a live `GObject` owned by the gtkx-glib
    /// thread; the call takes a new strong reference (`g_object_ref` via `from_glib_none` +
    /// `into_glib_ptr`) that the caller is responsible for releasing.
    unsafe fn ref_for_transfer(&self, ptr: *mut c_void) -> anyhow::Result<*mut c_void> {
        if self.ownership.is_full() && !ptr.is_null() {
            // SAFETY: `ptr` is a non-null, live `GObject`; `from_glib_none` takes a borrowed
            // reference and immediately re-owns it, and `into_glib_ptr` transfers that owned
            // reference out as a raw pointer.
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
    fn read_call(&self, ffi_value: &ffi::FfiValue) -> anyhow::Result<value::Value> {
        let Some(object_ptr) = ffi_value.as_non_null_ptr("GObject")? else {
            return Ok(value::Value::Null);
        };
        // SAFETY: `as_non_null_ptr` yielded a non-null pointer returned by the C call as a live
        // GObject of the called function's return type, owned by the gtkx-glib thread.
        unsafe {
            tracked_gobject_value(
                object_ptr as *mut glib::gobject_ffi::GObject,
                self.ownership,
            )
        }
    }

    unsafe fn read_value(&self, ptr: *mut c_void, _context: &str) -> anyhow::Result<value::Value> {
        self.null_guarded(ptr, |ptr| {
            // SAFETY: `null_guarded` only invokes this closure with a non-null `ptr`, which the
            // caller of `read_value` guarantees is a live GObject on the gtkx-glib thread.
            unsafe {
                tracked_gobject_value(ptr as *mut glib::gobject_ffi::GObject, Ownership::Borrowed)
            }
        })
    }
}

impl RawPtrCodec for GObjectType {
    unsafe fn write_return_to_raw_ptr(&self, ret: *mut c_void, value: &Result<value::Value, ()>) {
        self.write_return_with_ownership(ret, value, self.ownership, |ptr| {
            // SAFETY: `ptr` is a non-null live GObject (the helper skips null); `from_glib_none`
            // re-owns a borrowed reference and `into_glib_ptr` transfers an owned pointer out for
            // the full-ownership return.
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
        // SAFETY: `ptr` is a GObject field slot per `write_value_to_raw_ptr`'s contract; the
        // closures keep its strong-reference count balanced (acquire via `to_glib_full`, release
        // via `from_glib_full`), so `swap_owned_slot`'s slot invariants hold.
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

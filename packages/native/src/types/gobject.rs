use anyhow::bail;
use gtk4::glib::{
    self,
    translate::{FromGlibPtrNone as _, IntoGlibPtr},
};
use napi::{Env, JsObject};

use super::prelude::*;
use crate::managed::NativeHandle;
use crate::toggle_ref;

/// Loads and validates the instance's `g_class` pointer.
///
/// Bails with `"GObject has invalid type class (object may have been freed)"`
/// when the slot is null — the dangling-pointer signature after a
/// `g_object_unref` to zero. The loaded pointer is returned so callers reuse
/// the single read instead of re-dereferencing the field.
///
/// # Safety
///
/// `ptr` must be a non-null pointer to a live `GObject` whose `g_type_instance`
/// is readable.
unsafe fn load_type_class(
    ptr: *mut glib::gobject_ffi::GObject,
) -> anyhow::Result<*mut glib::gobject_ffi::GTypeClass> {
    let type_class = unsafe { (*ptr).g_type_instance.g_class };
    if type_class.is_null() {
        bail!("GObject has invalid type class (object may have been freed)");
    }
    Ok(type_class)
}

/// Builds the JavaScript-facing handle for a `GObject` crossing the boundary.
///
/// The handle is a non-owning pointer carrier: a `GObject`'s lifetime is
/// governed by its toggle reference (installed by `setWrapper` on first wrap)
/// and its wrapper's finalizer, never by the handle. This normalizes the object
/// so it carries exactly one pending owned reference that the install step will
/// consume: a full transfer of a floating or `GInitiallyUnowned` object sinks
/// the floating reference to claim it; a full transfer of a plain object keeps
/// the caller's reference; a borrow takes a fresh reference and never sinks, so
/// a still-floating object being wrapped from a `constructed` vfunc keeps its
/// floating reference for the construction return to claim. For an object the
/// registry already tracks, no toggle ref is installed; a full transfer is
/// released here, sinking first when the object is still floating.
///
/// # Safety
///
/// `gobject_ptr` must be a non-null pointer to a live `GObject`. Must run on the
/// `GLib` thread.
#[cfg_attr(coverage_nightly, coverage(off))]
fn tracked_gobject_value(
    gobject_ptr: *mut glib::gobject_ffi::GObject,
    ownership: Ownership,
) -> anyhow::Result<value::Value> {
    let type_class = unsafe { load_type_class(gobject_ptr)? };
    let gtype = unsafe { (*type_class).g_type };
    let is_initially_unowned = unsafe {
        glib::gobject_ffi::g_type_is_a(gtype, glib::gobject_ffi::g_initially_unowned_get_type())
            != 0
    };
    let is_floating = unsafe { glib::gobject_ffi::g_object_is_floating(gobject_ptr) != 0 };

    if unsafe { toggle_ref::has_wrapper(gobject_ptr) } {
        if ownership.is_full() {
            if is_floating {
                unsafe { glib::gobject_ffi::g_object_ref_sink(gobject_ptr) };
            }
            unsafe { glib::gobject_ffi::g_object_unref(gobject_ptr) };
        }
    } else if ownership.is_full() {
        if is_floating || is_initially_unowned {
            unsafe { glib::gobject_ffi::g_object_ref_sink(gobject_ptr) };
        }
    } else {
        unsafe { glib::gobject_ffi::g_object_ref(gobject_ptr) };
    }

    Ok(value::Value::Object(NativeHandle::borrowed_gobject(
        gobject_ptr.cast(),
    )))
}

#[derive(Debug, Clone, Copy)]
pub struct GObjectType {
    pub ownership: Ownership,
}

impl GObjectType {
    #[cfg_attr(coverage_nightly, coverage(off))]
    pub fn from_js_value(_env: &Env, obj: &JsObject) -> napi::Result<Self> {
        let ownership = Ownership::from_js_value(obj, "gobject")?;
        Ok(Self { ownership })
    }
}

impl FfiEncoder for GObjectType {
    fn encode(&self, value: &value::Value, _optional: bool) -> anyhow::Result<ffi::FfiValue> {
        let ptr = value.object_ptr("GObject")?;
        Ok(ffi::FfiValue::Ptr(self.ref_for_transfer(ptr)?))
    }

    fn ref_for_transfer(&self, ptr: *mut c_void) -> anyhow::Result<*mut c_void> {
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
    /// Decodes a `GObject` pointer returned across the FFI boundary.
    ///
    /// The transfer mode controls how the object's reference count is
    /// normalized before its toggle reference is installed: a `GInitiallyUnowned`
    /// is claimed with `g_object_ref_sink` whenever the caller owns the result —
    /// sinking a still-floating reference, or adding an owned reference to an
    /// instance already sunk during construction (e.g. a `GtkApplicationWindow`
    /// parented into its `GtkApplication` before the constructor returns). A
    /// plain transfer-full pointer keeps the caller's reference; a borrowed one
    /// is referenced. See [`tracked_gobject_value`].
    fn decode(&self, ffi_value: &ffi::FfiValue) -> anyhow::Result<value::Value> {
        let Some(object_ptr) = ffi_value.as_non_null_ptr("GObject")? else {
            return Ok(value::Value::Null);
        };

        tracked_gobject_value(
            object_ptr as *mut glib::gobject_ffi::GObject,
            self.ownership,
        )
    }
}

impl RawPtrCodec for GObjectType {
    fn ptr_to_value(&self, ptr: *mut c_void, _context: &str) -> anyhow::Result<value::Value> {
        null_guarded(ptr, |ptr| {
            tracked_gobject_value(ptr as *mut glib::gobject_ffi::GObject, Ownership::None)
        })
    }

    fn write_return_to_raw_ptr(&self, ret: *mut c_void, value: &Result<value::Value, ()>) {
        write_return_object_ptr(ret, value, |ptr| {
            let obj: glib::Object =
                unsafe { glib::Object::from_glib_none(ptr as *mut glib::gobject_ffi::GObject) };
            IntoGlibPtr::<*mut glib::gobject_ffi::GObject>::into_glib_ptr(obj).cast::<c_void>()
        });
    }

    fn write_value_to_raw_ptr(&self, ptr: *mut c_void, value: &value::Value) -> anyhow::Result<()> {
        let new_ptr = value.object_ptr("GObject field write")?;
        let old_ptr = unsafe { (ptr as *const *mut c_void).read_unaligned() };
        if !new_ptr.is_null() {
            unsafe {
                glib::gobject_ffi::g_object_ref(new_ptr as *mut glib::gobject_ffi::GObject);
            }
        }
        unsafe { (ptr as *mut *mut c_void).write_unaligned(new_ptr) };
        if !old_ptr.is_null() {
            unsafe {
                glib::gobject_ffi::g_object_unref(old_ptr as *mut glib::gobject_ffi::GObject);
            }
        }
        Ok(())
    }
}

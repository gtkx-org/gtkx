use anyhow::bail;
use gtk4::glib::{
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
    // SAFETY: The caller guarantees `ptr` is a live GObject whose
    // `g_type_instance` field is readable.
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
/// and its wrapper's finalizer, never by the handle. Every decode normalizes
/// the object so it carries exactly one pending owned reference, marked on the
/// returned handle: a full transfer of a floating object sinks the floating
/// reference to claim it; a full transfer of a plain object keeps the caller's
/// reference; the first wrap of a non-floating `GInitiallyUnowned` adds an
/// owned reference to an instance already sunk during construction; a borrow
/// takes a fresh reference. The pending reference pins the object until its
/// single consumer — the wrapper install, the existing-wrapper lookup, or the
/// handle's drop — releases it, so a concurrent wrapper teardown can never
/// finalize an object a crossing handle still refers to.
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
    // SAFETY: The caller guarantees `gobject_ptr` is a live GObject.
    let type_class = unsafe { load_type_class(gobject_ptr)? };
    // SAFETY: `load_type_class` validated the class pointer as non-null, so
    // its `g_type` field is readable.
    let gtype: glib::Type = unsafe { from_glib((*type_class).g_type) };
    let is_initially_unowned = gtype.is_a(glib::InitiallyUnowned::static_type());
    // SAFETY: The caller guarantees `gobject_ptr` is a live GObject.
    let is_floating = unsafe { glib::gobject_ffi::g_object_is_floating(gobject_ptr) != 0 };
    // SAFETY: The caller guarantees `gobject_ptr` is a live GObject and
    // that this runs on the GLib thread, the qdata access contract.
    let has_wrapper = unsafe { toggle_ref::has_wrapper(gobject_ptr) };

    if ownership.is_full() {
        if is_floating || (!has_wrapper && is_initially_unowned) {
            // SAFETY: The caller guarantees `gobject_ptr` is a live
            // GObject.
            unsafe { glib::gobject_ffi::g_object_ref_sink(gobject_ptr) };
        }
    } else {
        // SAFETY: The caller guarantees `gobject_ptr` is a live GObject.
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
        // SAFETY: `ptr` came from a NativeHandle whose wrapper's toggle
        // reference keeps the GObject alive for the duration of the encode.
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
            // SAFETY: The caller guarantees the non-null `ptr` addresses a
            // live GObject, so taking a fresh reference is sound.
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
    unsafe fn ptr_to_value(
        &self,
        ptr: *mut c_void,
        _context: &str,
    ) -> anyhow::Result<value::Value> {
        null_guarded(ptr, |ptr| {
            tracked_gobject_value(ptr as *mut glib::gobject_ffi::GObject, Ownership::Borrowed)
        })
    }

    /// Writes a trampoline return honoring the declared transfer: a full
    /// transfer hands the caller a fresh reference; a transfer-none return
    /// writes the wrapper-held pointer unchanged, since the JS wrapper's
    /// toggle reference guarantees the object's lifetime.
    unsafe fn write_return_to_raw_ptr(&self, ret: *mut c_void, value: &Result<value::Value, ()>) {
        write_return_with_ownership(ret, value, self.ownership, |ptr| {
            // SAFETY: `ptr` came from a JS wrapper's NativeHandle whose
            // toggle reference keeps the GObject alive, so taking a fresh
            // reference is sound.
            let obj: glib::Object =
                unsafe { glib::Object::from_glib_none(ptr as *mut glib::gobject_ffi::GObject) };
            IntoGlibPtr::<*mut glib::gobject_ffi::GObject>::into_glib_ptr(obj).cast::<c_void>()
        });
    }

    /// Swaps the `GObject` strong reference held by a field slot: acquires a
    /// plain (never sinking) reference on the incoming object, writes the
    /// slot, then releases the previous holder. Both pointers route through
    /// the `Option` translate impls so a null on either side is absorbed.
    unsafe fn write_value_to_raw_ptr(
        &self,
        ptr: *mut c_void,
        value: &value::Value,
    ) -> anyhow::Result<()> {
        let new_ptr = value.object_ptr("GObject field write")?;
        // SAFETY: The caller guarantees `ptr` is a readable pointer-sized
        // field slot; the read is unaligned-tolerant.
        let old_ptr = unsafe { (ptr as *const *mut c_void).read_unaligned() };

        // SAFETY: `new_ptr` came from a NativeHandle whose wrapper's toggle
        // reference keeps the GObject alive; null is absorbed by the
        // `Option` translate impl.
        let borrowed_new: Borrowed<Option<glib::Object>> =
            unsafe { from_glib_borrow(new_ptr as *mut glib::gobject_ffi::GObject) };
        let owned_new: *mut glib::gobject_ffi::GObject = ToGlibPtr::to_glib_full(&*borrowed_new);

        // SAFETY: The caller guarantees `ptr` is a writable pointer-sized
        // field slot; the write is unaligned-tolerant.
        unsafe { (ptr as *mut *mut c_void).write_unaligned(owned_new.cast()) };

        // SAFETY: The slot held one strong reference to the previous object
        // (or null), which this adoption releases exactly once.
        let released: Option<glib::Object> =
            unsafe { from_glib_full(old_ptr as *mut glib::gobject_ffi::GObject) };
        drop(released);
        Ok(())
    }
}

//! GObject boxed type wrapper with reference counting.
//!
//! [`Boxed`] wraps pointers to GObject boxed types (e.g., `GdkRGBA`, `PangoFontDescription`)
//! with proper ownership semantics. Boxed types are value types that are copied and freed
//! using GLib's `g_boxed_copy` and `g_boxed_free` functions.
//!
//! ## Ownership Modes
//!
//! - [`Boxed::from_glib_full`]: Takes ownership of an allocated boxed value.
//!   The wrapper will free it on drop.
//! - [`Boxed::from_glib_none`]: Copies a borrowed boxed value to avoid dangling pointers.
//!   The wrapper owns the copy and frees it on drop.
//!
//! ## Clone Behavior
//!
//! Cloning always creates an independent copy via `g_boxed_copy`, ensuring each
//! `Boxed` instance has exclusive ownership of its data.

use std::ffi::c_void;

use gtk4::glib::{self, translate::IntoGlib as _};

#[derive(Debug)]
pub struct Boxed {
    ptr: *mut c_void,
    type_: Option<glib::Type>,
    is_owned: bool,
}

impl Boxed {

    pub fn from_glib_full(type_: Option<glib::Type>, ptr: *mut c_void) -> Self {
        Self {
            ptr,
            type_,
            is_owned: true,
        }
    }

    pub fn from_glib_none(type_: Option<glib::Type>, ptr: *mut c_void) -> Self {
        if ptr.is_null() {
            return Self {
                ptr,
                type_,
                is_owned: false,
            };
        }

        match type_ {
            Some(gtype) => {
                let cloned_ptr = unsafe { glib::gobject_ffi::g_boxed_copy(gtype.into_glib(), ptr) };
                Self {
                    ptr: cloned_ptr,
                    type_,
                    is_owned: true,
                }
            }
            None => {
                debug_assert!(
                    false,
                    "Boxed::from_glib_none called with unknown type - pointer may become dangling"
                );
                Self {
                    ptr,
                    type_: None,
                    is_owned: false,
                }
            }
        }
    }
}

impl AsRef<*mut c_void> for Boxed {
    fn as_ref(&self) -> &*mut c_void {
        &self.ptr
    }
}

impl Clone for Boxed {
    fn clone(&self) -> Self {
        Self::from_glib_none(self.type_, self.ptr)
    }
}

impl Drop for Boxed {
    fn drop(&mut self) {
        if self.is_owned && !self.ptr.is_null() {
            unsafe {
                match self.type_ {
                    Some(gtype) => {
                        glib::gobject_ffi::g_boxed_free(gtype.into_glib(), self.ptr);
                    }
                    None => {
                        glib::ffi::g_free(self.ptr);
                    }
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_utils;
    use gtk4::gdk;
    use gtk4::prelude::StaticType as _;

    #[test]
    fn from_glib_full_sets_owned_flag() {
        test_utils::ensure_gtk_init();

        let gtype = gdk::RGBA::static_type();
        let ptr = test_utils::allocate_test_boxed(gtype);

        let boxed = Boxed::from_glib_full(Some(gtype), ptr);

        assert!(boxed.is_owned);
        assert!(!boxed.ptr.is_null());
        assert_eq!(boxed.type_, Some(gtype));
    }

    #[test]
    fn from_glib_full_null_ptr_safe() {
        test_utils::ensure_gtk_init();

        let gtype = gdk::RGBA::static_type();
        let boxed = Boxed::from_glib_full(Some(gtype), std::ptr::null_mut());

        assert!(boxed.is_owned);
        assert!(boxed.ptr.is_null());
    }

    #[test]
    fn from_glib_none_creates_copy() {
        test_utils::ensure_gtk_init();

        let gtype = gdk::RGBA::static_type();
        let original_ptr = test_utils::allocate_test_boxed(gtype);

        let boxed = Boxed::from_glib_none(Some(gtype), original_ptr);

        assert!(boxed.is_owned);
        assert!(!boxed.ptr.is_null());
        assert_ne!(boxed.ptr, original_ptr);

        unsafe {
            glib::gobject_ffi::g_boxed_free(gtype.into_glib(), original_ptr);
        }
    }

    #[test]
    fn from_glib_none_null_ptr_not_owned() {
        test_utils::ensure_gtk_init();

        let gtype = gdk::RGBA::static_type();
        let boxed = Boxed::from_glib_none(Some(gtype), std::ptr::null_mut());

        assert!(!boxed.is_owned);
        assert!(boxed.ptr.is_null());
    }

    #[test]
    #[cfg_attr(debug_assertions, should_panic(expected = "Boxed::from_glib_none called with unknown type"))]
    fn from_glib_none_unknown_type_panics_in_debug() {
        test_utils::ensure_gtk_init();

        let gtype = gdk::RGBA::static_type();
        let ptr = test_utils::allocate_test_boxed(gtype);

        let boxed = Boxed::from_glib_none(None, ptr);

        assert!(!boxed.is_owned);
        assert_eq!(boxed.ptr, ptr);

        unsafe {
            glib::gobject_ffi::g_boxed_free(gtype.into_glib(), ptr);
        }
    }

    #[test]
    fn clone_creates_independent_copy() {
        test_utils::ensure_gtk_init();

        let gtype = gdk::RGBA::static_type();
        let ptr = test_utils::allocate_test_boxed(gtype);

        let boxed = Boxed::from_glib_full(Some(gtype), ptr);
        let cloned = boxed.clone();

        assert!(cloned.is_owned);
        assert!(!cloned.ptr.is_null());
        assert_ne!(cloned.ptr, boxed.ptr);

        drop(boxed);

        assert!(test_utils::is_valid_boxed_ptr(cloned.ptr, gtype));
    }

    #[test]
    fn as_ref_returns_ptr_reference() {
        test_utils::ensure_gtk_init();

        let gtype = gdk::RGBA::static_type();
        let ptr = test_utils::allocate_test_boxed(gtype);

        let boxed = Boxed::from_glib_full(Some(gtype), ptr);
        let ptr_ref: &*mut c_void = boxed.as_ref();

        assert_eq!(*ptr_ref, ptr);
    }

    #[test]
    fn drop_frees_owned_memory() {
        test_utils::ensure_gtk_init();

        let gtype = gdk::RGBA::static_type();
        let ptr = test_utils::allocate_test_boxed(gtype);

        let boxed = Boxed::from_glib_full(Some(gtype), ptr);
        drop(boxed);
    }

    #[test]
    fn drop_does_not_free_borrowed_memory() {
        test_utils::ensure_gtk_init();

        let gtype = gdk::RGBA::static_type();
        let ptr = test_utils::allocate_test_boxed(gtype);

        let boxed = Boxed {
            ptr,
            type_: Some(gtype),
            is_owned: false,
        };
        drop(boxed);

        assert!(test_utils::is_valid_boxed_ptr(ptr, gtype));

        unsafe {
            glib::gobject_ffi::g_boxed_free(gtype.into_glib(), ptr);
        }
    }

    // Tests for plain structs (without GType)

    #[test]
    fn from_glib_full_none_type_plain_struct() {
        test_utils::ensure_gtk_init();

        // Allocate a plain struct without GType
        let ptr = unsafe { glib::ffi::g_malloc0(16) };

        let boxed = Boxed::from_glib_full(None, ptr);

        assert!(boxed.is_owned);
        assert!(!boxed.ptr.is_null());
        assert_eq!(boxed.type_, None);
        // Will be freed with g_free on drop
    }

    #[test]
    fn from_glib_full_none_type_null_ptr() {
        test_utils::ensure_gtk_init();

        let boxed = Boxed::from_glib_full(None, std::ptr::null_mut());

        assert!(boxed.is_owned);
        assert!(boxed.ptr.is_null());
        assert_eq!(boxed.type_, None);
    }

    #[test]
    fn drop_plain_struct_uses_g_free() {
        test_utils::ensure_gtk_init();

        // Allocate with g_malloc, should be freed with g_free
        let ptr = unsafe { glib::ffi::g_malloc0(32) };

        let boxed = Boxed::from_glib_full(None, ptr);
        drop(boxed);
        // If this doesn't crash, g_free was used correctly
    }

    #[test]
    fn drop_plain_struct_null_ptr_safe() {
        test_utils::ensure_gtk_init();

        let boxed = Boxed::from_glib_full(None, std::ptr::null_mut());
        drop(boxed);
        // Should not crash on null pointer
    }

    #[test]
    fn plain_struct_not_owned_does_not_free() {
        test_utils::ensure_gtk_init();

        let ptr = unsafe { glib::ffi::g_malloc0(16) };

        let boxed = Boxed {
            ptr,
            type_: None,
            is_owned: false,
        };
        drop(boxed);

        // Pointer should still be valid - we need to free it manually
        unsafe {
            glib::ffi::g_free(ptr);
        }
    }

    #[test]
    fn from_glib_none_null_ptr_with_none_type() {
        test_utils::ensure_gtk_init();

        let boxed = Boxed::from_glib_none(None, std::ptr::null_mut());

        assert!(!boxed.is_owned);
        assert!(boxed.ptr.is_null());
        assert_eq!(boxed.type_, None);
    }

    #[test]
    fn as_ref_returns_ptr_for_plain_struct() {
        test_utils::ensure_gtk_init();

        let ptr = unsafe { glib::ffi::g_malloc0(24) };
        let boxed = Boxed::from_glib_full(None, ptr);

        let ptr_ref: &*mut c_void = boxed.as_ref();
        assert_eq!(*ptr_ref, ptr);
    }

    #[test]
    fn plain_struct_debug_format() {
        test_utils::ensure_gtk_init();

        let ptr = unsafe { glib::ffi::g_malloc0(8) };
        let boxed = Boxed::from_glib_full(None, ptr);

        let debug_str = format!("{:?}", boxed);
        assert!(debug_str.contains("Boxed"));
        assert!(debug_str.contains("None")); // type_ is None
        assert!(debug_str.contains("true")); // is_owned is true
    }
}

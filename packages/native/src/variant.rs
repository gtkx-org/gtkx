//! GVariant wrapper with reference counting.
//!
//! [`GVariant`] wraps GLib variant values with proper reference counting.
//! GVariants use floating references, which this module handles via `ref_sink`.
//!
//! ## Ownership Modes
//!
//! - [`GVariant::from_glib_full`]: Takes ownership of a variant (caller transfers ownership)
//! - [`GVariant::from_glib_none`]: References and sinks a borrowed variant to safely hold it
//!
//! ## Clone Behavior
//!
//! Cloning increments the reference count, creating a shared reference to the same
//! underlying variant data. Both the original and clone are valid independently.

use std::ffi::c_void;

use gtk4::glib;

#[derive(Debug)]
pub struct GVariant {
    ptr: *mut c_void,
    is_owned: bool,
}

impl GVariant {
    pub fn from_glib_full(ptr: *mut c_void) -> Self {
        Self {
            ptr,
            is_owned: true,
        }
    }

    pub fn from_glib_none(ptr: *mut c_void) -> Self {
        if ptr.is_null() {
            return Self {
                ptr: std::ptr::null_mut(),
                is_owned: false,
            };
        }

        unsafe {
            glib::ffi::g_variant_ref_sink(ptr as *mut glib::ffi::GVariant);
        }
        Self {
            ptr,
            is_owned: true,
        }
    }

    #[inline]
    pub fn as_ptr(&self) -> *mut c_void {
        self.ptr
    }

    #[must_use]
    pub fn is_owned(&self) -> bool {
        self.is_owned
    }

    #[inline]
    fn as_gvariant_ptr(&self) -> *mut glib::ffi::GVariant {
        self.ptr as *mut glib::ffi::GVariant
    }
}

impl Clone for GVariant {
    fn clone(&self) -> Self {
        if self.ptr.is_null() {
            return Self {
                ptr: std::ptr::null_mut(),
                is_owned: false,
            };
        }

        unsafe {
            glib::ffi::g_variant_ref(self.as_gvariant_ptr());
        }
        Self {
            ptr: self.ptr,
            is_owned: true,
        }
    }
}

impl Drop for GVariant {
    fn drop(&mut self) {
        if self.is_owned && !self.ptr.is_null() {
            unsafe {
                glib::ffi::g_variant_unref(self.as_gvariant_ptr());
            }
        }
    }
}


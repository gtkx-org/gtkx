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

    #[allow(clippy::not_unsafe_ptr_arg_deref)]
    pub fn from_glib_none(type_: Option<glib::Type>, ptr: *mut c_void) -> Self {
        Self::from_glib_none_with_size(type_, ptr, None, None)
    }

    #[allow(clippy::not_unsafe_ptr_arg_deref)]
    pub fn from_glib_none_with_size(
        type_: Option<glib::Type>,
        ptr: *mut c_void,
        size: Option<usize>,
        type_name: Option<&str>,
    ) -> Self {
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
                if let Some(s) = size {
                    let cloned_ptr = unsafe {
                        let dest = glib::ffi::g_malloc(s) as *mut c_void;
                        std::ptr::copy_nonoverlapping(ptr as *const u8, dest as *mut u8, s);
                        dest
                    };
                    Self {
                        ptr: cloned_ptr,
                        type_: None,
                        is_owned: true,
                    }
                } else {
                    let name = match type_name {
                        Some(n) if !n.is_empty() => n,
                        _ => "unknown",
                    };
                    eprintln!(
                        "[gtkx] WARNING: from_glib_none: struct type '{}' has no size info - \
                         pointer {:p} may become dangling if the source is freed",
                        name, ptr
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

    #[inline]
    pub fn as_ptr(&self) -> *mut c_void {
        self.ptr
    }

    #[must_use]
    pub fn is_owned(&self) -> bool {
        self.is_owned
    }
}

impl Clone for Boxed {
    fn clone(&self) -> Self {
        if self.type_.is_some() {
            Self::from_glib_none(self.type_, self.ptr)
        } else {
            Self {
                ptr: self.ptr,
                type_: None,
                is_owned: false,
            }
        }
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


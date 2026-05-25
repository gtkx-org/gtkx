use std::ffi::c_void;

use anyhow::bail;
use gtk4::glib::{self, translate::IntoGlib as _};

use crate::types::BoxedFreeFn;

#[derive(Debug)]
pub struct Boxed {
    ptr: *mut c_void,
    owned: bool,
    gtype: Option<glib::Type>,
    free_fn: Option<BoxedFreeFn>,
}

impl Boxed {
    #[must_use]
    pub fn from_glib_full(gtype: Option<glib::Type>, ptr: *mut c_void) -> Self {
        Self {
            ptr,
            owned: true,
            gtype,
            free_fn: None,
        }
    }

    /// Wraps a caller-owned pointer whose destructor is neither
    /// `g_boxed_free` nor `g_free` (e.g. `cairo_path_destroy`).
    ///
    /// `Drop` invokes `free_fn` exactly once with `ptr` if the wrapper is
    /// dropped while still owning the pointer.
    #[must_use]
    pub fn from_glib_full_with_free_fn(ptr: *mut c_void, free_fn: BoxedFreeFn) -> Self {
        Self {
            ptr,
            owned: true,
            gtype: None,
            free_fn: Some(free_fn),
        }
    }

    #[must_use]
    pub(crate) fn from_ptr_unowned(ptr: *mut c_void) -> Self {
        Self {
            ptr,
            owned: false,
            gtype: None,
            free_fn: None,
        }
    }

    pub fn from_glib_none(gtype: Option<glib::Type>, ptr: *mut c_void) -> anyhow::Result<Self> {
        Self::from_glib_none_with_size(gtype, ptr, None, None)
    }

    pub fn from_glib_none_with_size(
        gtype: Option<glib::Type>,
        ptr: *mut c_void,
        size: Option<usize>,
        type_name: Option<&str>,
    ) -> anyhow::Result<Self> {
        if ptr.is_null() {
            return Ok(Self {
                ptr,
                owned: false,
                gtype,
                free_fn: None,
            });
        }

        match gtype {
            Some(gt) => {
                let cloned_ptr =
                    unsafe { glib::gobject_ffi::g_boxed_copy(gt.into_glib(), ptr as *const _) };
                Ok(Self {
                    ptr: cloned_ptr,
                    owned: true,
                    gtype,
                    free_fn: None,
                })
            }
            None => {
                if let Some(s) = size {
                    let cloned_ptr = unsafe {
                        let dest = glib::ffi::g_malloc(s);
                        std::ptr::copy_nonoverlapping(ptr as *const u8, dest as *mut u8, s);
                        dest
                    };
                    Ok(Self {
                        ptr: cloned_ptr,
                        owned: true,
                        gtype: None,
                        free_fn: None,
                    })
                } else {
                    let name = type_name.unwrap_or("unknown");
                    bail!(
                        "Cannot copy boxed type '{name}': no size or GType available. \
                         Pointer {ptr:p} may become dangling if the source is freed"
                    )
                }
            }
        }
    }

    #[inline]
    #[must_use]
    pub fn as_ptr(&self) -> *mut c_void {
        self.ptr
    }

    #[inline]
    #[must_use]
    pub fn is_owned(&self) -> bool {
        self.owned
    }

    #[must_use]
    pub fn gtype(&self) -> Option<glib::Type> {
        self.gtype
    }

    #[inline]
    #[must_use]
    pub fn free_fn(&self) -> Option<BoxedFreeFn> {
        self.free_fn
    }
}

impl Clone for Boxed {
    fn clone(&self) -> Self {
        if self.ptr.is_null() {
            return Self {
                ptr: std::ptr::null_mut(),
                owned: false,
                gtype: self.gtype,
                free_fn: self.free_fn,
            };
        }

        // No safe deep-copy exists for a custom-destructor boxed (the
        // descriptor declares only a free function), so cloning yields a
        // non-owning view sharing the same pointer.
        if self.free_fn.is_some() {
            return Self {
                ptr: self.ptr,
                owned: false,
                gtype: None,
                free_fn: self.free_fn,
            };
        }

        self.gtype.map_or_else(
            || Self {
                ptr: self.ptr,
                owned: false,
                gtype: None,
                free_fn: None,
            },
            |gt| {
                let cloned_ptr = unsafe {
                    glib::gobject_ffi::g_boxed_copy(gt.into_glib(), self.ptr as *const _)
                };
                Self {
                    ptr: cloned_ptr,
                    owned: true,
                    gtype: self.gtype,
                    free_fn: None,
                }
            },
        )
    }
}

impl Drop for Boxed {
    fn drop(&mut self) {
        if self.owned && !self.ptr.is_null() {
            unsafe {
                if let Some(free_fn) = self.free_fn {
                    free_fn(self.ptr);
                } else {
                    match self.gtype {
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
}

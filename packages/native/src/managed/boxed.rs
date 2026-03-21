use std::ffi::c_void;

use anyhow::bail;
use gtk4::glib::{self, translate::IntoGlib as _};

#[derive(Debug)]
pub struct Boxed {
    ptr: *mut c_void,
    owned: bool,
    gtype: Option<glib::Type>,
}

impl Boxed {
    #[must_use]
    pub fn from_glib_full(gtype: Option<glib::Type>, ptr: *mut c_void) -> Self {
        Self {
            ptr,
            owned: true,
            gtype,
        }
    }

    #[must_use]
    pub(crate) fn from_ptr_unowned(ptr: *mut c_void) -> Self {
        Self {
            ptr,
            owned: false,
            gtype: None,
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
                    })
                } else {
                    let name = type_name.unwrap_or("unknown");
                    bail!(
                        "Cannot copy boxed type '{}': no size or GType available. \
                         Pointer {:p} may become dangling if the source is freed",
                        name,
                        ptr
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

    #[must_use]
    pub fn gtype(&self) -> Option<glib::Type> {
        self.gtype
    }
}

impl Clone for Boxed {
    fn clone(&self) -> Self {
        if self.ptr.is_null() {
            return Self {
                ptr: std::ptr::null_mut(),
                owned: false,
                gtype: self.gtype,
            };
        }

        match self.gtype {
            Some(gt) => {
                let cloned_ptr = unsafe {
                    glib::gobject_ffi::g_boxed_copy(gt.into_glib(), self.ptr as *const _)
                };
                Self {
                    ptr: cloned_ptr,
                    owned: true,
                    gtype: self.gtype,
                }
            }
            None => {
                panic!(
                    "Cannot clone Boxed without GType - the size is unknown. \
                     Ensure the Boxed was created with a known size or GType."
                );
            }
        }
    }
}

impl Drop for Boxed {
    fn drop(&mut self) {
        if self.owned && !self.ptr.is_null() {
            unsafe {
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

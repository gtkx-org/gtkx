use std::ffi::c_void;

use anyhow::bail;
use gtk4::glib::{self, translate::IntoGlib as _};

use super::OwnedPtr;

#[derive(Debug)]
pub struct Boxed {
    inner: OwnedPtr,
    gtype: Option<glib::Type>,
}

impl Boxed {
    #[must_use]
    pub fn from_glib_full(gtype: Option<glib::Type>, ptr: *mut c_void) -> Self {
        Self {
            inner: OwnedPtr::from_full(ptr),
            gtype,
        }
    }

    #[must_use]
    pub(crate) fn from_ptr_unowned(ptr: *mut c_void) -> Self {
        Self {
            inner: OwnedPtr::from_none(ptr),
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
                inner: OwnedPtr::from_none(ptr),
                gtype,
            });
        }

        match gtype {
            Some(gt) => {
                let cloned_ptr =
                    unsafe { glib::gobject_ffi::g_boxed_copy(gt.into_glib(), ptr as *const _) };
                Ok(Self {
                    inner: OwnedPtr::from_full(cloned_ptr),
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
                        inner: OwnedPtr::from_full(cloned_ptr),
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
        self.inner.as_ptr()
    }

    #[must_use]
    pub fn gtype(&self) -> Option<glib::Type> {
        self.gtype
    }

    #[must_use]
    pub fn is_owned(&self) -> bool {
        self.inner.is_owned()
    }
}

impl Clone for Boxed {
    fn clone(&self) -> Self {
        if self.inner.is_null() {
            return Self {
                inner: OwnedPtr::from_none(std::ptr::null_mut()),
                gtype: self.gtype,
            };
        }

        match self.gtype {
            Some(gt) => {
                let cloned_ptr = unsafe {
                    glib::gobject_ffi::g_boxed_copy(gt.into_glib(), self.inner.as_ptr() as *const _)
                };
                Self {
                    inner: OwnedPtr::from_full(cloned_ptr),
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
        if self.inner.should_free() {
            unsafe {
                match self.gtype {
                    Some(gtype) => {
                        glib::gobject_ffi::g_boxed_free(gtype.into_glib(), self.inner.as_ptr());
                    }
                    None => {
                        glib::ffi::g_free(self.inner.as_ptr());
                    }
                }
            }
        }
    }
}

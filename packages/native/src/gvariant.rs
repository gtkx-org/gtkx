

use std::ffi::c_void;

use gtk4::glib;

#[derive(Debug)]
pub struct GVariant {
    ptr: *mut glib::ffi::GVariant,
    is_owned: bool,
}

impl GVariant {
    pub fn from_glib_full(ptr: *mut c_void) -> Self {
        Self {
            ptr: ptr as *mut glib::ffi::GVariant,
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

        let variant_ptr = ptr as *mut glib::ffi::GVariant;
        unsafe {
            glib::ffi::g_variant_ref_sink(variant_ptr);
        }
        Self {
            ptr: variant_ptr,
            is_owned: true,
        }
    }

    pub fn as_ptr(&self) -> *mut c_void {
        self.ptr as *mut c_void
    }
}

impl AsRef<*mut c_void> for GVariant {
    fn as_ref(&self) -> &*mut c_void {
        unsafe { &*((&self.ptr) as *const *mut glib::ffi::GVariant as *const *mut c_void) }
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
            glib::ffi::g_variant_ref(self.ptr);
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
                glib::ffi::g_variant_unref(self.ptr);
            }
        }
    }
}

use std::ffi::c_void;

use glib::translate::IntoGlib as _;

pub type BoxedFreeFn = unsafe extern "C" fn(*mut c_void);

#[derive(Debug)]
pub struct Boxed {
    ptr: *mut c_void,
    type_: Option<glib::Type>,
    free_fn: Option<BoxedFreeFn>,
}

impl Drop for Boxed {
    fn drop(&mut self) {
        if self.ptr.is_null() {
            return;
        }
        unsafe {
            match self.free_fn {
                Some(free_fn) => free_fn(self.ptr),
                None => {
                    if let Some(type_) = self.type_ {
                        glib::gobject_ffi::g_boxed_free(type_.into_glib(), self.ptr);
                    }
                }
            }
        }
    }
}

impl Boxed {
    pub(crate) const SIZE_HINT: usize = 256;

    pub fn from_glib_full(type_: glib::Type, ptr: *mut c_void) -> Self {
        Self {
            ptr,
            type_: Some(type_),
            free_fn: None,
        }
    }

    pub fn from_glib_full_with_free_fn(ptr: *mut c_void, free_fn: BoxedFreeFn) -> Self {
        Self {
            ptr,
            type_: None,
            free_fn: Some(free_fn),
        }
    }

    pub(crate) unsafe fn boxed_copy(type_: glib::Type, ptr: *mut c_void) -> *mut c_void {
        unsafe { glib::gobject_ffi::g_boxed_copy(type_.into_glib(), ptr as *const _) }
    }

    pub unsafe fn from_glib_none(type_: glib::Type, ptr: *mut c_void) -> Self {
        let cloned_ptr = unsafe { Self::boxed_copy(type_, ptr) };
        Self::from_glib_full(type_, cloned_ptr)
    }

    #[inline]
    pub fn as_ptr(&self) -> *mut c_void {
        self.ptr
    }

    pub fn type_(&self) -> Option<glib::Type> {
        self.type_
    }
}

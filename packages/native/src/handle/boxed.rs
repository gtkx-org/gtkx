use std::ffi::c_void;

use anyhow::bail;
use glib::translate::IntoGlib as _;

pub type BoxedFreeFn = unsafe extern "C" fn(*mut c_void);

#[derive(Debug)]
pub struct Boxed {
    ptr: *mut c_void,
    type_: Option<glib::Type>,
    destructor: Option<BoxedDestructor>,
}

#[derive(Debug, Clone)]
enum BoxedDestructor {
    BoxedFree(glib::Type),
    GBoxedFreeByName(glib::GString),
    GFree,
    Custom(BoxedFreeFn),
}

impl Drop for Boxed {
    fn drop(&mut self) {
        if self.ptr.is_null() {
            return;
        }
        let Some(destructor) = &self.destructor else {
            return;
        };
        unsafe {
            match destructor {
                BoxedDestructor::BoxedFree(type_) => {
                    glib::gobject_ffi::g_boxed_free(type_.into_glib(), self.ptr);
                }
                BoxedDestructor::GBoxedFreeByName(name) => match glib::Type::from_name(name) {
                    Some(type_) => {
                        glib::gobject_ffi::g_boxed_free(type_.into_glib(), self.ptr);
                    }
                    None => glib::ffi::g_free(self.ptr),
                },
                BoxedDestructor::GFree => glib::ffi::g_free(self.ptr),
                BoxedDestructor::Custom(free_fn) => free_fn(self.ptr),
            }
        }
    }
}

impl Boxed {
    pub(crate) const SIZE_HINT: usize = 256;

    fn owned(ptr: *mut c_void, type_: Option<glib::Type>, destructor: BoxedDestructor) -> Self {
        Self {
            ptr,
            type_,
            destructor: Some(destructor),
        }
    }

    fn borrowed(ptr: *mut c_void, type_: Option<glib::Type>) -> Self {
        Self {
            ptr,
            type_,
            destructor: None,
        }
    }

    pub fn from_glib_full(type_: Option<glib::Type>, ptr: *mut c_void) -> Self {
        let destructor = type_.map_or(BoxedDestructor::GFree, BoxedDestructor::BoxedFree);
        Self::owned(ptr, type_, destructor)
    }

    pub fn from_alloc(type_name: Option<glib::GString>, ptr: *mut c_void) -> Self {
        let Some(name) = type_name else {
            return Self::owned(ptr, None, BoxedDestructor::GFree);
        };
        if let Some(type_) = glib::Type::from_name(&name) {
            return Self::owned(ptr, Some(type_), BoxedDestructor::BoxedFree(type_));
        }
        Self::owned(ptr, None, BoxedDestructor::GBoxedFreeByName(name))
    }

    pub fn from_glib_full_with_free_fn(ptr: *mut c_void, free_fn: BoxedFreeFn) -> Self {
        Self::owned(ptr, None, BoxedDestructor::Custom(free_fn))
    }

    pub(crate) fn from_glib_borrow(ptr: *mut c_void) -> Self {
        Self::borrowed(ptr, None)
    }

    pub(crate) unsafe fn boxed_copy(type_: glib::Type, ptr: *mut c_void) -> *mut c_void {
        unsafe { glib::gobject_ffi::g_boxed_copy(type_.into_glib(), ptr as *const _) }
    }

    pub unsafe fn copy_with_size(ptr: *mut c_void, size: usize) -> Self {
        let cloned_ptr = unsafe { glib::ffi::g_memdup2(ptr as *const c_void, size) };
        Self::owned(cloned_ptr, None, BoxedDestructor::GFree)
    }

    pub unsafe fn from_glib_none(
        type_: Option<glib::Type>,
        ptr: *mut c_void,
        type_name: Option<&str>,
    ) -> anyhow::Result<Self> {
        if ptr.is_null() {
            return Ok(Self::borrowed(ptr, type_));
        }

        if let Some(type_) = type_ {
            let cloned_ptr = unsafe { Self::boxed_copy(type_, ptr) };
            return Ok(Self::owned(
                cloned_ptr,
                Some(type_),
                BoxedDestructor::BoxedFree(type_),
            ));
        }

        let name = type_name.unwrap_or("unknown");
        bail!(
            "Cannot copy boxed type '{name}': no type available. \
             Pointer {ptr:p} may become dangling if the source is freed"
        )
    }

    #[inline]
    pub fn as_ptr(&self) -> *mut c_void {
        self.ptr
    }

    #[inline]
    pub fn is_owned(&self) -> bool {
        self.destructor.is_some()
    }

    pub fn type_(&self) -> Option<glib::Type> {
        self.type_
    }
}

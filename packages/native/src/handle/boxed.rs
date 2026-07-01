use std::ffi::c_void;
use std::rc::Rc;

use anyhow::bail;
use glib::translate::IntoGlib as _;

use crate::ffi::codec::BoxedFreeFn;

#[derive(Debug)]
pub struct Boxed {
    ptr: *mut c_void,
    gtype: Option<glib::Type>,
    free_fn: Option<BoxedFreeFn>,
    allocation: Option<Rc<OwnedAllocation>>,
}

#[derive(Debug)]
struct OwnedAllocation {
    ptr: *mut c_void,
    destructor: BoxedDestructor,
}

#[derive(Debug, Clone)]
enum BoxedDestructor {
    BoxedFree(glib::Type),
    GBoxedFreeByName(glib::GString),
    GFree,
    Custom(BoxedFreeFn),
}

impl Drop for OwnedAllocation {
    fn drop(&mut self) {
        if self.ptr.is_null() {
            return;
        }
        unsafe {
            match &self.destructor {
                BoxedDestructor::BoxedFree(gtype) => {
                    glib::gobject_ffi::g_boxed_free(gtype.into_glib(), self.ptr);
                }
                BoxedDestructor::GBoxedFreeByName(name) => match glib::Type::from_name(name) {
                    Some(gtype) => {
                        glib::gobject_ffi::g_boxed_free(gtype.into_glib(), self.ptr);
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

    fn owned(
        ptr: *mut c_void,
        gtype: Option<glib::Type>,
        free_fn: Option<BoxedFreeFn>,
        destructor: BoxedDestructor,
    ) -> Self {
        Self {
            ptr,
            gtype,
            free_fn,
            allocation: Some(Rc::new(OwnedAllocation { ptr, destructor })),
        }
    }

    fn borrowed(ptr: *mut c_void, gtype: Option<glib::Type>, free_fn: Option<BoxedFreeFn>) -> Self {
        Self {
            ptr,
            gtype,
            free_fn,
            allocation: None,
        }
    }

    pub fn from_glib_full(gtype: Option<glib::Type>, ptr: *mut c_void) -> Self {
        let destructor = gtype.map_or(BoxedDestructor::GFree, BoxedDestructor::BoxedFree);
        Self::owned(ptr, gtype, None, destructor)
    }

    pub fn from_alloc(type_name: Option<glib::GString>, ptr: *mut c_void) -> Self {
        let Some(name) = type_name else {
            return Self::owned(ptr, None, None, BoxedDestructor::GFree);
        };
        if let Some(gtype) = glib::Type::from_name(&name) {
            return Self::owned(ptr, Some(gtype), None, BoxedDestructor::BoxedFree(gtype));
        }
        Self::owned(ptr, None, None, BoxedDestructor::GBoxedFreeByName(name))
    }

    pub fn from_glib_full_with_free_fn(ptr: *mut c_void, free_fn: BoxedFreeFn) -> Self {
        Self::owned(ptr, None, Some(free_fn), BoxedDestructor::Custom(free_fn))
    }

    pub(crate) fn from_glib_borrow(ptr: *mut c_void) -> Self {
        Self::borrowed(ptr, None, None)
    }

    pub(crate) unsafe fn boxed_copy(gtype: glib::Type, ptr: *mut c_void) -> *mut c_void {
        unsafe { glib::gobject_ffi::g_boxed_copy(gtype.into_glib(), ptr as *const _) }
    }

    pub fn copy_with_size(ptr: *mut c_void, size: usize) -> Self {
        let cloned_ptr = unsafe {
            let dest = glib::ffi::g_malloc(size);
            std::ptr::copy_nonoverlapping(ptr as *const u8, dest as *mut u8, size);
            dest
        };
        Self::owned(cloned_ptr, None, None, BoxedDestructor::GFree)
    }

    pub unsafe fn from_glib_none(
        gtype: Option<glib::Type>,
        ptr: *mut c_void,
    ) -> anyhow::Result<Self> {
        unsafe { Self::from_glib_none_with_size(gtype, ptr, None, None) }
    }

    pub unsafe fn from_glib_none_with_size(
        gtype: Option<glib::Type>,
        ptr: *mut c_void,
        size: Option<usize>,
        type_name: Option<&str>,
    ) -> anyhow::Result<Self> {
        if ptr.is_null() {
            return Ok(Self::borrowed(ptr, gtype, None));
        }

        if let Some(gt) = gtype {
            let cloned_ptr = unsafe { Self::boxed_copy(gt, ptr) };
            return Ok(Self::owned(
                cloned_ptr,
                gtype,
                None,
                BoxedDestructor::BoxedFree(gt),
            ));
        }

        let Some(s) = size else {
            let name = type_name.unwrap_or("unknown");
            bail!(
                "Cannot copy boxed type '{name}': no size or GType available. \
                 Pointer {ptr:p} may become dangling if the source is freed"
            )
        };
        Ok(Self::copy_with_size(ptr, s))
    }

    #[inline]
    pub fn as_ptr(&self) -> *mut c_void {
        self.ptr
    }

    #[inline]
    pub fn is_owned(&self) -> bool {
        self.allocation.is_some()
    }

    pub fn gtype(&self) -> Option<glib::Type> {
        self.gtype
    }

    #[inline]
    pub fn free_fn(&self) -> Option<BoxedFreeFn> {
        self.free_fn
    }
}

impl Clone for Boxed {
    fn clone(&self) -> Self {
        if self.ptr.is_null() || self.allocation.is_none() {
            return Self::borrowed(self.ptr, self.gtype, self.free_fn);
        }

        if let Some(gtype) = self.gtype
            && self.free_fn.is_none()
        {
            let cloned_ptr = unsafe { Self::boxed_copy(gtype, self.ptr) };
            return Self::owned(
                cloned_ptr,
                self.gtype,
                None,
                BoxedDestructor::BoxedFree(gtype),
            );
        }

        Self {
            ptr: self.ptr,
            gtype: self.gtype,
            free_fn: self.free_fn,
            allocation: self.allocation.clone(),
        }
    }
}

use std::ffi::c_void;
use std::rc::Rc;

use anyhow::bail;
use glib::translate::IntoGlib as _;

use crate::types::BoxedFreeFn;

#[derive(Debug)]
pub struct Boxed {
    ptr: *mut c_void,
    gtype: Option<glib::Type>,
    free_fn: Option<BoxedFreeFn>,
    ownership: Option<Rc<OwnedAllocation>>,
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
        // SAFETY: `self.ptr` is non-null (checked above) and owns an allocation whose kind matches
        // the `destructor` chosen when this `OwnedAllocation` was built: `BoxedFree`/`GBoxedFreeByName`
        // hold a boxed value of the named gtype freed with `g_boxed_free`, `GFree` a `g_malloc` block
        // freed with `g_free`, and `Custom` a value freed by its matching free function. `OwnedAllocation`
        // is the sole owner (held behind an `Rc`), so this frees the allocation exactly once. GTK/GObject
        // frees run on the gtkx-glib thread that owns these wrappers.
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
            ownership: Some(Rc::new(OwnedAllocation { ptr, destructor })),
        }
    }

    fn borrowed(ptr: *mut c_void, gtype: Option<glib::Type>, free_fn: Option<BoxedFreeFn>) -> Self {
        Self {
            ptr,
            gtype,
            free_fn,
            ownership: None,
        }
    }

    #[must_use]
    pub fn from_glib_full(gtype: Option<glib::Type>, ptr: *mut c_void) -> Self {
        let destructor = gtype.map_or(BoxedDestructor::GFree, BoxedDestructor::BoxedFree);
        Self::owned(ptr, gtype, None, destructor)
    }

    #[must_use]
    pub fn from_alloc(type_name: Option<glib::GString>, ptr: *mut c_void) -> Self {
        let Some(name) = type_name else {
            return Self::owned(ptr, None, None, BoxedDestructor::GFree);
        };
        if let Some(gtype) = glib::Type::from_name(&name) {
            return Self::owned(ptr, Some(gtype), None, BoxedDestructor::BoxedFree(gtype));
        }
        Self::owned(ptr, None, None, BoxedDestructor::GBoxedFreeByName(name))
    }

    #[must_use]
    pub fn from_glib_full_with_free_fn(ptr: *mut c_void, free_fn: BoxedFreeFn) -> Self {
        Self::owned(ptr, None, Some(free_fn), BoxedDestructor::Custom(free_fn))
    }

    #[must_use]
    pub(crate) fn from_ptr_unowned(ptr: *mut c_void) -> Self {
        Self::borrowed(ptr, None, None)
    }

    /// # Safety
    ///
    /// `ptr` must point to a live boxed value registered under `gtype`, and `gtype` must be a valid
    /// boxed `GType`. The returned pointer is an independently owned copy that the caller must free
    /// with `g_boxed_free` for the same `gtype`. Must run on the gtkx-glib thread.
    pub(crate) unsafe fn boxed_copy(gtype: glib::Type, ptr: *mut c_void) -> *mut c_void {
        // SAFETY: per the contract `ptr` is a live boxed value of `gtype`; `g_boxed_copy` returns a
        // freshly owned deep copy of it.
        unsafe { glib::gobject_ffi::g_boxed_copy(gtype.into_glib(), ptr as *const _) }
    }

    #[must_use]
    pub fn copy_with_size(ptr: *mut c_void, size: usize) -> Self {
        // SAFETY: the caller supplies `size` as the readable byte length of the value at `ptr`;
        // `g_malloc(size)` returns a fresh, distinct block of at least that size, so the two
        // regions cannot overlap and `copy_nonoverlapping` reads exactly `size` bytes from `ptr`
        // and writes them into the new block. The owned copy is freed with `g_free` to match
        // `g_malloc`.
        let cloned_ptr = unsafe {
            let dest = glib::ffi::g_malloc(size);
            std::ptr::copy_nonoverlapping(ptr as *const u8, dest as *mut u8, size);
            dest
        };
        Self::owned(cloned_ptr, None, None, BoxedDestructor::GFree)
    }

    pub fn from_glib_none(gtype: Option<glib::Type>, ptr: *mut c_void) -> anyhow::Result<Self> {
        Self::from_glib_none_with_size(gtype, ptr, None, None)
    }

    #[allow(clippy::not_unsafe_ptr_arg_deref)]
    pub fn from_glib_none_with_size(
        gtype: Option<glib::Type>,
        ptr: *mut c_void,
        size: Option<usize>,
        type_name: Option<&str>,
    ) -> anyhow::Result<Self> {
        if ptr.is_null() {
            return Ok(Self::borrowed(ptr, gtype, None));
        }

        if let Some(gt) = gtype {
            // SAFETY: `ptr` is non-null (checked above) and, when a `gtype` is supplied, the caller
            // guarantees it points to a live boxed value of `gt`; `boxed_copy` returns an owned deep
            // copy freed below with the matching `g_boxed_free`.
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
    #[must_use]
    pub fn as_ptr(&self) -> *mut c_void {
        self.ptr
    }

    #[inline]
    #[must_use]
    pub fn is_owned(&self) -> bool {
        self.ownership.is_some()
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
        if self.ptr.is_null() || self.ownership.is_none() {
            return Self::borrowed(self.ptr, self.gtype, self.free_fn);
        }

        if let Some(gtype) = self.gtype
            && self.free_fn.is_none()
        {
            // SAFETY: this branch is reached only for an owned boxed value (the borrowed/null cases
            // returned earlier) whose `gtype` is set, so `self.ptr` is a live boxed value of `gtype`;
            // `boxed_copy` produces an independently owned copy freed with the matching `g_boxed_free`.
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
            ownership: self.ownership.clone(),
        }
    }
}

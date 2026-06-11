use std::ffi::c_void;
use std::rc::Rc;

use anyhow::bail;
use gtk4::glib::{self, translate::IntoGlib as _};

use crate::types::BoxedFreeFn;

/// Wrapper for a boxed or plain-struct allocation crossing the FFI boundary.
///
/// A `Boxed` is either *borrowed* (a bare pointer view with no release duty)
/// or *owned*, in which case it holds an [`OwnedAllocation`] whose drop runs
/// the destructor matching how the memory was produced. Ownership is held
/// through an `Rc`: a clone of an owned value whose type supports deep
/// copying (`g_boxed_copy`) receives its own independent allocation, while a
/// clone of an owned value with no copy function (a custom destructor or a
/// `g_malloc` block of unknown size) shares the allocation, so a clone can
/// never outlive the memory it points at.
#[derive(Debug)]
pub struct Boxed {
    ptr: *mut c_void,
    gtype: Option<glib::Type>,
    free_fn: Option<BoxedFreeFn>,
    ownership: Option<Rc<OwnedAllocation>>,
}

/// The owning core of a [`Boxed`]: the allocation pointer paired with the
/// destructor that releases it exactly once, when the last sharing wrapper
/// drops.
#[derive(Debug)]
struct OwnedAllocation {
    ptr: *mut c_void,
    destructor: BoxedDestructor,
}

/// How an [`OwnedAllocation`] releases its memory, matching the allocator
/// that produced it.
#[derive(Debug, Clone)]
enum BoxedDestructor {
    /// A `GType`-registered boxed value, released with `g_boxed_free`.
    BoxedFree(glib::Type),
    /// A `g_malloc0` allocation made under a type name that had no registered
    /// `GType` at allocation time. Resolution is retried at release, when the
    /// type has had every chance to register: a registered boxed type is
    /// released with `g_boxed_free` (running its value destructor, e.g.
    /// `g_value_unset` for a `GValue`), while a plain C struct whose name
    /// never registers is released with `g_free`.
    GBoxedFreeByName(glib::GString),
    /// A plain `g_malloc` block, released with `g_free`.
    GFree,
    /// A value with a custom destructor (e.g. `cairo_path_destroy`).
    Custom(BoxedFreeFn),
}

impl Drop for OwnedAllocation {
    fn drop(&mut self) {
        if self.ptr.is_null() {
            return;
        }
        // SAFETY: This allocation owns `ptr`, the destructor matches the
        // allocator that produced it, and Rc sharing makes this drop the
        // single release.
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

    /// Wraps a zeroed `g_malloc0` allocation made under an optional type
    /// name, as produced by the `alloc` export.
    ///
    /// A name whose `GType` is already registered binds boxed semantics
    /// immediately; an unregistered name defers the decision to release time
    /// (see [`BoxedDestructor::GBoxedFreeByName`]), so the same allocation
    /// gets boxed cleanup once the type registers and plain `g_free` cleanup
    /// when the name never names a `GType` (a plain C struct).
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

    /// Wraps a caller-owned pointer whose destructor is neither
    /// `g_boxed_free` nor `g_free` (e.g. `cairo_path_destroy`).
    ///
    /// The destructor runs exactly once, when the last wrapper sharing the
    /// allocation drops.
    #[must_use]
    pub fn from_glib_full_with_free_fn(ptr: *mut c_void, free_fn: BoxedFreeFn) -> Self {
        Self::owned(ptr, None, Some(free_fn), BoxedDestructor::Custom(free_fn))
    }

    #[must_use]
    pub(crate) fn from_ptr_unowned(ptr: *mut c_void) -> Self {
        Self::borrowed(ptr, None, None)
    }

    /// Copies `size` bytes starting at `ptr` into a fresh owned `g_malloc`
    /// allocation. The infallible constructor for the known-size struct copy.
    #[must_use]
    pub fn copy_with_size(ptr: *mut c_void, size: usize) -> Self {
        // SAFETY: The caller passes a live allocation of at least `size`
        // bytes, and g_malloc aborts on failure, so `dest` holds `size`
        // writable bytes.
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
            // SAFETY: The caller passes a live boxed value of `gt`, the
            // type `g_boxed_copy` requires.
            let cloned_ptr =
                unsafe { glib::gobject_ffi::g_boxed_copy(gt.into_glib(), ptr as *const _) };
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
    /// Clones the wrapper. An owned `GType`-registered value is deep-copied
    /// with `g_boxed_copy`; an owned value with no copy function (custom
    /// destructor, or a `g_malloc` block of unknown size) shares its
    /// allocation with the clone, which keeps the memory alive until the last
    /// wrapper drops. A borrowed wrapper clones as another borrowed view.
    fn clone(&self) -> Self {
        if self.ptr.is_null() || self.ownership.is_none() {
            return Self::borrowed(self.ptr, self.gtype, self.free_fn);
        }

        if let Some(gtype) = self.gtype
            && self.free_fn.is_none()
        {
            // SAFETY: This wrapper owns a live boxed value of `gtype`, the
            // type `g_boxed_copy` requires.
            let cloned_ptr =
                unsafe { glib::gobject_ffi::g_boxed_copy(gtype.into_glib(), self.ptr as *const _) };
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

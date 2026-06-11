use std::ffi::c_void;

pub type UnrefFn = unsafe extern "C" fn(*mut c_void);
pub type RefFn = unsafe extern "C" fn(*mut c_void) -> *mut c_void;

#[derive(Debug)]
pub struct Fundamental {
    ptr: *mut c_void,
    owned: bool,
    ref_fn: Option<RefFn>,
    unref_fn: Option<UnrefFn>,
}

impl Fundamental {
    #[must_use]
    pub fn from_glib_full(
        ptr: *mut c_void,
        ref_fn: Option<RefFn>,
        unref_fn: Option<UnrefFn>,
    ) -> Self {
        Self {
            ptr,
            owned: true,
            ref_fn,
            unref_fn,
        }
    }

    /// # Safety
    /// `ptr` must be null or point to a valid fundamental type instance.
    #[must_use]
    pub unsafe fn from_glib_none(
        ptr: *mut c_void,
        ref_fn: Option<RefFn>,
        unref_fn: Option<UnrefFn>,
    ) -> Self {
        if ptr.is_null() {
            return Self {
                ptr: std::ptr::null_mut(),
                owned: false,
                ref_fn,
                unref_fn,
            };
        }

        // SAFETY: The caller guarantees the non-null `ptr` is a live
        // instance of the fundamental type `do_ref` expects.
        let owned_ptr = ref_fn.map_or(ptr, |do_ref| unsafe { do_ref(ptr) });

        Self {
            ptr: owned_ptr,
            owned: ref_fn.is_some(),
            ref_fn,
            unref_fn,
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
}

impl Clone for Fundamental {
    fn clone(&self) -> Self {
        if self.ptr.is_null() {
            return Self {
                ptr: std::ptr::null_mut(),
                owned: false,
                ref_fn: self.ref_fn,
                unref_fn: self.unref_fn,
            };
        }

        let cloned_ptr = self
            .ref_fn
            // SAFETY: `self.ptr` is non-null here and stays live for as
            // long as this wrapper holds its reference.
            .map_or(self.ptr, |ref_fn| unsafe { ref_fn(self.ptr) });

        Self {
            ptr: cloned_ptr,
            owned: self.ref_fn.is_some(),
            ref_fn: self.ref_fn,
            unref_fn: self.unref_fn,
        }
    }
}

impl Drop for Fundamental {
    fn drop(&mut self) {
        if self.owned
            && !self.ptr.is_null()
            && let Some(unref_fn) = self.unref_fn
        {
            // SAFETY: `owned` marks the one reference this wrapper holds,
            // released here exactly once.
            unsafe { unref_fn(self.ptr) };
        }
    }
}

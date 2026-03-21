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

    #[must_use]
    #[allow(clippy::not_unsafe_ptr_arg_deref)]
    pub fn from_glib_none(
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

        let owned_ptr = if let Some(do_ref) = ref_fn {
            unsafe { do_ref(ptr) }
        } else {
            ptr
        };

        Self {
            ptr: owned_ptr,
            owned: true,
            ref_fn,
            unref_fn,
        }
    }

    #[inline]
    #[must_use]
    pub fn as_ptr(&self) -> *mut c_void {
        self.ptr
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

        let cloned_ptr = if let Some(ref_fn) = self.ref_fn {
            unsafe { ref_fn(self.ptr) }
        } else {
            self.ptr
        };

        Self {
            ptr: cloned_ptr,
            owned: true,
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
            unsafe { unref_fn(self.ptr) };
        }
    }
}

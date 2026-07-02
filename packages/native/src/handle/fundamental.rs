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
    pub(crate) const SIZE_HINT: usize = 128;

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

        let owned_ptr = ref_fn.map_or(ptr, |ref_fn| unsafe { ref_fn(ptr) });

        Self {
            ptr: owned_ptr,
            owned: ref_fn.is_some(),
            ref_fn,
            unref_fn,
        }
    }

    #[inline]
    pub fn as_ptr(&self) -> *mut c_void {
        self.ptr
    }
}

impl Clone for Fundamental {
    fn clone(&self) -> Self {
        unsafe { Self::from_glib_none(self.ptr, self.ref_fn, self.unref_fn) }
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

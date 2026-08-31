use std::ffi::c_void;

pub type UnrefFn = unsafe extern "C" fn(*mut c_void);
pub type RefFn = unsafe extern "C" fn(*mut c_void) -> *mut c_void;

#[derive(Debug)]
pub struct Fundamental {
    ptr: *mut c_void,
    owned: bool,
    unref_fn: Option<UnrefFn>,
}

impl Fundamental {
    pub(crate) const SIZE_HINT: usize = 128;

    /// # Safety
    ///
    /// This takes ownership of one reference to `ptr`, so `ptr` must either be null or a valid
    /// pointer to a live fundamental instance whose reference the caller is transferring. If
    /// `unref_fn` is `Some`, it must be the release function for that exact instance type; it is
    /// called once on drop, and the caller must not release the transferred reference itself.
    pub unsafe fn from_glib_full(ptr: *mut c_void, unref_fn: Option<UnrefFn>) -> Self {
        Self {
            ptr,
            owned: true,
            unref_fn,
        }
    }

    /// # Safety
    ///
    /// `ptr` must either be null or a valid pointer to a live fundamental instance that the caller
    /// keeps owning. `ref_fn` and `unref_fn`, when `Some`, must be the acquire and release
    /// functions for that exact instance type. With a `ref_fn` the wrapper takes its own reference
    /// and drops it later; without one it only borrows `ptr`, which must then outlive the wrapper.
    pub unsafe fn from_glib_none(
        ptr: *mut c_void,
        ref_fn: Option<RefFn>,
        unref_fn: Option<UnrefFn>,
    ) -> Self {
        if ptr.is_null() {
            return Self {
                ptr: std::ptr::null_mut(),
                owned: false,
                unref_fn,
            };
        }

        let owned_ptr = ref_fn.map_or(ptr, |ref_fn| unsafe { ref_fn(ptr) });

        Self {
            ptr: owned_ptr,
            owned: ref_fn.is_some(),
            unref_fn,
        }
    }

    #[inline]
    #[must_use]
    pub fn as_ptr(&self) -> *mut c_void {
        self.ptr
    }

    /// Whether the wrapper holds its own reference to the instance, keeping the pointer valid for
    /// as long as the wrapper exists.
    #[inline]
    #[must_use]
    pub fn is_owned(&self) -> bool {
        self.owned
    }

    /// The function that releases the instance, which names the fundamental family the value
    /// belongs to without dereferencing the pointer.
    #[inline]
    #[must_use]
    pub fn unref_fn(&self) -> Option<UnrefFn> {
        self.unref_fn
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

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
    ///
    /// `ptr` must be null or point to a live fundamental value of the type whose `ref_fn`/`unref_fn`
    /// are supplied. When `ref_fn` is `Some`, it is invoked to take an owned reference that the
    /// returned wrapper releases on drop via `unref_fn`; `ref_fn` and `unref_fn` must be the
    /// matching ref/unref pair for the value. Must run on the gtkx-glib thread.
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

        // SAFETY: `ptr` is non-null (checked above) and, per the contract, a live fundamental value
        // for which `do_ref` is the correct ref function; calling it takes one owned reference and
        // returns the referenced pointer. Without a ref function the wrapper stays borrowed.
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

        // SAFETY: `self.ptr` is non-null (checked above) and a live fundamental value paired with
        // `self.ref_fn`; calling it takes one additional owned reference for the cloned wrapper,
        // released on drop via `self.unref_fn`. With no ref function the clone stays borrowed.
        let cloned_ptr = self
            .ref_fn
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
            // SAFETY: the wrapper owns one reference (`self.owned`) on the non-null `self.ptr`, and
            // `self.unref_fn` is the unref matching the ref taken at construction/clone; this drop
            // releases exactly that one reference once. GObject unrefs run on the gtkx-glib thread.
            unsafe { unref_fn(self.ptr) };
        }
    }
}

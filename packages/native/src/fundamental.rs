use std::ffi::c_void;

use crate::{state::GtkThreadState, types::FundamentalType};

pub type UnrefFn = unsafe extern "C" fn(*mut c_void);
pub type RefFn = unsafe extern "C" fn(*mut c_void) -> *mut c_void;

#[derive(Debug)]
pub struct Fundamental {
    ptr: *mut c_void,
    unref_fn: Option<UnrefFn>,
    ref_fn: Option<RefFn>,
    is_owned: bool,
}

impl Fundamental {
    pub fn from_glib_full(
        ptr: *mut c_void,
        ref_fn: Option<RefFn>,
        unref_fn: Option<UnrefFn>,
    ) -> Self {
        Self {
            ptr,
            unref_fn,
            ref_fn,
            is_owned: true,
        }
    }

    #[allow(clippy::not_unsafe_ptr_arg_deref)]
    pub fn from_glib_none(
        ptr: *mut c_void,
        ref_fn: Option<RefFn>,
        unref_fn: Option<UnrefFn>,
    ) -> Self {
        if ptr.is_null() {
            return Self {
                ptr: std::ptr::null_mut(),
                unref_fn,
                ref_fn,
                is_owned: false,
            };
        }

        if let Some(ref_fn) = ref_fn {
            unsafe { ref_fn(ptr) };
        }

        Self {
            ptr,
            unref_fn,
            ref_fn,
            is_owned: true,
        }
    }

    #[inline]
    pub fn as_ptr(&self) -> *mut c_void {
        self.ptr
    }

    #[must_use]
    pub fn is_owned(&self) -> bool {
        self.is_owned
    }

    pub fn lookup_fns(
        fundamental_type: &FundamentalType,
    ) -> anyhow::Result<(Option<RefFn>, Option<UnrefFn>)> {
        GtkThreadState::with(|state| {
            let library = state.get_library(&fundamental_type.library)?;

            let ref_fn = unsafe {
                library
                    .get::<RefFn>(fundamental_type.ref_func.as_bytes())
                    .ok()
                    .map(|sym| *sym)
            };

            let unref_fn = unsafe {
                library
                    .get::<UnrefFn>(fundamental_type.unref_func.as_bytes())
                    .ok()
                    .map(|sym| *sym)
            };

            Ok((ref_fn, unref_fn))
        })
    }
}

impl Clone for Fundamental {
    fn clone(&self) -> Self {
        if self.ptr.is_null() {
            return Self {
                ptr: std::ptr::null_mut(),
                unref_fn: self.unref_fn,
                ref_fn: self.ref_fn,
                is_owned: false,
            };
        }

        if let Some(ref_fn) = self.ref_fn {
            unsafe { ref_fn(self.ptr) };
        }

        Self {
            ptr: self.ptr,
            unref_fn: self.unref_fn,
            ref_fn: self.ref_fn,
            is_owned: true,
        }
    }
}

impl Drop for Fundamental {
    fn drop(&mut self) {
        if self.is_owned
            && !self.ptr.is_null()
            && let Some(unref_fn) = self.unref_fn
        {
            unsafe { unref_fn(self.ptr) };
        }
    }
}

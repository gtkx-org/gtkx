use std::ffi::c_void;

#[derive(Debug, Clone, Copy)]
pub struct OwnedPtr {
    ptr: *mut c_void,
    is_owned: bool,
}

impl OwnedPtr {
    pub const fn null() -> Self {
        Self {
            ptr: std::ptr::null_mut(),
            is_owned: false,
        }
    }

    pub const fn from_full(ptr: *mut c_void) -> Self {
        Self {
            ptr,
            is_owned: true,
        }
    }

    pub const fn from_none(ptr: *mut c_void) -> Self {
        Self {
            ptr,
            is_owned: false,
        }
    }

    #[inline]
    pub fn as_ptr(&self) -> *mut c_void {
        self.ptr
    }

    #[inline]
    pub fn is_owned(&self) -> bool {
        self.is_owned
    }

    #[inline]
    pub fn is_null(&self) -> bool {
        self.ptr.is_null()
    }

    #[inline]
    pub fn should_free(&self) -> bool {
        self.is_owned && !self.ptr.is_null()
    }
}

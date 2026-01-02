use std::{any::Any, ffi::c_void};

#[derive(Debug)]
#[repr(C)]
pub struct OwnedPtr {
    pub ptr: *mut c_void,
    pub value: Box<dyn Any>,
}

impl std::ops::Deref for OwnedPtr {
    type Target = *mut c_void;

    fn deref(&self) -> &Self::Target {
        &self.ptr
    }
}

impl OwnedPtr {
    pub fn new<T: 'static>(value: T, ptr: *mut c_void) -> Self {
        Self {
            value: Box::new(value),
            ptr,
        }
    }

    pub fn from_vec<T: 'static>(vec: Vec<T>) -> Self {
        let boxed: Box<Vec<T>> = Box::new(vec);
        let ptr = boxed.as_ptr() as *mut c_void;
        Self { value: boxed, ptr }
    }
}

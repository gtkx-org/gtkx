use std::ffi::c_void;

#[derive(Debug, Clone, Copy)]
pub struct Slot(*mut c_void);

impl Slot {
    pub unsafe fn new(ptr: *mut c_void) -> Self {
        Self(ptr)
    }

    pub unsafe fn store(self, value: *mut c_void) {
        unsafe { self.0.cast::<*mut c_void>().write_unaligned(value) };
    }

    pub unsafe fn load(self) -> *mut c_void {
        unsafe { self.0.cast::<*mut c_void>().read_unaligned() }
    }

    pub unsafe fn swap(self, value: *mut c_void) -> *mut c_void {
        let previous = unsafe { self.load() };
        unsafe { self.store(value) };
        previous
    }

    pub fn as_ptr(self) -> *mut c_void {
        self.0
    }
}

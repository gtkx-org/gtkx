use std::ffi::c_void;

pub struct Slot(*mut c_void);

impl Slot {
    pub fn new(ptr: *mut c_void) -> Self {
        Self(ptr)
    }

    pub unsafe fn store(&self, value: *mut c_void) {
        unsafe { (self.0 as *mut *mut c_void).write_unaligned(value) };
    }

    pub unsafe fn load(&self) -> *mut c_void {
        unsafe { (self.0 as *const *mut c_void).read_unaligned() }
    }

    pub unsafe fn swap(&self, value: *mut c_void) -> *mut c_void {
        let previous = unsafe { self.load() };
        unsafe { self.store(value) };
        previous
    }
}

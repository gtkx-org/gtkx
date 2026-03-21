use std::ptr::NonNull;

use gtk4::glib::gobject_ffi;

#[derive(Debug)]
pub struct ClosureGuard {
    closure: NonNull<gobject_ffi::GClosure>,
}

impl ClosureGuard {
    #[must_use]
    pub fn new(closure: NonNull<gobject_ffi::GClosure>) -> Self {
        unsafe { gobject_ffi::g_closure_ref(closure.as_ptr()) };
        Self { closure }
    }

    pub fn from_ptr(closure: *mut gobject_ffi::GClosure) -> Option<Self> {
        NonNull::new(closure).map(Self::new)
    }
}

impl Drop for ClosureGuard {
    fn drop(&mut self) {
        unsafe { gobject_ffi::g_closure_unref(self.closure.as_ptr()) };
    }
}

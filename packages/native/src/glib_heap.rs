use std::ffi::c_void;

pub(crate) unsafe fn dup_to_glib_heap(src: *const u8, len: usize) -> *mut c_void {
    unsafe { glib::ffi::g_memdup2(src.cast(), len) }
}

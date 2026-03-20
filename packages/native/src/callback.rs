use std::ffi::c_void;
use std::ptr::NonNull;

use gtk4::glib::{self, gobject_ffi, translate::FromGlibPtrNone as _, value::ToValue as _};

pub struct ClosureGuard {
    closure: NonNull<gobject_ffi::GClosure>,
}

impl ClosureGuard {
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

/// # Safety
/// `source_object` must be a valid `GObject*` or null.
/// `res` must be a valid `GAsyncResult*` or null.
/// `user_data` must be a valid `GClosure*` allocated via `g_closure_ref`, or null.
pub unsafe extern "C" fn async_ready_trampoline(
    source_object: *mut gobject_ffi::GObject,
    res: *mut gtk4::gio::ffi::GAsyncResult,
    user_data: *mut c_void,
) {
    let Some(closure_ptr) = NonNull::new(user_data as *mut gobject_ffi::GClosure) else {
        return;
    };

    unsafe {
        let _guard = ClosureGuard::new(closure_ptr);

        let source_obj: Option<glib::Object> =
            NonNull::new(source_object).map(|p| glib::Object::from_glib_none(p.as_ptr()));

        let res_obj: Option<glib::Object> = NonNull::new(res as *mut gobject_ffi::GObject)
            .map(|p| glib::Object::from_glib_none(p.as_ptr()));

        let source_value: glib::Value = source_obj.to_value();
        let res_value: glib::Value = res_obj.to_value();
        let param_values = [source_value, res_value];

        gobject_ffi::g_closure_invoke(
            closure_ptr.as_ptr(),
            std::ptr::null_mut(),
            param_values.len() as u32,
            param_values.as_ptr() as *const gobject_ffi::GValue as *const _,
            std::ptr::null_mut(),
        );
    }

    unsafe { gobject_ffi::g_closure_unref(closure_ptr.as_ptr()) };
}

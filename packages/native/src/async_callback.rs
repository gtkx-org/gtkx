use std::ffi::c_void;

use gtk4::gio::ffi::GAsyncResult;
use gtk4::glib::{self, gobject_ffi, prelude::*, translate::FromGlibPtrNone as _};

#[allow(dead_code)]
pub type GAsyncReadyCallback =
    Option<unsafe extern "C" fn(*mut gobject_ffi::GObject, *mut GAsyncResult, *mut c_void)>;

unsafe extern "C" fn async_ready_trampoline(
    source_object: *mut gobject_ffi::GObject,
    res: *mut GAsyncResult,
    user_data: *mut c_void,
) {
    unsafe {
        let closure_ptr = user_data as *mut gobject_ffi::GClosure;
        if closure_ptr.is_null() {
            eprintln!("async_ready_trampoline: user_data (closure) is null");
            return;
        }

        let source_obj: Option<glib::Object> = if source_object.is_null() {
            None
        } else {
            Some(glib::Object::from_glib_none(source_object))
        };

        let res_obj: Option<glib::Object> = if res.is_null() {
            None
        } else {
            Some(glib::Object::from_glib_none(
                res as *mut gobject_ffi::GObject,
            ))
        };

        let source_value: glib::Value = source_obj.to_value();
        let res_value: glib::Value = res_obj.to_value();
        let param_values = [source_value, res_value];

        gobject_ffi::g_closure_invoke(
            closure_ptr,
            std::ptr::null_mut(),
            param_values.len() as u32,
            param_values.as_ptr() as *const gobject_ffi::GValue as *const _,
            std::ptr::null_mut(),
        );

        gobject_ffi::g_closure_unref(closure_ptr);
    }
}

#[allow(dead_code)]
pub fn get_async_ready_trampoline() -> GAsyncReadyCallback {
    Some(async_ready_trampoline)
}

pub fn get_async_ready_trampoline_ptr() -> *mut c_void {
    async_ready_trampoline as *mut c_void
}

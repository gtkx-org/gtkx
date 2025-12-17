//! Callback trampolines for bridging JavaScript functions to GTK signals.
//!
//! GTK uses C function pointers for callbacks, but we need to invoke JavaScript
//! functions. This module provides trampoline functions that act as C-compatible
//! wrappers, receiving arguments from GTK and forwarding them to the appropriate
//! GLib closure which then invokes the JavaScript callback.

use std::ffi::c_void;

use gtk4::{
    gio::ffi::GAsyncResult,
    glib::{
        self, gobject_ffi,
        translate::{FromGlibPtrNone as _, ToGlibPtrMut as _},
        value::ToValue as _,
    },
};

/// Trampoline for GTK DrawingArea draw functions.
///
/// # Safety
///
/// This function is called from C code. The `user_data` pointer must be a valid
/// pointer to a `GClosure`, and all other pointers must be valid GTK objects.
unsafe extern "C" fn draw_func_trampoline(
    drawing_area: *mut c_void,
    cr: *mut c_void,
    width: i32,
    height: i32,
    user_data: *mut c_void,
) {
    let closure_ptr = user_data as *mut gobject_ffi::GClosure;

    if closure_ptr.is_null() {
        return;
    }

    unsafe {
        let mut args: [glib::Value; 4] = [
            glib::Value::from_type_unchecked(glib::types::Type::OBJECT),
            glib::Value::from_type_unchecked(glib::types::Type::U64),
            glib::Value::from_type_unchecked(glib::types::Type::I32),
            glib::Value::from_type_unchecked(glib::types::Type::I32),
        ];

        gobject_ffi::g_value_set_object(
            args[0].to_glib_none_mut().0,
            drawing_area as *mut gobject_ffi::GObject,
        );

        gobject_ffi::g_value_set_uint64(args[1].to_glib_none_mut().0, cr as u64);
        gobject_ffi::g_value_set_int(args[2].to_glib_none_mut().0, width);
        gobject_ffi::g_value_set_int(args[3].to_glib_none_mut().0, height);

        gobject_ffi::g_closure_invoke(
            closure_ptr,
            std::ptr::null_mut(),
            4,
            args[0].to_glib_none_mut().0,
            std::ptr::null_mut(),
        );
    }
}

/// Returns the function pointer to the draw function trampoline.
pub fn get_draw_func_trampoline_ptr() -> *mut c_void {
    draw_func_trampoline as *mut c_void
}

/// Trampoline for GDestroyNotify callbacks.
///
/// # Safety
///
/// This function is called from C code. The `user_data` pointer must be a valid
/// pointer to a `GClosure`.
unsafe extern "C" fn destroy_trampoline(user_data: *mut c_void) {
    let closure_ptr = user_data as *mut gobject_ffi::GClosure;

    if closure_ptr.is_null() {
        return;
    }

    unsafe {
        gobject_ffi::g_closure_invoke(
            closure_ptr,
            std::ptr::null_mut(),
            0,
            std::ptr::null(),
            std::ptr::null_mut(),
        );

        gobject_ffi::g_closure_unref(closure_ptr);
    }
}

/// Returns the function pointer to the destroy trampoline.
pub fn get_destroy_trampoline_ptr() -> *mut c_void {
    destroy_trampoline as *mut c_void
}

/// Trampoline that simply unrefs a closure without invoking it.
///
/// Used as a destroy notify for closures that shouldn't be called on cleanup.
///
/// # Safety
///
/// This function is called from C code. The `user_data` pointer must be a valid
/// pointer to a `GClosure`.
unsafe extern "C" fn unref_closure_trampoline(user_data: *mut c_void) {
    let closure_ptr = user_data as *mut gobject_ffi::GClosure;

    if closure_ptr.is_null() {
        return;
    }

    unsafe {
        gobject_ffi::g_closure_unref(closure_ptr);
    }
}

/// Returns the function pointer to the unref closure trampoline.
pub fn get_unref_closure_trampoline_ptr() -> *mut c_void {
    unref_closure_trampoline as *mut c_void
}

/// Trampoline for GtkTickCallback (frame clock tick callbacks).
///
/// Returns 1 (TRUE) to keep the callback active, 0 (FALSE) to remove it.
/// The closure is cleaned up by the destroy notify callback, not here.
///
/// # Safety
///
/// This function is called from C code. The `user_data` pointer must be a valid
/// pointer to a `GClosure`, and `widget` and `frame_clock` must be valid GTK objects.
unsafe extern "C" fn tick_func_trampoline(
    widget: *mut c_void,
    frame_clock: *mut c_void,
    user_data: *mut c_void,
) -> i32 {
    let closure_ptr = user_data as *mut gobject_ffi::GClosure;

    if closure_ptr.is_null() {
        return 0;
    }

    unsafe {
        let mut args: [glib::Value; 2] = [
            glib::Value::from_type_unchecked(glib::types::Type::OBJECT),
            glib::Value::from_type_unchecked(glib::types::Type::OBJECT),
        ];

        gobject_ffi::g_value_set_object(
            args[0].to_glib_none_mut().0,
            widget as *mut gobject_ffi::GObject,
        );
        gobject_ffi::g_value_set_object(
            args[1].to_glib_none_mut().0,
            frame_clock as *mut gobject_ffi::GObject,
        );

        let mut return_value = glib::Value::from_type_unchecked(glib::types::Type::BOOL);

        gobject_ffi::g_closure_invoke(
            closure_ptr,
            return_value.to_glib_none_mut().0,
            2,
            args[0].to_glib_none_mut().0,
            std::ptr::null_mut(),
        );

        let result = return_value.get::<bool>().unwrap_or(false);
        i32::from(result)
    }
}

/// Returns the function pointer to the tick function trampoline.
pub fn get_tick_func_trampoline_ptr() -> *mut c_void {
    tick_func_trampoline as *mut c_void
}

/// Trampoline for GSourceFunc callbacks (e.g., idle_add_full, timeout_add_full).
///
/// Returns 1 (TRUE) to keep the source active, 0 (FALSE) to remove it.
/// The closure is cleaned up by the destroy notify callback, not here.
///
/// # Safety
///
/// This function is called from C code. The `user_data` pointer must be a valid
/// pointer to a `GClosure`.
unsafe extern "C" fn source_func_trampoline(user_data: *mut c_void) -> i32 {
    let closure_ptr = user_data as *mut gobject_ffi::GClosure;

    if closure_ptr.is_null() {
        return 0;
    }

    unsafe {
        let mut return_value = glib::Value::from_type_unchecked(glib::types::Type::BOOL);

        gobject_ffi::g_closure_invoke(
            closure_ptr,
            return_value.to_glib_none_mut().0,
            0,
            std::ptr::null(),
            std::ptr::null_mut(),
        );

        let result = return_value.get::<bool>().unwrap_or(false);
        i32::from(result)
    }
}

/// Returns the function pointer to the source function trampoline.
pub fn get_source_func_trampoline_ptr() -> *mut c_void {
    source_func_trampoline as *mut c_void
}

/// Trampoline for GAsyncReadyCallback (async operation completion).
///
/// # Safety
///
/// This function is called from C code. All pointers must be valid GObject
/// instances or null, and `user_data` must be a valid `GClosure` pointer.
unsafe extern "C" fn async_ready_trampoline(
    source_object: *mut gobject_ffi::GObject,
    res: *mut GAsyncResult,
    user_data: *mut c_void,
) {
    let closure_ptr = user_data as *mut gobject_ffi::GClosure;

    if closure_ptr.is_null() {
        return;
    }

    unsafe {
        let source_obj: Option<glib::Object> =
            std::ptr::NonNull::new(source_object).map(|p| glib::Object::from_glib_none(p.as_ptr()));

        let res_obj: Option<glib::Object> =
            std::ptr::NonNull::new(res as *mut gobject_ffi::GObject)
                .map(|p| glib::Object::from_glib_none(p.as_ptr()));

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

/// Returns the function pointer to the async ready trampoline.
pub fn get_async_ready_trampoline_ptr() -> *mut c_void {
    async_ready_trampoline as *mut c_void
}

/// Trampoline for GCompareDataFunc (comparison callbacks for sorting).
///
/// Returns a negative value if a < b, 0 if a == b, positive if a > b.
///
/// # Safety
///
/// This function is called from C code. All pointers must be valid GObject
/// instances, and `user_data` must be a valid `GClosure` pointer.
unsafe extern "C" fn compare_data_func_trampoline(
    a: *mut gobject_ffi::GObject,
    b: *mut gobject_ffi::GObject,
    user_data: *mut c_void,
) -> i32 {
    let closure_ptr = user_data as *mut gobject_ffi::GClosure;

    if closure_ptr.is_null() {
        return 0;
    }

    unsafe {
        let mut args: [glib::Value; 2] = [
            glib::Value::from_type_unchecked(glib::types::Type::OBJECT),
            glib::Value::from_type_unchecked(glib::types::Type::OBJECT),
        ];

        gobject_ffi::g_value_set_object(args[0].to_glib_none_mut().0, a);
        gobject_ffi::g_value_set_object(args[1].to_glib_none_mut().0, b);

        let mut return_value = glib::Value::from_type_unchecked(glib::types::Type::I32);

        gobject_ffi::g_closure_invoke(
            closure_ptr,
            return_value.to_glib_none_mut().0,
            2,
            args[0].to_glib_none_mut().0,
            std::ptr::null_mut(),
        );

        return_value.get::<i32>().unwrap_or(0)
    }
}

/// Returns the function pointer to the compare data function trampoline.
pub fn get_compare_data_func_trampoline_ptr() -> *mut c_void {
    compare_data_func_trampoline as *mut c_void
}

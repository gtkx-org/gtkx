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
            glib::Value::from_type_unchecked(glib::types::Type::POINTER),
            glib::Value::from_type_unchecked(glib::types::Type::I32),
            glib::Value::from_type_unchecked(glib::types::Type::I32),
        ];

        gobject_ffi::g_value_set_object(
            args[0].to_glib_none_mut().0,
            drawing_area as *mut gobject_ffi::GObject,
        );

        gobject_ffi::g_value_set_pointer(args[1].to_glib_none_mut().0, cr as *mut c_void);
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_utils;
    use std::sync::{
        Arc,
        atomic::{AtomicBool, Ordering},
    };

    fn create_test_closure_with_flag(flag: Arc<AtomicBool>) -> *mut glib::gobject_ffi::GClosure {
        test_utils::ensure_gtk_init();

        let closure = glib::Closure::new(move |_| {
            flag.store(true, Ordering::SeqCst);
            None::<glib::Value>
        });

        use glib::translate::ToGlibPtr as _;
        let ptr: *mut glib::gobject_ffi::GClosure = closure.to_glib_full();
        std::mem::forget(closure);
        ptr
    }

    #[test]
    fn draw_func_trampoline_null_closure_safe() {
        test_utils::ensure_gtk_init();

        unsafe {
            draw_func_trampoline(
                std::ptr::null_mut(),
                std::ptr::null_mut(),
                100,
                100,
                std::ptr::null_mut(),
            );
        }
    }

    #[test]
    fn draw_func_trampoline_invokes_closure() {
        let invoked = Arc::new(AtomicBool::new(false));
        let closure_ptr = create_test_closure_with_flag(invoked.clone());

        unsafe {
            draw_func_trampoline(
                std::ptr::null_mut(),
                std::ptr::null_mut(),
                100,
                100,
                closure_ptr as *mut c_void,
            );
        }

        assert!(invoked.load(Ordering::SeqCst));

        unsafe {
            glib::gobject_ffi::g_closure_unref(closure_ptr);
        }
    }

    #[test]
    fn destroy_trampoline_null_closure_safe() {
        test_utils::ensure_gtk_init();

        unsafe {
            destroy_trampoline(std::ptr::null_mut());
        }
    }

    #[test]
    fn destroy_trampoline_invokes_and_unrefs() {
        let invoked = Arc::new(AtomicBool::new(false));
        let closure_ptr = create_test_closure_with_flag(invoked.clone());

        unsafe {
            destroy_trampoline(closure_ptr as *mut c_void);
        }

        assert!(invoked.load(Ordering::SeqCst));
    }

    #[test]
    fn unref_closure_trampoline_null_safe() {
        test_utils::ensure_gtk_init();

        unsafe {
            unref_closure_trampoline(std::ptr::null_mut());
        }
    }

    #[test]
    fn unref_closure_trampoline_decrements_refcount() {
        test_utils::ensure_gtk_init();

        let closure = glib::Closure::new(|_| None::<glib::Value>);

        use glib::translate::ToGlibPtr as _;
        let ptr: *mut glib::gobject_ffi::GClosure = closure.to_glib_full();

        unsafe {
            glib::gobject_ffi::g_closure_ref(ptr);
        }

        let ref_before = unsafe { (*ptr).ref_count };

        unsafe {
            unref_closure_trampoline(ptr as *mut c_void);
        }

        let ref_after = unsafe { (*ptr).ref_count };

        assert_eq!(ref_after, ref_before - 1);

        unsafe {
            glib::gobject_ffi::g_closure_unref(ptr);
        }
    }

    #[test]
    fn async_ready_trampoline_null_safe() {
        test_utils::ensure_gtk_init();

        unsafe {
            async_ready_trampoline(
                std::ptr::null_mut(),
                std::ptr::null_mut(),
                std::ptr::null_mut(),
            );
        }
    }

    #[test]
    fn get_trampoline_ptrs_not_null() {
        assert!(!get_draw_func_trampoline_ptr().is_null());
        assert!(!get_destroy_trampoline_ptr().is_null());
        assert!(!get_unref_closure_trampoline_ptr().is_null());
        assert!(!get_async_ready_trampoline_ptr().is_null());
    }
}

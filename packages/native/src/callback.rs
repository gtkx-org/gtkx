

use std::ffi::c_void;

use gtk4::{
    gio::ffi::GAsyncResult,
    glib::{
        self, gobject_ffi,
        translate::{FromGlibPtrNone as _, ToGlibPtrMut as _},
        value::ToValue as _,
    },
};

pub struct DrawFuncData {
    pub closure: *mut gobject_ffi::GClosure,
    pub arg_gtypes: Vec<glib::Type>,
}

unsafe extern "C" fn draw_func_trampoline(
    drawing_area: *mut c_void,
    cr: *mut c_void,
    width: i32,
    height: i32,
    user_data: *mut c_void,
) {
    let data_ptr = user_data as *mut DrawFuncData;

    if data_ptr.is_null() {
        return;
    }

    let data = unsafe { &*data_ptr };
    let closure_ptr = data.closure;

    if closure_ptr.is_null() {
        return;
    }

    unsafe {
        let mut args: [glib::Value; 4] = [
            glib::Value::from_type_unchecked(
                data.arg_gtypes
                    .first()
                    .copied()
                    .unwrap_or(glib::types::Type::OBJECT),
            ),
            glib::Value::from_type_unchecked(
                data.arg_gtypes
                    .get(1)
                    .copied()
                    .unwrap_or(glib::types::Type::POINTER),
            ),
            glib::Value::from_type_unchecked(
                data.arg_gtypes
                    .get(2)
                    .copied()
                    .unwrap_or(glib::types::Type::I32),
            ),
            glib::Value::from_type_unchecked(
                data.arg_gtypes
                    .get(3)
                    .copied()
                    .unwrap_or(glib::types::Type::I32),
            ),
        ];

        gobject_ffi::g_value_set_object(
            args[0].to_glib_none_mut().0,
            drawing_area as *mut gobject_ffi::GObject,
        );

        gobject_ffi::g_value_set_boxed(args[1].to_glib_none_mut().0, cr);
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

pub fn get_draw_func_trampoline_ptr() -> *mut c_void {
    draw_func_trampoline as *mut c_void
}

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

pub fn get_destroy_trampoline_ptr() -> *mut c_void {
    destroy_trampoline as *mut c_void
}

unsafe extern "C" fn draw_func_data_destroy(user_data: *mut c_void) {
    let data_ptr = user_data as *mut DrawFuncData;

    if data_ptr.is_null() {
        return;
    }

    unsafe {
        let data = Box::from_raw(data_ptr);
        if !data.closure.is_null() {
            gobject_ffi::g_closure_unref(data.closure);
        }
    }
}

pub fn get_draw_func_data_destroy_ptr() -> *mut c_void {
    draw_func_data_destroy as *mut c_void
}

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

        let data = Box::new(DrawFuncData {
            closure: closure_ptr,
            arg_gtypes: vec![
                glib::types::Type::OBJECT,
                glib::types::Type::POINTER,
                glib::types::Type::I32,
                glib::types::Type::I32,
            ],
        });
        let data_ptr = Box::into_raw(data);

        unsafe {
            draw_func_trampoline(
                std::ptr::null_mut(),
                std::ptr::null_mut(),
                100,
                100,
                data_ptr as *mut c_void,
            );
        }

        assert!(invoked.load(Ordering::SeqCst));

        unsafe {
            draw_func_data_destroy(data_ptr as *mut c_void);
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
        assert!(!get_async_ready_trampoline_ptr().is_null());
    }
}

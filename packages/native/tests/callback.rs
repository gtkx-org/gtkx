mod common;

use std::ffi::c_void;
use std::ptr::NonNull;
use std::sync::{
    Arc,
    atomic::{AtomicBool, Ordering},
};

use gtk4::glib;
use gtk4::glib::translate::FromGlibPtrFull as _;
use gtk4::glib::value::ToValue as _;

use native::callback::{
    CallbackData, CallbackKind, get_async_ready_trampoline_ptr, get_callback_data_destroy_ptr,
    get_destroy_trampoline_ptr, get_draw_func_trampoline_ptr, get_shortcut_func_trampoline_ptr,
    get_tree_list_model_create_func_trampoline_ptr,
};

type DrawFuncTrampoline = unsafe extern "C" fn(
    *mut c_void,
    *mut c_void,
    i32,
    i32,
    *mut c_void,
);

type DestroyTrampoline = unsafe extern "C" fn(*mut c_void);

type AsyncReadyTrampoline = unsafe extern "C" fn(
    *mut glib::gobject_ffi::GObject,
    *mut gtk4::gio::ffi::GAsyncResult,
    *mut c_void,
);

type ShortcutFuncTrampoline = unsafe extern "C" fn(
    *mut glib::gobject_ffi::GObject,
    *mut glib::ffi::GVariant,
    *mut c_void,
) -> glib::ffi::gboolean;

type TreeListModelCreateFuncTrampoline = unsafe extern "C" fn(
    *mut glib::gobject_ffi::GObject,
    *mut c_void,
) -> *mut glib::gobject_ffi::GObject;

type CallbackDataDestroy = unsafe extern "C" fn(*mut c_void);

fn create_test_closure_with_flag(
    flag: Arc<AtomicBool>,
) -> NonNull<glib::gobject_ffi::GClosure> {
    common::ensure_gtk_init();

    let closure = glib::Closure::new(move |_| {
        flag.store(true, Ordering::SeqCst);
        None::<glib::Value>
    });

    use glib::translate::ToGlibPtr as _;
    let ptr: *mut glib::gobject_ffi::GClosure = closure.to_glib_full();
    std::mem::forget(closure);
    NonNull::new(ptr).expect("closure pointer should not be null")
}

#[test]
fn draw_func_trampoline_null_closure_safe() {
    common::ensure_gtk_init();

    let trampoline: DrawFuncTrampoline =
        unsafe { std::mem::transmute(get_draw_func_trampoline_ptr()) };

    unsafe {
        trampoline(
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

    let data = Box::new(CallbackData::new(
        closure_ptr,
        vec![
            glib::types::Type::OBJECT,
            glib::types::Type::POINTER,
            glib::types::Type::I32,
            glib::types::Type::I32,
        ],
        CallbackKind::DrawFunc,
    ));
    let data_ptr = Box::into_raw(data);

    let trampoline: DrawFuncTrampoline =
        unsafe { std::mem::transmute(get_draw_func_trampoline_ptr()) };

    unsafe {
        trampoline(
            std::ptr::null_mut(),
            std::ptr::null_mut(),
            100,
            100,
            data_ptr as *mut c_void,
        );
    }

    assert!(invoked.load(Ordering::SeqCst));

    let destroy: CallbackDataDestroy =
        unsafe { std::mem::transmute(get_callback_data_destroy_ptr()) };

    unsafe {
        destroy(data_ptr as *mut c_void);
    }
}

#[test]
fn destroy_trampoline_null_closure_safe() {
    common::ensure_gtk_init();

    let trampoline: DestroyTrampoline =
        unsafe { std::mem::transmute(get_destroy_trampoline_ptr()) };

    unsafe {
        trampoline(std::ptr::null_mut());
    }
}

#[test]
fn destroy_trampoline_invokes_and_unrefs() {
    let invoked = Arc::new(AtomicBool::new(false));
    let closure_ptr = create_test_closure_with_flag(invoked.clone());

    let trampoline: DestroyTrampoline =
        unsafe { std::mem::transmute(get_destroy_trampoline_ptr()) };

    unsafe {
        trampoline(closure_ptr.as_ptr() as *mut c_void);
    }

    assert!(invoked.load(Ordering::SeqCst));
}

#[test]
fn async_ready_trampoline_null_safe() {
    common::ensure_gtk_init();

    let trampoline: AsyncReadyTrampoline =
        unsafe { std::mem::transmute(get_async_ready_trampoline_ptr()) };

    unsafe {
        trampoline(
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
    assert!(!get_shortcut_func_trampoline_ptr().is_null());
    assert!(!get_callback_data_destroy_ptr().is_null());
    assert!(!get_tree_list_model_create_func_trampoline_ptr().is_null());
}

#[test]
fn shortcut_func_trampoline_null_safe() {
    common::ensure_gtk_init();

    let trampoline: ShortcutFuncTrampoline =
        unsafe { std::mem::transmute(get_shortcut_func_trampoline_ptr()) };

    unsafe {
        let result = trampoline(
            std::ptr::null_mut(),
            std::ptr::null_mut(),
            std::ptr::null_mut(),
        );
        assert_eq!(result, glib::ffi::GFALSE);
    }
}

fn create_bool_returning_closure(return_val: bool) -> NonNull<glib::gobject_ffi::GClosure> {
    common::ensure_gtk_init();

    let closure = glib::Closure::new(move |_| Some(return_val.to_value()));

    use glib::translate::ToGlibPtr as _;
    let ptr: *mut glib::gobject_ffi::GClosure = closure.to_glib_full();
    std::mem::forget(closure);
    NonNull::new(ptr).expect("closure pointer should not be null")
}

#[test]
fn shortcut_func_trampoline_invokes_closure_returns_true() {
    let closure_ptr = create_bool_returning_closure(true);

    let data = Box::new(CallbackData::new(
        closure_ptr,
        vec![glib::types::Type::OBJECT, glib::types::Type::VARIANT],
        CallbackKind::ShortcutFunc,
    ));
    let data_ptr = Box::into_raw(data);

    let trampoline: ShortcutFuncTrampoline =
        unsafe { std::mem::transmute(get_shortcut_func_trampoline_ptr()) };

    unsafe {
        let result = trampoline(
            std::ptr::null_mut(),
            std::ptr::null_mut(),
            data_ptr as *mut c_void,
        );
        assert_eq!(result, glib::ffi::GTRUE);

        let destroy: CallbackDataDestroy =
            std::mem::transmute(get_callback_data_destroy_ptr());
        destroy(data_ptr as *mut c_void);
    }
}

#[test]
fn shortcut_func_trampoline_invokes_closure_returns_false() {
    let closure_ptr = create_bool_returning_closure(false);

    let data = Box::new(CallbackData::new(
        closure_ptr,
        vec![glib::types::Type::OBJECT, glib::types::Type::VARIANT],
        CallbackKind::ShortcutFunc,
    ));
    let data_ptr = Box::into_raw(data);

    let trampoline: ShortcutFuncTrampoline =
        unsafe { std::mem::transmute(get_shortcut_func_trampoline_ptr()) };

    unsafe {
        let result = trampoline(
            std::ptr::null_mut(),
            std::ptr::null_mut(),
            data_ptr as *mut c_void,
        );
        assert_eq!(result, glib::ffi::GFALSE);

        let destroy: CallbackDataDestroy =
            std::mem::transmute(get_callback_data_destroy_ptr());
        destroy(data_ptr as *mut c_void);
    }
}

#[test]
fn callback_data_destroy_null_safe() {
    common::ensure_gtk_init();

    let destroy: CallbackDataDestroy =
        unsafe { std::mem::transmute(get_callback_data_destroy_ptr()) };

    unsafe {
        destroy(std::ptr::null_mut());
    }
}

#[test]
fn callback_data_destroy_unrefs_closure() {
    let invoked = Arc::new(AtomicBool::new(false));
    let closure_ptr = create_test_closure_with_flag(invoked.clone());

    let data = Box::new(CallbackData::new(closure_ptr, vec![], CallbackKind::ShortcutFunc));
    let data_ptr = Box::into_raw(data);

    let destroy: CallbackDataDestroy =
        unsafe { std::mem::transmute(get_callback_data_destroy_ptr()) };

    unsafe {
        destroy(data_ptr as *mut c_void);
    }
}

#[test]
fn tree_list_model_create_func_trampoline_null_safe() {
    common::ensure_gtk_init();

    let trampoline: TreeListModelCreateFuncTrampoline =
        unsafe { std::mem::transmute(get_tree_list_model_create_func_trampoline_ptr()) };

    unsafe {
        let result = trampoline(std::ptr::null_mut(), std::ptr::null_mut());
        assert!(result.is_null());
    }
}

fn create_object_returning_closure(
    return_object: bool,
) -> NonNull<glib::gobject_ffi::GClosure> {
    common::ensure_gtk_init();

    let closure = glib::Closure::new(move |_| {
        if return_object {
            let label: glib::Object = unsafe {
                let ptr = gtk4::ffi::gtk_label_new(std::ptr::null()) as *mut glib::gobject_ffi::GObject;
                glib::gobject_ffi::g_object_ref_sink(ptr);
                glib::Object::from_glib_full(ptr)
            };
            Some(label.to_value())
        } else {
            Some(None::<glib::Object>.to_value())
        }
    });

    use glib::translate::ToGlibPtr as _;
    let ptr: *mut glib::gobject_ffi::GClosure = closure.to_glib_full();
    std::mem::forget(closure);
    NonNull::new(ptr).expect("closure pointer should not be null")
}

#[test]
fn tree_list_model_create_func_trampoline_invokes_closure_returns_null() {
    let closure_ptr = create_object_returning_closure(false);

    let data = Box::new(CallbackData::new(
        closure_ptr,
        vec![glib::types::Type::OBJECT],
        CallbackKind::TreeListModelCreateFunc,
    ));
    let data_ptr = Box::into_raw(data);

    let trampoline: TreeListModelCreateFuncTrampoline =
        unsafe { std::mem::transmute(get_tree_list_model_create_func_trampoline_ptr()) };

    unsafe {
        let result = trampoline(
            std::ptr::null_mut(),
            data_ptr as *mut c_void,
        );
        assert!(result.is_null());

        let destroy: CallbackDataDestroy =
            std::mem::transmute(get_callback_data_destroy_ptr());
        destroy(data_ptr as *mut c_void);
    }
}

#[test]
fn tree_list_model_create_func_trampoline_invokes_closure_returns_object() {
    let closure_ptr = create_object_returning_closure(true);

    let data = Box::new(CallbackData::new(
        closure_ptr,
        vec![glib::types::Type::OBJECT],
        CallbackKind::TreeListModelCreateFunc,
    ));
    let data_ptr = Box::into_raw(data);

    let trampoline: TreeListModelCreateFuncTrampoline =
        unsafe { std::mem::transmute(get_tree_list_model_create_func_trampoline_ptr()) };

    unsafe {
        let result = trampoline(
            std::ptr::null_mut(),
            data_ptr as *mut c_void,
        );
        assert!(!result.is_null());

        glib::gobject_ffi::g_object_unref(result as *mut _);

        let destroy: CallbackDataDestroy =
            std::mem::transmute(get_callback_data_destroy_ptr());
        destroy(data_ptr as *mut c_void);
    }
}

#[test]
fn tree_list_model_create_func_data_destroy_unrefs_closure() {
    let invoked = Arc::new(AtomicBool::new(false));
    let closure_ptr = create_test_closure_with_flag(invoked.clone());

    let data = Box::new(CallbackData::new(
        closure_ptr,
        vec![],
        CallbackKind::TreeListModelCreateFunc,
    ));
    let data_ptr = Box::into_raw(data);

    let destroy: CallbackDataDestroy =
        unsafe { std::mem::transmute(get_callback_data_destroy_ptr()) };

    unsafe {
        destroy(data_ptr as *mut c_void);
    }
}

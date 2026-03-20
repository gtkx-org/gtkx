mod common;

use std::sync::{
    Arc,
    atomic::{AtomicBool, Ordering},
};

use gtk4::glib;
use gtk4::glib::translate::FromGlibPtrFull as _;

use native::callback::ClosureGuard;

fn create_test_closure_with_flag(
    flag: Arc<AtomicBool>,
) -> std::ptr::NonNull<glib::gobject_ffi::GClosure> {
    common::ensure_gtk_init();

    let closure = glib::Closure::new(move |_| {
        flag.store(true, Ordering::SeqCst);
        None::<glib::Value>
    });

    use glib::translate::ToGlibPtr as _;
    let ptr: *mut glib::gobject_ffi::GClosure = closure.to_glib_full();
    std::mem::forget(closure);
    std::ptr::NonNull::new(ptr).expect("closure pointer should not be null")
}

#[test]
fn closure_guard_refs_closure() {
    let closure_ptr = create_test_closure_with_flag(Arc::new(AtomicBool::new(false)));
    let initial_ref = common::get_closure_refcount(closure_ptr.as_ptr());

    let _guard = ClosureGuard::new(closure_ptr);

    let ref_after = common::get_closure_refcount(closure_ptr.as_ptr());
    assert_eq!(ref_after, initial_ref + 1);

    unsafe { glib::gobject_ffi::g_closure_unref(closure_ptr.as_ptr()) };
}

#[test]
fn closure_guard_unrefs_on_drop() {
    let closure_ptr = create_test_closure_with_flag(Arc::new(AtomicBool::new(false)));

    unsafe { glib::gobject_ffi::g_closure_ref(closure_ptr.as_ptr()) };
    let ref_with_extra = common::get_closure_refcount(closure_ptr.as_ptr());

    {
        let _guard = ClosureGuard::new(closure_ptr);
        assert_eq!(
            common::get_closure_refcount(closure_ptr.as_ptr()),
            ref_with_extra + 1
        );
    }

    assert_eq!(
        common::get_closure_refcount(closure_ptr.as_ptr()),
        ref_with_extra
    );

    unsafe {
        glib::gobject_ffi::g_closure_unref(closure_ptr.as_ptr());
        glib::gobject_ffi::g_closure_unref(closure_ptr.as_ptr());
    };
}

#[test]
fn closure_guard_from_ptr_with_valid_ptr() {
    let closure_ptr = create_test_closure_with_flag(Arc::new(AtomicBool::new(false)));
    let initial_ref = common::get_closure_refcount(closure_ptr.as_ptr());

    let guard = ClosureGuard::from_ptr(closure_ptr.as_ptr());

    assert!(guard.is_some());
    assert_eq!(
        common::get_closure_refcount(closure_ptr.as_ptr()),
        initial_ref + 1
    );

    drop(guard);
    assert_eq!(
        common::get_closure_refcount(closure_ptr.as_ptr()),
        initial_ref
    );

    unsafe { glib::gobject_ffi::g_closure_unref(closure_ptr.as_ptr()) };
}

#[test]
fn closure_guard_from_ptr_with_null_returns_none() {
    let guard = ClosureGuard::from_ptr(std::ptr::null_mut());
    assert!(guard.is_none());
}

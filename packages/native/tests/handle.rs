use test_support as helpers;

use std::ffi::c_void;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::thread;

use gtk4::glib;
use gtk4::prelude::ObjectType as _;

use native::handle::{Fundamental, Handle, Value};
use native::messaging::Mailbox;

use helpers::{
    get_gobject_refcount, make_bool_param_spec as param_spec_ptr, param_spec_ref,
    param_spec_refcount, param_spec_unref, pump_default_context_until,
};

fn owned_fundamental(ptr: *mut c_void) -> Handle {
    Value::Fundamental(Fundamental::from_glib_full(
        ptr,
        Some(param_spec_ref),
        Some(param_spec_unref),
    ))
    .into()
}

fn borrowed_fundamental(ptr: *mut c_void) -> Handle {
    let fundamental =
        unsafe { Fundamental::from_glib_none(ptr, Some(param_spec_ref), Some(param_spec_unref)) };
    Value::Fundamental(fundamental).into()
}

fn extra_referenced_decoded_gobject() -> (glib::Object, *mut glib::gobject_ffi::GObject, u32, Handle)
{
    let obj = glib::Object::new::<glib::Object>();
    let obj_ptr = obj.as_ptr();
    unsafe { glib::gobject_ffi::g_object_ref(obj_ptr) };
    let initial_ref = get_gobject_refcount(obj_ptr);

    let handle = Handle::decoded_gobject(obj_ptr as *mut c_void);
    (obj, obj_ptr, initial_ref, handle)
}

#[test]
fn from_native_value_boxed_records_pointer() {
    helpers::run(|| {
        let (boxed, ptr) = helpers::owned_rgba_boxed();

        let handle: Handle = Value::Boxed(boxed).into();

        assert_eq!(handle.as_ptr(), ptr);
    });
}

#[test]
fn from_native_value_fundamental_records_pointer() {
    let ptr = param_spec_ptr();

    let handle = owned_fundamental(ptr);

    assert_eq!(handle.as_ptr(), ptr);
}

#[test]
fn borrowed_handle_has_no_owned_value() {
    let raw = 0xABCD_1234usize as *mut c_void;
    let handle = Handle::from_glib_borrow(raw);

    assert_eq!(handle.as_ptr(), raw);
    assert_eq!(handle.ptr_as_usize(), raw as usize);

    let debug_str = format!("{handle:?}");
    assert!(debug_str.contains("Handle"));
    assert!(debug_str.contains("owned: false"));

    let moved = handle;
    assert_eq!(moved.as_ptr(), raw);
}

#[test]
fn borrowed_handle_with_null_pointer() {
    let handle = Handle::from_glib_borrow(std::ptr::null_mut());

    assert!(handle.as_ptr().is_null());
    assert_eq!(handle.ptr_as_usize(), 0);
}

#[test]
fn clone_owned_handle_preserves_pointer() {
    helpers::run(|| {
        let ptr = param_spec_ptr();
        let initial_ref = param_spec_refcount(ptr);

        let handle = owned_fundamental(ptr);
        let cloned = handle.clone();

        assert_eq!(cloned.as_ptr(), handle.as_ptr());
        assert_eq!(param_spec_refcount(ptr), initial_ref + 1);

        drop(cloned);
        assert_eq!(param_spec_refcount(ptr), initial_ref);
        drop(handle);
    });
}

#[test]
fn clone_borrowed_handle_preserves_pointer() {
    let raw = 0x5555_0000usize as *mut c_void;
    let handle = Handle::from_glib_borrow(raw);
    let cloned = handle.clone();

    assert_eq!(cloned.as_ptr(), handle.as_ptr());
    assert_eq!(cloned.ptr_as_usize(), handle.ptr_as_usize());
    assert_eq!(cloned.as_ptr(), raw);
}

#[test]
fn drop_owned_handle_on_creating_thread_releases_value() {
    helpers::run(|| {
        let ptr = param_spec_ptr();
        let handle = borrowed_fundamental(ptr);
        let initial_ref = param_spec_refcount(ptr);

        drop(handle);
        assert_eq!(param_spec_refcount(ptr), initial_ref - 1);

        unsafe { param_spec_unref(ptr) };
    });
}

#[test]
fn drop_borrowed_handle_is_noop() {
    let handle = Handle::from_glib_borrow(0x1111usize as *mut c_void);
    drop(handle);
}

#[test]
fn a_consumed_decoded_handle_drop_releases_nothing() {
    helpers::run(|| {
        let (_obj, obj_ptr, initial_ref, handle) = extra_referenced_decoded_gobject();
        assert!(handle.take_pending_gobject_ref());
        drop(handle);

        let sentinel = Arc::new(AtomicBool::new(false));
        let sentinel_in_idle = Arc::clone(&sentinel);
        glib::idle_add_once(move || sentinel_in_idle.store(true, Ordering::SeqCst));
        pump_default_context_until(|| sentinel.load(Ordering::SeqCst));

        assert!(sentinel.load(Ordering::SeqCst));
        assert_eq!(get_gobject_refcount(obj_ptr), initial_ref);

        unsafe { glib::gobject_ffi::g_object_unref(obj_ptr) };
        assert_eq!(get_gobject_refcount(obj_ptr), initial_ref - 1);
    });
}

#[test]
fn a_decoded_handle_drop_releases_unconsumed_pending_ref() {
    helpers::run(|| {
        let (_obj, obj_ptr, initial_ref, handle) = extra_referenced_decoded_gobject();
        drop(handle);

        pump_default_context_until(|| get_gobject_refcount(obj_ptr) == initial_ref - 1);

        assert_eq!(get_gobject_refcount(obj_ptr), initial_ref - 1);
    });
}

#[test]
fn a_drop_owned_handle_off_thread_routes_through_glib_idle() {
    helpers::run(|| {
        let ptr = param_spec_ptr();
        let handle = borrowed_fundamental(ptr);
        let initial_ref = param_spec_refcount(ptr);

        thread::spawn(move || {
            drop(handle);
        })
        .join()
        .expect("dropping handle off-thread should not panic");

        pump_default_context_until(|| param_spec_refcount(ptr) == initial_ref - 1);

        assert_eq!(param_spec_refcount(ptr), initial_ref - 1);
        unsafe { param_spec_unref(ptr) };
    });
}

#[test]
fn drop_owned_handle_off_thread_while_not_running_leaks_value() {
    helpers::run(|| {
        let ptr = param_spec_ptr();
        let handle = owned_fundamental(ptr);

        let mailbox = Mailbox::global();
        mailbox.mark_not_running();

        thread::spawn(move || {
            drop(handle);
        })
        .join()
        .expect("dropping handle while stopped should not panic");

        mailbox.reset_for_test();
        unsafe { param_spec_unref(ptr) };
    });
}

#[test]
fn take_pending_gobject_ref_consumes_marker_once() {
    helpers::run(|| {
        let obj = glib::Object::new::<glib::Object>();
        let handle = Handle::decoded_gobject(obj.as_ptr() as *mut c_void);

        assert!(handle.take_pending_gobject_ref());
        assert!(!handle.take_pending_gobject_ref());
    });
}

#[test]
fn take_pending_gobject_ref_without_marker_returns_false() {
    helpers::run(|| {
        let obj = glib::Object::new::<glib::Object>();
        let handle = Handle::from_glib_borrow(obj.as_ptr() as *mut c_void);

        assert!(!handle.take_pending_gobject_ref());
    });
}

#[test]
fn clones_share_pending_gobject_ref_marker() {
    helpers::run(|| {
        let obj = glib::Object::new::<glib::Object>();
        let handle = Handle::decoded_gobject(obj.as_ptr() as *mut c_void);
        let cloned = handle.clone();

        assert!(cloned.take_pending_gobject_ref());
        assert!(!handle.take_pending_gobject_ref());
    });
}

#[test]
fn size_hint_distinguishes_native_value_variants() {
    helpers::run(|| {
        let (boxed, _boxed_ptr) = helpers::owned_rgba_boxed();
        let boxed_hint = Value::Boxed(boxed).size_hint();

        let pspec = param_spec_ptr();
        let fundamental_hint = Value::Fundamental(Fundamental::from_glib_full(
            pspec,
            Some(param_spec_ref),
            Some(param_spec_unref),
        ))
        .size_hint();

        assert!(boxed_hint > 0);
        assert!(fundamental_hint > 0);
        assert_ne!(boxed_hint, fundamental_hint);
    });
}

#[test]
fn native_handle_caches_size_hint_at_construction() {
    let ptr = param_spec_ptr();
    let value = Value::Fundamental(Fundamental::from_glib_full(
        ptr,
        Some(param_spec_ref),
        Some(param_spec_unref),
    ));
    let expected = value.size_hint();
    let handle: Handle = value.into();

    assert_eq!(handle.size_hint(), expected);
}

#[test]
fn borrowed_native_handle_reports_zero_size_hint() {
    let handle = Handle::from_glib_borrow(0xDEAD_BEEFusize as *mut c_void);
    assert_eq!(handle.size_hint(), 0);
}

#[test]
fn decoded_gobject_handle_reports_nonzero_size_hint() {
    helpers::run(|| {
        let obj = glib::Object::new::<glib::Object>();
        let handle = Handle::decoded_gobject(obj.as_ptr() as *mut c_void);
        assert!(handle.size_hint() > 0);
        assert!(handle.take_pending_gobject_ref());
    });
}

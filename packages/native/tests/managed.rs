mod common;

use std::ffi::c_void;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::thread;

use gtk4::glib;
use gtk4::prelude::ObjectType as _;

use native::dispatch::Mailbox;
use native::managed::{Fundamental, NativeHandle, NativeValue};

use common::{get_gobject_refcount, param_spec_ref, param_spec_refcount, param_spec_unref};

fn pump_default_context_until(done: impl Fn() -> bool) {
    let context = glib::MainContext::default();
    for _ in 0..1000 {
        if done() {
            return;
        }
        if !context.iteration(false) {
            thread::yield_now();
        }
    }
}

fn param_spec_ptr() -> *mut c_void {
    common::ensure_gtk_init();
    // SAFETY: GTK is initialized above and the call runs on the test's GLib thread; the four
    // `c"..."` literals are valid NUL-terminated C strings and the flags are valid `GParamFlags`,
    // so `g_param_spec_boolean` returns a freshly owned (floating) GParamSpec.
    unsafe {
        let param = glib::gobject_ffi::g_param_spec_boolean(
            c"managed-test".as_ptr(),
            c"Managed".as_ptr(),
            c"A managed test parameter".as_ptr(),
            glib::ffi::GFALSE,
            glib::gobject_ffi::G_PARAM_READABLE,
        );
        param as *mut c_void
    }
}

fn owned_fundamental(ptr: *mut c_void) -> NativeHandle {
    NativeValue::Fundamental(Fundamental::from_glib_full(
        ptr,
        Some(param_spec_ref),
        Some(param_spec_unref),
    ))
    .into()
}

fn borrowed_fundamental(ptr: *mut c_void) -> NativeHandle {
    // SAFETY: `ptr` is a live GParamSpec, and `param_spec_ref`/`param_spec_unref` are its matching
    // ref/unref functions; `from_glib_none` takes one new borrowed reference balanced by drop.
    let fundamental =
        unsafe { Fundamental::from_glib_none(ptr, Some(param_spec_ref), Some(param_spec_unref)) };
    NativeValue::Fundamental(fundamental).into()
}

fn extra_referenced_decoded_gobject() -> (
    glib::Object,
    *mut glib::gobject_ffi::GObject,
    u32,
    NativeHandle,
) {
    let obj = glib::Object::new::<glib::Object>();
    let obj_ptr = obj.as_ptr();
    // SAFETY: `obj_ptr` is the live pointer of the `obj` binding kept alive for the test; adding
    // one extra strong reference is balanced by the explicit `g_object_unref` each caller performs.
    unsafe { glib::gobject_ffi::g_object_ref(obj_ptr) };
    let initial_ref = get_gobject_refcount(obj_ptr);

    let handle = NativeHandle::decoded_gobject(obj_ptr as *mut c_void);
    (obj, obj_ptr, initial_ref, handle)
}

#[test]
fn borrowed_gobject_handle_records_pointer() {
    common::run(|| {
        let obj = glib::Object::new::<glib::Object>();
        let expected = obj.as_ptr() as usize;

        let handle = NativeHandle::borrowed_gobject(obj.as_ptr() as *mut c_void);

        assert_eq!(handle.ptr_as_usize(), expected);
    });
}

#[test]
fn from_native_value_boxed_records_pointer() {
    common::run(|| {
        let (boxed, ptr) = common::owned_rgba_boxed();

        let handle: NativeHandle = NativeValue::Boxed(boxed).into();

        assert_eq!(handle.ptr(), ptr);
    });
}

#[test]
fn from_native_value_fundamental_records_pointer() {
    let ptr = param_spec_ptr();

    let handle = owned_fundamental(ptr);

    assert_eq!(handle.ptr(), ptr);
}

#[test]
fn borrowed_handle_has_no_owned_value() {
    let raw = 0xABCD_1234usize as *mut c_void;
    let handle = NativeHandle::borrowed(raw);

    assert_eq!(handle.ptr(), raw);
    assert_eq!(handle.ptr_as_usize(), raw as usize);

    let debug_str = format!("{handle:?}");
    assert!(debug_str.contains("NativeHandle"));
    assert!(debug_str.contains("owned: false"));
}

#[test]
fn borrowed_handle_with_null_pointer() {
    let handle = NativeHandle::borrowed(std::ptr::null_mut());

    assert!(handle.ptr().is_null());
    assert_eq!(handle.ptr_as_usize(), 0);
}

#[test]
fn clone_owned_handle_preserves_pointer() {
    common::run(|| {
        let ptr = param_spec_ptr();
        let initial_ref = param_spec_refcount(ptr);

        let handle = owned_fundamental(ptr);
        let cloned = handle.clone();

        assert_eq!(cloned.ptr(), handle.ptr());
        assert_eq!(param_spec_refcount(ptr), initial_ref + 1);

        drop(cloned);
        assert_eq!(param_spec_refcount(ptr), initial_ref);
        drop(handle);
    });
}

#[test]
fn clone_borrowed_handle_preserves_pointer() {
    let raw = 0x5555_0000usize as *mut c_void;
    let handle = NativeHandle::borrowed(raw);
    let cloned = handle.clone();

    assert_eq!(cloned.ptr(), handle.ptr());
    assert_eq!(cloned.ptr_as_usize(), handle.ptr_as_usize());
    assert_eq!(cloned.ptr(), raw);
}

#[test]
fn drop_owned_handle_on_creating_thread_releases_value() {
    common::run(|| {
        let ptr = param_spec_ptr();
        let handle = borrowed_fundamental(ptr);
        let initial_ref = param_spec_refcount(ptr);

        drop(handle);
        assert_eq!(param_spec_refcount(ptr), initial_ref - 1);

        // SAFETY: `ptr` is the still-live GParamSpec; this releases the one remaining reference
        // created by `param_spec_ptr`, balancing its initial floating reference.
        unsafe { param_spec_unref(ptr) };
    });
}

#[test]
fn drop_borrowed_handle_is_noop() {
    let handle = NativeHandle::borrowed(0x1111usize as *mut c_void);
    drop(handle);
}

#[test]
fn a_consumed_decoded_handle_drop_releases_nothing() {
    let _guard = common::serial_guard();
    let (_obj, obj_ptr, initial_ref, handle) = extra_referenced_decoded_gobject();
    assert!(handle.take_pending_gobject_ref());
    drop(handle);

    let sentinel = Arc::new(AtomicBool::new(false));
    let sentinel_in_idle = Arc::clone(&sentinel);
    glib::idle_add_once(move || sentinel_in_idle.store(true, Ordering::SeqCst));
    pump_default_context_until(|| sentinel.load(Ordering::SeqCst));

    assert!(sentinel.load(Ordering::SeqCst));
    assert_eq!(get_gobject_refcount(obj_ptr), initial_ref);

    // SAFETY: `obj_ptr` is still alive (the `_obj` binding plus the extra reference taken in
    // `extra_referenced_decoded_gobject`); this releases that one extra reference.
    unsafe { glib::gobject_ffi::g_object_unref(obj_ptr) };
    assert_eq!(get_gobject_refcount(obj_ptr), initial_ref - 1);
}

#[test]
fn a_decoded_handle_drop_releases_unconsumed_pending_ref() {
    let _guard = common::serial_guard();
    let (_obj, obj_ptr, initial_ref, handle) = extra_referenced_decoded_gobject();
    drop(handle);

    pump_default_context_until(|| get_gobject_refcount(obj_ptr) == initial_ref - 1);

    assert_eq!(get_gobject_refcount(obj_ptr), initial_ref - 1);
}

#[test]
fn a_drop_owned_handle_off_thread_routes_through_glib_idle() {
    common::run(|| {
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
        // SAFETY: `ptr` is the still-live GParamSpec; this releases its remaining reference.
        unsafe { param_spec_unref(ptr) };
    });
}

#[test]
fn drop_owned_handle_off_thread_while_not_running_leaks_value() {
    common::run(|| {
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
        // SAFETY: the mailbox was stopped so the off-thread drop leaked the owned reference; `ptr`
        // is still live, and this releases that leaked reference to balance the count.
        unsafe { param_spec_unref(ptr) };
    });
}

#[test]
fn take_pending_gobject_ref_consumes_marker_once() {
    common::run(|| {
        let obj = glib::Object::new::<glib::Object>();
        let handle = NativeHandle::decoded_gobject(obj.as_ptr() as *mut c_void);

        assert!(handle.take_pending_gobject_ref());
        assert!(!handle.take_pending_gobject_ref());
    });
}

#[test]
fn take_pending_gobject_ref_without_marker_returns_false() {
    common::run(|| {
        let obj = glib::Object::new::<glib::Object>();
        let handle = NativeHandle::borrowed_gobject(obj.as_ptr() as *mut c_void);

        assert!(!handle.take_pending_gobject_ref());
    });
}

#[test]
fn clones_share_pending_gobject_ref_marker() {
    common::run(|| {
        let obj = glib::Object::new::<glib::Object>();
        let handle = NativeHandle::decoded_gobject(obj.as_ptr() as *mut c_void);
        let cloned = handle.clone();

        assert!(cloned.take_pending_gobject_ref());
        assert!(!handle.take_pending_gobject_ref());
    });
}

#[test]
fn size_hint_distinguishes_native_value_variants() {
    common::run(|| {
        let (boxed, _boxed_ptr) = common::owned_rgba_boxed();
        let boxed_hint = NativeValue::Boxed(boxed).size_hint();

        let pspec = param_spec_ptr();
        let fundamental_hint = NativeValue::Fundamental(Fundamental::from_glib_full(
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
    let value = NativeValue::Fundamental(Fundamental::from_glib_full(
        ptr,
        Some(param_spec_ref),
        Some(param_spec_unref),
    ));
    let expected = value.size_hint();
    let handle: NativeHandle = value.into();

    assert_eq!(handle.size_hint(), expected);
}

#[test]
fn borrowed_native_handle_reports_zero_size_hint() {
    let handle = NativeHandle::borrowed(0xDEAD_BEEFusize as *mut c_void);
    assert_eq!(handle.size_hint(), 0);
}

#[test]
fn borrowed_gobject_handle_reports_nonzero_size_hint() {
    common::run(|| {
        let obj = glib::Object::new::<glib::Object>();
        let handle = NativeHandle::borrowed_gobject(obj.as_ptr() as *mut c_void);
        assert!(handle.size_hint() > 0);
    });
}

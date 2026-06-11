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

/// Pumps the global default `MainContext` until `done` reports true, bounded
/// so a missing dispatch leaves the calling test's assertions to fail.
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
    // SAFETY: Creating a GParamSpec from static NUL-terminated literals has no pointer preconditions.
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

/// Wraps `ptr` in a handle that takes its own reference (transfer-none), so the
/// caller's reference keeps the value alive past the handle's drop and the
/// post-drop refcount can be read safely.
fn borrowed_fundamental(ptr: *mut c_void) -> NativeHandle {
    let fundamental =
        // SAFETY: The pointer addresses a live GParamSpec created by this test.
        unsafe { Fundamental::from_glib_none(ptr, Some(param_spec_ref), Some(param_spec_unref)) };
    NativeValue::Fundamental(fundamental).into()
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
fn debug_format_marks_owned_handle() {
    let ptr = param_spec_ptr();
    let handle = owned_fundamental(ptr);

    let debug_str = format!("{handle:?}");
    assert!(debug_str.contains("NativeHandle"));
    assert!(debug_str.contains("owned: true"));
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

        // SAFETY: Releases a reference this test owns on the live GParamSpec.
        unsafe { param_spec_unref(ptr) };
    });
}

#[test]
fn drop_borrowed_handle_is_noop() {
    let handle = NativeHandle::borrowed(0x1111usize as *mut c_void);
    drop(handle);
}

/// Named with a leading `a_` so libtest's alphabetical ordering runs it before
/// `a_drop_owned_handle_off_thread_routes_through_glib_idle` and therefore
/// before any test that initializes GTK: `gtk4::init` permanently acquires the
/// global default `MainContext` for its calling thread, after which no other
/// test thread can dispatch sources attached to that context. Holding the
/// serial guard directly keeps GTK uninitialized, leaving the context unowned
/// so this test's thread can dispatch the sentinel idle source that proves no
/// release was queued for the consumed pending reference.
#[test]
fn a_consumed_decoded_handle_drop_releases_nothing() {
    let _guard = common::serial_guard();
    let obj = glib::Object::new::<glib::Object>();
    let obj_ptr = obj.as_ptr();
    // SAFETY: Takes the decode protocol's pending reference on the live GObject.
    unsafe { glib::gobject_ffi::g_object_ref(obj_ptr) };
    let initial_ref = get_gobject_refcount(obj_ptr);

    let handle = NativeHandle::decoded_gobject(obj_ptr as *mut c_void);
    assert!(handle.take_pending_gobject_ref());
    drop(handle);

    let sentinel = Arc::new(AtomicBool::new(false));
    let sentinel_in_idle = Arc::clone(&sentinel);
    glib::idle_add_once(move || sentinel_in_idle.store(true, Ordering::SeqCst));
    pump_default_context_until(|| sentinel.load(Ordering::SeqCst));

    assert!(sentinel.load(Ordering::SeqCst));
    assert_eq!(get_gobject_refcount(obj_ptr), initial_ref);

    // SAFETY: Releases the pending reference this test consumed by winning
    // take_pending_gobject_ref on the live GObject.
    unsafe { glib::gobject_ffi::g_object_unref(obj_ptr) };
    assert_eq!(get_gobject_refcount(obj_ptr), initial_ref - 1);
}

/// Named with a leading `a_` so libtest's alphabetical ordering runs it before
/// `a_drop_owned_handle_off_thread_routes_through_glib_idle` and therefore
/// before any test that initializes GTK: `gtk4::init` permanently acquires the
/// global default `MainContext` for its calling thread, after which no other
/// test thread can dispatch sources attached to that context. Holding the
/// serial guard directly keeps GTK uninitialized, leaving the context unowned
/// so this test's thread can dispatch the idle source through which the drop
/// releases the unconsumed pending reference.
#[test]
fn a_decoded_handle_drop_releases_unconsumed_pending_ref() {
    let _guard = common::serial_guard();
    let obj = glib::Object::new::<glib::Object>();
    let obj_ptr = obj.as_ptr();
    // SAFETY: Takes the decode protocol's pending reference on the live GObject.
    unsafe { glib::gobject_ffi::g_object_ref(obj_ptr) };
    let initial_ref = get_gobject_refcount(obj_ptr);

    let handle = NativeHandle::decoded_gobject(obj_ptr as *mut c_void);
    drop(handle);

    pump_default_context_until(|| get_gobject_refcount(obj_ptr) == initial_ref - 1);

    assert_eq!(get_gobject_refcount(obj_ptr), initial_ref - 1);
}

/// Named with a leading `a_` so libtest's alphabetical ordering makes it the
/// first test to initialize GTK (the decoded-handle tests sorting before it
/// hold the serial guard without touching GTK): `gtk4::init` acquires the
/// global default `MainContext` for whichever thread calls it first, and the
/// `idle_add_once` source the off-thread drop posts can only be dispatched
/// from that same thread's main context.
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
        // SAFETY: Releases a reference this test owns on the live GParamSpec.
        unsafe { param_spec_unref(ptr) };
    });
}

#[test]
fn drop_owned_handle_off_thread_while_stopped_leaks_value() {
    common::run(|| {
        let ptr = param_spec_ptr();
        let handle = owned_fundamental(ptr);

        let mailbox = Mailbox::global();
        mailbox.mark_stopped();

        thread::spawn(move || {
            drop(handle);
        })
        .join()
        .expect("dropping handle while stopped should not panic");

        mailbox.reset_for_test();
        // SAFETY: Releases a reference this test owns on the live GParamSpec.
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
fn native_value_debug_and_clone() {
    let ptr = param_spec_ptr();
    let value = NativeValue::Fundamental(Fundamental::from_glib_full(
        ptr,
        Some(param_spec_ref),
        Some(param_spec_unref),
    ));

    let cloned = value.clone();
    assert_eq!(format!("{value:?}"), format!("{cloned:?}"));
    assert!(format!("{cloned:?}").contains("Fundamental"));
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

mod common;

use std::ffi::c_void;
use std::thread;

use gtk4::gdk;
use gtk4::glib;
use gtk4::prelude::{ObjectType as _, StaticType as _};

use native::dispatch::Mailbox;
use native::managed::{Boxed, Fundamental, NativeHandle, NativeValue};

use common::{param_spec_ref, param_spec_unref};

fn param_spec_ptr() -> *mut c_void {
    common::ensure_gtk_init();
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

#[test]
fn from_native_value_gobject_records_pointer() {
    common::run(|| {
        let obj = glib::Object::new::<glib::Object>();
        let expected = obj.as_ptr() as usize;

        let handle: NativeHandle = NativeValue::GObject(obj).into();

        assert_eq!(handle.ptr_as_usize(), expected);
    });
}

#[test]
fn from_native_value_boxed_records_pointer() {
    common::run(|| {
        let gtype = gdk::RGBA::static_type();
        let ptr = common::allocate_test_boxed(gtype);
        let boxed = Boxed::from_glib_full(Some(gtype), ptr);

        let handle: NativeHandle = NativeValue::Boxed(boxed).into();

        assert_eq!(handle.ptr(), ptr);
    });
}

#[test]
fn from_native_value_fundamental_records_pointer() {
    let ptr = param_spec_ptr();

    let fundamental =
        Fundamental::from_glib_full(ptr, Some(param_spec_ref), Some(param_spec_unref));
    let handle: NativeHandle = NativeValue::Fundamental(fundamental).into();

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
    common::run(|| {
        let obj = glib::Object::new::<glib::Object>();
        let handle: NativeHandle = NativeValue::GObject(obj).into();

        let debug_str = format!("{handle:?}");
        assert!(debug_str.contains("NativeHandle"));
        assert!(debug_str.contains("owned: true"));
    });
}

#[test]
fn clone_owned_gobject_handle_preserves_pointer() {
    common::run(|| {
        let obj = glib::Object::new::<glib::Object>();
        let ptr = obj.as_ptr();
        let initial_ref = common::get_gobject_refcount(ptr);

        let handle: NativeHandle = NativeValue::GObject(obj).into();
        let cloned = handle.clone();

        assert_eq!(cloned.ptr(), handle.ptr());
        assert_eq!(common::get_gobject_refcount(ptr), initial_ref + 1);

        drop(cloned);
        assert_eq!(common::get_gobject_refcount(ptr), initial_ref);
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
        let obj = glib::Object::new::<glib::Object>();
        let ptr = obj.as_ptr();
        let initial_ref = common::get_gobject_refcount(ptr);

        let handle: NativeHandle = NativeValue::GObject(obj.clone()).into();
        assert_eq!(common::get_gobject_refcount(ptr), initial_ref + 1);

        drop(handle);
        assert_eq!(common::get_gobject_refcount(ptr), initial_ref);
        drop(obj);
    });
}

#[test]
fn drop_borrowed_handle_is_noop() {
    let handle = NativeHandle::borrowed(0x1111usize as *mut c_void);
    drop(handle);
}

/// Named with a leading `a_` so libtest's alphabetical ordering runs it first:
/// `gtk4::init` acquires the global default `MainContext` for whichever thread
/// calls it first, and the `idle_add_once` source the off-thread drop posts can
/// only be dispatched from that same thread's main context.
#[test]
fn a_drop_owned_handle_off_thread_routes_through_glib_idle() {
    common::run(|| {
        let obj = glib::Object::new::<glib::Object>();
        let ptr = obj.as_ptr();
        let initial_ref = common::get_gobject_refcount(ptr);

        let handle: NativeHandle = NativeValue::GObject(obj.clone()).into();
        assert_eq!(common::get_gobject_refcount(ptr), initial_ref + 1);

        thread::spawn(move || {
            drop(handle);
        })
        .join()
        .expect("dropping handle off-thread should not panic");

        let context = glib::MainContext::default();
        for _ in 0..1000 {
            if common::get_gobject_refcount(ptr) == initial_ref {
                break;
            }
            if !context.iteration(false) {
                thread::yield_now();
            }
        }

        assert_eq!(common::get_gobject_refcount(ptr), initial_ref);
        drop(obj);
    });
}

#[test]
fn drop_owned_handle_off_thread_while_stopped_leaks_value() {
    common::run(|| {
        let obj = glib::Object::new::<glib::Object>();
        let handle: NativeHandle = NativeValue::GObject(obj).into();

        let mailbox = Mailbox::global();
        mailbox.mark_stopped();

        thread::spawn(move || {
            drop(handle);
        })
        .join()
        .expect("dropping handle while stopped should not panic");

        mailbox.reset_for_test();
    });
}

#[test]
fn native_value_debug_and_clone() {
    common::run(|| {
        let obj = glib::Object::new::<glib::Object>();
        let value = NativeValue::GObject(obj);

        let cloned = value.clone();
        assert_eq!(format!("{value:?}"), format!("{cloned:?}"));
        assert!(format!("{cloned:?}").contains("GObject"));
    });
}

#[test]
fn size_hint_distinguishes_native_value_variants() {
    common::run(|| {
        let obj = glib::Object::new::<glib::Object>();
        let gobject_hint = NativeValue::GObject(obj).size_hint();

        let gtype = gdk::RGBA::static_type();
        let boxed_ptr = common::allocate_test_boxed(gtype);
        let boxed_hint =
            NativeValue::Boxed(Boxed::from_glib_full(Some(gtype), boxed_ptr)).size_hint();

        let pspec = param_spec_ptr();
        let fundamental_hint = NativeValue::Fundamental(Fundamental::from_glib_full(
            pspec,
            Some(param_spec_ref),
            Some(param_spec_unref),
        ))
        .size_hint();

        assert!(gobject_hint > 0);
        assert!(boxed_hint > 0);
        assert!(fundamental_hint > 0);
        assert_ne!(gobject_hint, boxed_hint);
        assert_ne!(boxed_hint, fundamental_hint);
        assert_ne!(gobject_hint, fundamental_hint);
    });
}

#[test]
fn native_handle_caches_size_hint_at_construction() {
    common::run(|| {
        let obj = glib::Object::new::<glib::Object>();
        let value = NativeValue::GObject(obj);
        let expected = value.size_hint();
        let handle: NativeHandle = value.into();

        assert_eq!(handle.size_hint(), expected);

        let cloned = handle.clone();
        assert_eq!(cloned.size_hint(), expected);
    });
}

#[test]
fn borrowed_native_handle_reports_zero_size_hint() {
    let handle = NativeHandle::borrowed(0xDEAD_BEEFusize as *mut c_void);
    assert_eq!(handle.size_hint(), 0);
}

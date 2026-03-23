mod common;

use std::ffi::c_void;

use gtk4::gdk;
use gtk4::glib;
use gtk4::prelude::{ObjectType as _, StaticType as _};

use native::Boxed;
use native::managed::{NativeHandle, NativeValue};
use native::state::GtkThreadState;

fn create_test_gobject() -> glib::Object {
    common::ensure_gtk_init();
    glib::Object::new::<glib::Object>()
}

#[test]
fn handle_from_registers_in_map() {
    let obj = create_test_gobject();
    let object = NativeValue::GObject(obj);
    let handle: NativeHandle = object.into();

    assert!(handle.inner() > 0);

    GtkThreadState::with(|state| {
        assert!(state.handles.get(handle.inner()).is_some());
    });
}

#[test]
fn handle_get_ptr_returns_correct_pointer() {
    let obj = create_test_gobject();
    let expected_ptr = obj.as_ptr() as *mut c_void;
    let object = NativeValue::GObject(obj);
    let handle: NativeHandle = object.into();

    let ptr = handle.get_ptr();
    assert_eq!(ptr, Some(expected_ptr));
}

#[test]
fn handle_get_ptr_returns_none_after_removal() {
    let obj = create_test_gobject();
    let object = NativeValue::GObject(obj);
    let handle: NativeHandle = object.into();

    GtkThreadState::with(|state| {
        state.handles.remove(handle.inner());
    });

    assert_eq!(handle.get_ptr(), None);
}

#[test]
fn handle_get_ptr_as_usize_returns_usize() {
    let obj = create_test_gobject();
    let expected_ptr = obj.as_ptr() as usize;
    let object = NativeValue::GObject(obj);
    let handle: NativeHandle = object.into();

    let ptr = handle.get_ptr_as_usize();
    assert_eq!(ptr, Some(expected_ptr));
}

#[test]
fn handle_increments_sequentially() {
    let obj1 = create_test_gobject();
    let obj2 = create_test_gobject();

    let handle1: NativeHandle = NativeValue::GObject(obj1).into();
    let handle2: NativeHandle = NativeValue::GObject(obj2).into();

    assert!(handle2.inner() > handle1.inner());
}

#[test]
fn boxed_handle_stores_and_retrieves() {
    common::ensure_gtk_init();

    let gtype = gdk::RGBA::static_type();
    let ptr = common::allocate_test_boxed(gtype);
    let boxed = Boxed::from_glib_full(Some(gtype), ptr);
    let object = NativeValue::Boxed(boxed);
    let handle: NativeHandle = object.into();

    let retrieved_ptr = handle.get_ptr();
    assert_eq!(retrieved_ptr, Some(ptr));
}

#[test]
fn object_gobject_clone_shares_reference() {
    let obj = create_test_gobject();
    let object = NativeValue::GObject(obj.clone());
    let cloned = object.clone();

    let ptr1 = match &object {
        NativeValue::GObject(o) => o.as_ptr(),
        _ => panic!("Expected GObject"),
    };

    let ptr2 = match &cloned {
        NativeValue::GObject(o) => o.as_ptr(),
        _ => panic!("Expected GObject"),
    };

    assert_eq!(ptr1, ptr2);
}

#[test]
fn object_boxed_clone_creates_copy() {
    common::ensure_gtk_init();

    let gtype = gdk::RGBA::static_type();
    let ptr = common::allocate_test_boxed(gtype);
    let boxed = Boxed::from_glib_full(Some(gtype), ptr);
    let object = NativeValue::Boxed(boxed);
    let cloned = object.clone();

    let ptr1 = match &object {
        NativeValue::Boxed(b) => b.as_ptr(),
        _ => panic!("Expected Boxed"),
    };

    let ptr2 = match &cloned {
        NativeValue::Boxed(b) => b.as_ptr(),
        _ => panic!("Expected Boxed"),
    };

    assert_ne!(ptr1, ptr2);
}

#[test]
fn gobject_refcount_preserved_in_map() {
    let obj = create_test_gobject();
    let initial_ref = unsafe {
        let ptr = obj.as_ptr();
        (*ptr).ref_count
    };

    let _handle: NativeHandle = NativeValue::GObject(obj.clone()).into();

    let after_ref = unsafe {
        let ptr = obj.as_ptr();
        (*ptr).ref_count
    };

    assert!(after_ref >= initial_ref);
}

#[test]
fn multiple_handles_independent() {
    let obj1 = create_test_gobject();
    let obj2 = create_test_gobject();

    let handle1: NativeHandle = NativeValue::GObject(obj1.clone()).into();
    let handle2: NativeHandle = NativeValue::GObject(obj2.clone()).into();

    GtkThreadState::with(|state| {
        state.handles.remove(handle1.inner());
    });

    assert_eq!(handle1.get_ptr(), None);
    assert!(handle2.get_ptr().is_some());
}

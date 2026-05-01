mod common;

use std::ffi::c_void;

use gtk4::gdk;
use gtk4::glib;
use gtk4::prelude::{ObjectType as _, StaticType as _};

use native::Boxed;
use native::managed::{NativeHandle, NativeValue};

fn create_test_gobject() -> glib::Object {
    common::ensure_gtk_init();
    glib::Object::new::<glib::Object>()
}

#[test]
fn handle_carries_object_pointer() {
    let obj = create_test_gobject();
    let expected_ptr = obj.as_ptr() as usize;
    let object = NativeValue::GObject(obj);
    let handle: NativeHandle = object.into();

    assert_eq!(handle.ptr_as_usize(), expected_ptr);
    assert!(handle.ptr_as_usize() != 0);
}

#[test]
fn handle_ptr_returns_correct_pointer() {
    let obj = create_test_gobject();
    let expected_ptr = obj.as_ptr() as *mut c_void;
    let object = NativeValue::GObject(obj);
    let handle: NativeHandle = object.into();

    assert_eq!(handle.ptr(), expected_ptr);
}

#[test]
fn handle_ptr_as_usize_returns_usize() {
    let obj = create_test_gobject();
    let expected_ptr = obj.as_ptr() as usize;
    let object = NativeValue::GObject(obj);
    let handle: NativeHandle = object.into();

    assert_eq!(handle.ptr_as_usize(), expected_ptr);
}

#[test]
fn handles_for_distinct_objects_have_distinct_pointers() {
    let obj1 = create_test_gobject();
    let obj2 = create_test_gobject();

    let handle1: NativeHandle = NativeValue::GObject(obj1).into();
    let handle2: NativeHandle = NativeValue::GObject(obj2).into();

    assert_ne!(handle1.ptr_as_usize(), handle2.ptr_as_usize());
}

#[test]
fn boxed_handle_stores_and_retrieves() {
    common::ensure_gtk_init();

    let gtype = gdk::RGBA::static_type();
    let ptr = common::allocate_test_boxed(gtype);
    let boxed = Boxed::from_glib_full(Some(gtype), ptr);
    let object = NativeValue::Boxed(boxed);
    let handle: NativeHandle = object.into();

    assert_eq!(handle.ptr(), ptr);
}

#[test]
fn borrowed_handle_carries_pointer_without_ownership() {
    let raw = 0x1234_5678usize as *mut c_void;
    let handle = NativeHandle::borrowed(raw);

    assert_eq!(handle.ptr(), raw);
    assert_eq!(handle.ptr_as_usize(), raw as usize);
    let cloned = handle;
    assert_eq!(cloned.ptr(), raw);
}

#[test]
fn object_gobject_clone_shares_reference() {
    let obj = create_test_gobject();
    let object = NativeValue::GObject(obj);
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
fn gobject_refcount_preserved_when_handle_owns() {
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

mod helpers {
    pub use test_support::*;
}

use std::ffi::c_void;

use gtk4::glib;
use gtk4::prelude::ObjectType as _;

use native::handle::{Handle, Value};

fn create_test_gobject() -> glib::Object {
    helpers::ensure_glib_init();
    glib::Object::new::<glib::Object>()
}

#[test]
fn gobject_handle_carries_object_pointer() {
    let obj = create_test_gobject();
    let expected_ptr = obj.as_ptr() as usize;
    let handle = Handle::borrowed_gobject(obj.as_ptr() as *mut c_void);

    assert_eq!(handle.ptr_as_usize(), expected_ptr);
    assert!(handle.ptr_as_usize() != 0);
}

#[test]
fn gobject_handle_ptr_returns_correct_pointer() {
    let obj = create_test_gobject();
    let expected_ptr = obj.as_ptr() as *mut c_void;
    let handle = Handle::borrowed_gobject(obj.as_ptr() as *mut c_void);

    assert_eq!(handle.ptr(), expected_ptr);
}

#[test]
fn gobject_handles_for_distinct_objects_have_distinct_pointers() {
    let obj1 = create_test_gobject();
    let obj2 = create_test_gobject();

    let handle1 = Handle::borrowed_gobject(obj1.as_ptr() as *mut c_void);
    let handle2 = Handle::borrowed_gobject(obj2.as_ptr() as *mut c_void);

    assert_ne!(handle1.ptr_as_usize(), handle2.ptr_as_usize());
}

#[test]
fn gobject_handle_does_not_own_a_reference() {
    let obj = create_test_gobject();
    let ptr = obj.as_ptr();
    let initial_ref = helpers::get_gobject_refcount(ptr);

    let handle = Handle::borrowed_gobject(ptr as *mut c_void);
    assert_eq!(helpers::get_gobject_refcount(ptr), initial_ref);

    drop(handle);
    assert_eq!(helpers::get_gobject_refcount(ptr), initial_ref);
    drop(obj);
}

#[test]
fn gobject_handle_reports_nonzero_size_hint() {
    let obj = create_test_gobject();
    let handle = Handle::borrowed_gobject(obj.as_ptr() as *mut c_void);

    assert!(handle.size_hint() > 0);
}

#[test]
fn borrowed_handle_carries_pointer_without_ownership() {
    let raw = 0x1234_5678usize as *mut c_void;
    let handle = Handle::borrowed(raw);

    assert_eq!(handle.ptr(), raw);
    assert_eq!(handle.ptr_as_usize(), raw as usize);
    let cloned = handle;
    assert_eq!(cloned.ptr(), raw);
}

#[test]
fn object_boxed_clone_creates_copy() {
    helpers::run(|| {
        let (boxed, _ptr) = helpers::owned_rgba_boxed();
        let object = Value::Boxed(boxed);
        let cloned = object.clone();

        let ptr1 = match &object {
            Value::Boxed(b) => b.as_ptr(),
            Value::Fundamental(_) => panic!("Expected Boxed"),
        };

        let ptr2 = match &cloned {
            Value::Boxed(b) => b.as_ptr(),
            Value::Fundamental(_) => panic!("Expected Boxed"),
        };

        assert_ne!(ptr1, ptr2);
    });
}

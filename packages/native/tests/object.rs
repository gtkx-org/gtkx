use std::ffi::c_void;

use gtk4::glib;
use gtk4::prelude::ObjectType as _;
use native::handle::Handle;
use test_support as helpers;

fn create_test_gobject() -> glib::Object {
    glib::Object::new::<glib::Object>()
}

#[test]
fn gobject_handle_carries_object_pointer() {
    let obj = create_test_gobject();
    let expected_ptr = obj.as_ptr() as usize;
    let handle = Handle::from_glib_borrow(obj.as_ptr().cast::<c_void>());

    assert_eq!(handle.ptr_as_usize(), expected_ptr);
    assert!(handle.ptr_as_usize() != 0);
    assert_eq!(handle.as_ptr(), obj.as_ptr().cast::<c_void>());
}

#[test]
fn gobject_handles_for_distinct_objects_have_distinct_pointers() {
    let obj1 = create_test_gobject();
    let obj2 = create_test_gobject();

    let handle1 = Handle::from_glib_borrow(obj1.as_ptr().cast::<c_void>());
    let handle2 = Handle::from_glib_borrow(obj2.as_ptr().cast::<c_void>());

    assert_ne!(handle1.ptr_as_usize(), handle2.ptr_as_usize());
}

#[test]
fn gobject_handle_does_not_own_a_reference() {
    let obj = create_test_gobject();
    let ptr = obj.as_ptr();
    let initial_ref = unsafe { helpers::get_gobject_refcount(ptr) };

    let handle = Handle::from_glib_borrow(ptr.cast::<c_void>());
    assert_eq!(unsafe { helpers::get_gobject_refcount(ptr) }, initial_ref);

    drop(handle);
    assert_eq!(unsafe { helpers::get_gobject_refcount(ptr) }, initial_ref);
    drop(obj);
}

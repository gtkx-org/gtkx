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
fn object_id_from_registers_in_map() {
    let obj = create_test_gobject();
    let object = NativeValue::GObject(obj);
    let id: NativeHandle = object.into();

    assert!(id.id() > 0);

    GtkThreadState::with(|state| {
        assert!(state.handle_map.contains_key(&id.id()));
    });
}

#[test]
fn object_id_as_ptr_returns_correct_pointer() {
    let obj = create_test_gobject();
    let expected_ptr = obj.as_ptr() as *mut c_void;
    let object = NativeValue::GObject(obj);
    let id: NativeHandle = object.into();

    let ptr = id.get_ptr();
    assert_eq!(ptr, Some(expected_ptr));
}

#[test]
fn object_id_as_ptr_returns_none_after_removal() {
    let obj = create_test_gobject();
    let object = NativeValue::GObject(obj);
    let id: NativeHandle = object.into();

    GtkThreadState::with(|state| {
        state.handle_map.remove(&id.id());
    });

    assert_eq!(id.get_ptr(), None);
}

#[test]
fn object_id_get_ptr_as_usize_returns_usize() {
    let obj = create_test_gobject();
    let expected_ptr = obj.as_ptr() as usize;
    let object = NativeValue::GObject(obj);
    let id: NativeHandle = object.into();

    let ptr = id.get_ptr_as_usize();
    assert_eq!(ptr, Some(expected_ptr));
}

#[test]
fn object_id_increments_sequentially() {
    let obj1 = create_test_gobject();
    let obj2 = create_test_gobject();

    let id1: NativeHandle = NativeValue::GObject(obj1).into();
    let id2: NativeHandle = NativeValue::GObject(obj2).into();

    assert!(id2.id() > id1.id());
}

#[test]
fn object_boxed_stores_and_retrieves() {
    common::ensure_gtk_init();

    let gtype = gdk::RGBA::static_type();
    let ptr = common::allocate_test_boxed(gtype);
    let boxed = Boxed::from_glib_full(Some(gtype), ptr);
    let object = NativeValue::Boxed(boxed);
    let id: NativeHandle = object.into();

    let retrieved_ptr = id.get_ptr();
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

    let _id: NativeHandle = NativeValue::GObject(obj.clone()).into();

    let after_ref = unsafe {
        let ptr = obj.as_ptr();
        (*ptr).ref_count
    };

    assert!(after_ref >= initial_ref);
}

#[test]
fn multiple_objects_independent() {
    let obj1 = create_test_gobject();
    let obj2 = create_test_gobject();

    let id1: NativeHandle = NativeValue::GObject(obj1.clone()).into();
    let id2: NativeHandle = NativeValue::GObject(obj2.clone()).into();

    GtkThreadState::with(|state| {
        state.handle_map.remove(&id1.id());
    });

    assert_eq!(id1.get_ptr(), None);
    assert!(id2.get_ptr().is_some());
}

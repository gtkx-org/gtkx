mod common;

use std::ffi::c_void;

use gtk4::gdk;
use gtk4::glib;
use gtk4::prelude::{ObjectType as _, StaticType as _};

use native::boxed::Boxed;
use native::object::{Object, ObjectId};
use native::state::GtkThreadState;

fn create_test_gobject() -> glib::Object {
    common::ensure_gtk_init();
    glib::Object::new::<glib::Object>()
}

#[test]
fn object_id_from_registers_in_map() {
    let obj = create_test_gobject();
    let object = Object::GObject(obj);
    let id: ObjectId = object.into();

    assert!(id.0 > 0);

    GtkThreadState::with(|state| {
        assert!(state.object_map.contains_key(&id.0));
    });
}

#[test]
fn object_id_as_ptr_returns_correct_pointer() {
    let obj = create_test_gobject();
    let expected_ptr = obj.as_ptr() as *mut c_void;
    let object = Object::GObject(obj);
    let id: ObjectId = object.into();

    let ptr = id.as_ptr();
    assert_eq!(ptr, Some(expected_ptr));
}

#[test]
fn object_id_as_ptr_returns_none_after_removal() {
    let obj = create_test_gobject();
    let object = Object::GObject(obj);
    let id: ObjectId = object.into();

    GtkThreadState::with(|state| {
        state.object_map.remove(&id.0);
    });

    assert_eq!(id.as_ptr(), None);
}

#[test]
fn object_id_try_as_ptr_returns_usize() {
    let obj = create_test_gobject();
    let expected_ptr = obj.as_ptr() as usize;
    let object = Object::GObject(obj);
    let id: ObjectId = object.into();

    let ptr = id.try_as_ptr();
    assert_eq!(ptr, Some(expected_ptr));
}

#[test]
fn object_id_increments_sequentially() {
    let obj1 = create_test_gobject();
    let obj2 = create_test_gobject();

    let id1: ObjectId = Object::GObject(obj1).into();
    let id2: ObjectId = Object::GObject(obj2).into();

    assert!(id2.0 > id1.0);
}

#[test]
fn object_boxed_stores_and_retrieves() {
    common::ensure_gtk_init();

    let gtype = gdk::RGBA::static_type();
    let ptr = common::allocate_test_boxed(gtype);
    let boxed = Boxed::from_glib_full(Some(gtype), ptr);
    let object = Object::Boxed(boxed);
    let id: ObjectId = object.into();

    let retrieved_ptr = id.as_ptr();
    assert_eq!(retrieved_ptr, Some(ptr));
}

#[test]
fn object_gobject_clone_shares_reference() {
    let obj = create_test_gobject();
    let object = Object::GObject(obj.clone());
    let cloned = object.clone();

    let ptr1 = match &object {
        Object::GObject(o) => o.as_ptr(),
        _ => panic!("Expected GObject"),
    };

    let ptr2 = match &cloned {
        Object::GObject(o) => o.as_ptr(),
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
    let object = Object::Boxed(boxed);
    let cloned = object.clone();

    let ptr1 = match &object {
        Object::Boxed(b) => b.as_ptr(),
        _ => panic!("Expected Boxed"),
    };

    let ptr2 = match &cloned {
        Object::Boxed(b) => b.as_ptr(),
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

    let _id: ObjectId = Object::GObject(obj.clone()).into();

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

    let id1: ObjectId = Object::GObject(obj1.clone()).into();
    let id2: ObjectId = Object::GObject(obj2.clone()).into();

    GtkThreadState::with(|state| {
        state.object_map.remove(&id1.0);
    });

    assert_eq!(id1.as_ptr(), None);
    assert!(id2.as_ptr().is_some());
}

#[test]
fn object_id_recycles_freed_ids() {
    let obj1 = create_test_gobject();
    let obj2 = create_test_gobject();
    let obj3 = create_test_gobject();

    let id1: ObjectId = Object::GObject(obj1).into();
    let id1_value = id1.0;

    GtkThreadState::with(|state| {
        state.object_map.remove(&id1.0);
        state.free_object_ids.push(id1.0);
    });

    let id2: ObjectId = Object::GObject(obj2).into();
    assert_eq!(id2.0, id1_value);

    let id3: ObjectId = Object::GObject(obj3).into();
    assert!(id3.0 > id1_value);
}

#[test]
fn free_object_ids_uses_lifo_order() {
    let obj1 = create_test_gobject();
    let obj2 = create_test_gobject();
    let obj3 = create_test_gobject();
    let obj4 = create_test_gobject();

    let id1: ObjectId = Object::GObject(obj1).into();
    let id2: ObjectId = Object::GObject(obj2).into();
    let id1_value = id1.0;
    let id2_value = id2.0;

    GtkThreadState::with(|state| {
        state.object_map.remove(&id1.0);
        state.free_object_ids.push(id1.0);
        state.object_map.remove(&id2.0);
        state.free_object_ids.push(id2.0);
    });

    let id3: ObjectId = Object::GObject(obj3).into();
    let id4: ObjectId = Object::GObject(obj4).into();

    assert_eq!(id3.0, id2_value);
    assert_eq!(id4.0, id1_value);
}

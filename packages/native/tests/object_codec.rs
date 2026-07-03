use test_support as helpers;

use std::ffi::c_void;

use gtk4::glib;

use native::ffi;
use native::ffi::codec::{Decoder, Encoder, ObjectCodec, Ownership, ReadSource};
use native::ffi::value::Value;
use native::handle::Handle;

use helpers::{
    assert_decode_null_yields_null, assert_read_null_yields_null,
    assert_write_return_err_writes_null, fresh_gobject, get_gobject_refcount, read_slot,
    write_return_into_slot,
};

fn borrowed() -> ObjectCodec {
    ObjectCodec {
        ownership: Ownership::Borrowed,
    }
}

fn full() -> ObjectCodec {
    ObjectCodec {
        ownership: Ownership::Full,
    }
}

fn object_value_of(ptr: *mut glib::gobject_ffi::GObject) -> Value {
    Value::Object(Handle::from_glib_borrow(ptr as *mut c_void))
}

fn encode_object(codec: &ObjectCodec, ptr: *mut glib::gobject_ffi::GObject) -> ffi::Stash {
    codec
        .encode(&object_value_of(ptr))
        .expect("encode should succeed")
}

#[test]
fn encode_full_transfer_adds_exactly_one_ref() {
    helpers::run(|| {
        let (_obj, obj_ptr, before) = fresh_gobject();

        let encoded = encode_object(&full(), obj_ptr);
        encoded.disarm_pending_transfer();

        assert_eq!(get_gobject_refcount(obj_ptr), before + 1);

        let ffi::Stash::Storage(storage) = &encoded else {
            panic!("expected Storage ffi value");
        };
        assert_eq!(storage.ptr(), obj_ptr as *mut c_void);

        unsafe { glib::gobject_ffi::g_object_unref(obj_ptr) };
        assert_eq!(get_gobject_refcount(obj_ptr), before);
    });
}

#[test]
fn encode_full_transfer_releases_reference_when_call_never_happens() {
    helpers::run(|| {
        let (_obj, obj_ptr, before) = fresh_gobject();

        let encoded = encode_object(&full(), obj_ptr);
        drop(encoded);

        assert_eq!(get_gobject_refcount(obj_ptr), before);
    });
}

#[test]
fn encode_borrowed_does_not_change_refcount() {
    helpers::run(|| {
        let (_obj, obj_ptr, before) = fresh_gobject();

        let encoded = encode_object(&borrowed(), obj_ptr);

        assert_eq!(get_gobject_refcount(obj_ptr), before);
        assert!(matches!(encoded, ffi::Stash::Ptr(_)));
    });
}

#[test]
fn encode_null_object_stays_null() {
    helpers::run(|| {
        helpers::assert_encode_null_yields_null_ptr(&full());
    });
}

#[test]
fn ref_for_transfer_full_adds_one_ref() {
    helpers::run(|| {
        let (_obj, obj_ptr, before) = fresh_gobject();

        let returned = unsafe { full().ref_for_transfer(obj_ptr as *mut c_void) }
            .expect("ref_for_transfer should succeed");

        assert_eq!(get_gobject_refcount(obj_ptr), before + 1);
        assert_eq!(returned, obj_ptr as *mut c_void);

        unsafe { glib::gobject_ffi::g_object_unref(obj_ptr) };
        assert_eq!(get_gobject_refcount(obj_ptr), before);
    });
}

#[test]
fn ref_for_transfer_borrowed_keeps_refcount() {
    helpers::run(|| {
        let (_obj, obj_ptr, before) = fresh_gobject();

        let returned = unsafe { borrowed().ref_for_transfer(obj_ptr as *mut c_void) }
            .expect("ref_for_transfer should succeed");

        assert_eq!(get_gobject_refcount(obj_ptr), before);
        assert_eq!(returned, obj_ptr as *mut c_void);
    });
}

#[test]
fn ref_for_transfer_full_null_is_noop() {
    helpers::run(|| {
        let returned = unsafe { full().ref_for_transfer(std::ptr::null_mut()) }
            .expect("null ref_for_transfer should succeed");
        assert!(returned.is_null());
    });
}

#[test]
fn decode_borrowed_adds_exactly_one_ref() {
    helpers::run(|| {
        let (_obj, obj_ptr, before) = fresh_gobject();

        let decoded = borrowed()
            .decode(&ffi::Stash::Ptr(obj_ptr as *mut c_void))
            .expect("borrowed decode should succeed");

        assert_eq!(get_gobject_refcount(obj_ptr), before + 1);
        assert!(matches!(decoded, Value::Object(_)));

        drop(decoded);
    });
}

#[test]
fn decode_full_transfer_keeps_refcount_net_of_wrapper() {
    helpers::run(|| {
        let (_obj, obj_ptr, _) = fresh_gobject();

        unsafe { glib::gobject_ffi::g_object_ref(obj_ptr) };
        let before = get_gobject_refcount(obj_ptr);

        let decoded = full()
            .decode(&ffi::Stash::Ptr(obj_ptr as *mut c_void))
            .expect("full decode should succeed");

        assert_eq!(get_gobject_refcount(obj_ptr), before);
        assert!(matches!(decoded, Value::Object(_)));
    });
}

#[test]
fn decode_floating_object_is_sunk() {
    helpers::run(|| {
        let obj_ptr = unsafe {
            glib::gobject_ffi::g_object_new(
                glib::gobject_ffi::g_initially_unowned_get_type(),
                std::ptr::null(),
            )
        };

        assert!(unsafe { glib::gobject_ffi::g_object_is_floating(obj_ptr) != 0 });
        let before = get_gobject_refcount(obj_ptr);

        let decoded = full()
            .decode(&ffi::Stash::Ptr(obj_ptr as *mut c_void))
            .expect("floating decode should succeed");

        assert!(!unsafe { glib::gobject_ffi::g_object_is_floating(obj_ptr) != 0 });
        assert_eq!(get_gobject_refcount(obj_ptr), before);
        assert!(matches!(decoded, Value::Object(_)));
    });
}

#[test]
fn decode_null_pointer_yields_null() {
    helpers::run(|| {
        assert_decode_null_yields_null(&borrowed());
    });
}

#[test]
fn ptr_to_value_wraps_borrowed_object() {
    helpers::run(|| {
        let (_obj, obj_ptr, before) = fresh_gobject();

        let value = unsafe { borrowed().read(ReadSource::Value(obj_ptr as *mut c_void, "ctx")) }
            .expect("ptr_to_value should succeed");

        assert_eq!(get_gobject_refcount(obj_ptr), before + 1);
        assert!(matches!(value, Value::Object(_)));
        drop(value);
    });
}

#[test]
fn ptr_to_value_null_yields_null() {
    helpers::run(|| {
        assert_read_null_yields_null(&borrowed());
    });
}

#[test]
fn read_from_pointer_dereferences_and_wraps() {
    helpers::run(|| {
        let (_obj, obj_ptr, _) = fresh_gobject();

        let value = unsafe { read_slot(&borrowed(), obj_ptr as *mut c_void) }
            .expect("read_from_pointer should succeed");
        assert!(matches!(value, Value::Object(_)));
        drop(value);
    });
}

#[test]
fn write_return_to_pointer_full_transfer_writes_referenced_pointer() {
    helpers::run(|| {
        let (_obj, obj_ptr, before) = fresh_gobject();

        let slot = write_return_into_slot(&full(), &Ok(object_value_of(obj_ptr)));

        assert_eq!(slot, obj_ptr as *mut c_void);
        assert_eq!(get_gobject_refcount(obj_ptr), before + 1);
        unsafe { glib::gobject_ffi::g_object_unref(obj_ptr) };
    });
}

#[test]
fn write_return_to_pointer_borrowed_keeps_refcount() {
    helpers::run(|| {
        let (_obj, obj_ptr, before) = fresh_gobject();

        let slot = write_return_into_slot(&borrowed(), &Ok(object_value_of(obj_ptr)));

        assert_eq!(slot, obj_ptr as *mut c_void);
        assert_eq!(get_gobject_refcount(obj_ptr), before);
    });
}

#[test]
fn write_return_to_pointer_err_writes_null() {
    helpers::run(|| {
        assert_write_return_err_writes_null(&borrowed());
    });
}

#[test]
fn write_value_to_pointer_writes_object() {
    helpers::run(|| {
        let (_obj, obj_ptr, before) = fresh_gobject();

        let slot = helpers::write_value_into_slot(
            &borrowed(),
            std::ptr::null_mut(),
            &object_value_of(obj_ptr),
        );

        assert_eq!(slot, obj_ptr as *mut c_void);
        assert_eq!(get_gobject_refcount(obj_ptr), before + 1);

        unsafe { glib::gobject_ffi::g_object_unref(slot.cast()) };
    });
}

#[test]
fn write_value_to_pointer_unrefs_previous_object() {
    helpers::run(|| {
        let (_old, old_ptr, _) = fresh_gobject();
        let (_new, new_ptr, _) = fresh_gobject();

        unsafe { glib::gobject_ffi::g_object_ref(old_ptr.cast()) };
        let old_before = get_gobject_refcount(old_ptr);
        let new_before = get_gobject_refcount(new_ptr);

        let slot = helpers::write_value_into_slot(
            &borrowed(),
            old_ptr as *mut c_void,
            &object_value_of(new_ptr),
        );

        assert_eq!(slot, new_ptr as *mut c_void);
        assert_eq!(get_gobject_refcount(new_ptr), new_before + 1);
        assert_eq!(get_gobject_refcount(old_ptr), old_before - 1);

        unsafe { glib::gobject_ffi::g_object_unref(slot.cast()) };
    });
}

#[test]
fn write_value_to_pointer_null_releases_previous_object() {
    helpers::run(|| {
        let (_obj, obj_ptr, _) = fresh_gobject();

        unsafe { glib::gobject_ffi::g_object_ref(obj_ptr.cast()) };
        let before = get_gobject_refcount(obj_ptr);

        let slot =
            helpers::write_value_into_slot(&borrowed(), obj_ptr as *mut c_void, &Value::Null);

        assert!(slot.is_null());
        assert_eq!(get_gobject_refcount(obj_ptr), before - 1);
    });
}

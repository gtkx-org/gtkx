mod common;

use std::ffi::c_void;

use gtk4::glib;
use gtk4::prelude::ObjectType as _;

use native::ffi;
use native::managed::NativeHandle;
use native::types::{FfiDecoder, FfiEncoder, GObjectType, Ownership, RawPtrCodec, ReadSource};
use native::value::Value;

use common::{
    assert_decode_null_yields_null, assert_read_null_yields_null,
    assert_write_return_err_writes_null, get_gobject_refcount, read_slot, write_return_into_slot,
};

fn borrowed() -> GObjectType {
    GObjectType {
        ownership: Ownership::Borrowed,
    }
}

fn full() -> GObjectType {
    GObjectType {
        ownership: Ownership::Full,
    }
}

fn fresh_gobject() -> (glib::Object, *mut glib::gobject_ffi::GObject, u32) {
    let obj = glib::Object::new::<glib::Object>();
    let obj_ptr = obj.as_ptr();
    let before = get_gobject_refcount(obj_ptr);
    (obj, obj_ptr, before)
}

fn object_value_of(ptr: *mut glib::gobject_ffi::GObject) -> Value {
    Value::Object(NativeHandle::borrowed(ptr as *mut c_void))
}

fn encode_object(ty: &GObjectType, ptr: *mut glib::gobject_ffi::GObject) -> ffi::FfiValue {
    ty.encode(&object_value_of(ptr))
        .expect("encode should succeed")
}

#[test]
fn encode_full_transfer_adds_exactly_one_ref() {
    common::run(|| {
        let (_obj, obj_ptr, before) = fresh_gobject();

        let encoded = encode_object(&full(), obj_ptr);
        encoded.disarm_pending_transfer();

        assert_eq!(get_gobject_refcount(obj_ptr), before + 1);

        let ffi::FfiValue::Storage(storage) = &encoded else {
            panic!("expected Storage ffi value");
        };
        assert_eq!(storage.ptr(), obj_ptr as *mut c_void);

        unsafe { glib::gobject_ffi::g_object_unref(obj_ptr) };
        assert_eq!(get_gobject_refcount(obj_ptr), before);
    });
}

#[test]
fn encode_full_transfer_releases_reference_when_call_never_happens() {
    common::run(|| {
        let (_obj, obj_ptr, before) = fresh_gobject();

        let encoded = encode_object(&full(), obj_ptr);
        drop(encoded);

        assert_eq!(get_gobject_refcount(obj_ptr), before);
    });
}

#[test]
fn encode_borrowed_does_not_change_refcount() {
    common::run(|| {
        let (_obj, obj_ptr, before) = fresh_gobject();

        let encoded = encode_object(&borrowed(), obj_ptr);

        assert_eq!(get_gobject_refcount(obj_ptr), before);
        assert!(matches!(encoded, ffi::FfiValue::Ptr(_)));
    });
}

#[test]
fn encode_null_object_stays_null() {
    common::run(|| {
        common::assert_encode_null_yields_null_ptr(&full());
    });
}

#[test]
fn ref_for_transfer_full_adds_one_ref() {
    common::run(|| {
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
    common::run(|| {
        let (_obj, obj_ptr, before) = fresh_gobject();

        let returned = unsafe { borrowed().ref_for_transfer(obj_ptr as *mut c_void) }
            .expect("ref_for_transfer should succeed");

        assert_eq!(get_gobject_refcount(obj_ptr), before);
        assert_eq!(returned, obj_ptr as *mut c_void);
    });
}

#[test]
fn ref_for_transfer_full_null_is_noop() {
    common::run(|| {
        let returned = unsafe { full().ref_for_transfer(std::ptr::null_mut()) }
            .expect("null ref_for_transfer should succeed");
        assert!(returned.is_null());
    });
}

#[test]
fn decode_borrowed_adds_exactly_one_ref() {
    common::run(|| {
        let (_obj, obj_ptr, before) = fresh_gobject();

        let decoded = borrowed()
            .decode(&ffi::FfiValue::Ptr(obj_ptr as *mut c_void))
            .expect("borrowed decode should succeed");

        assert_eq!(get_gobject_refcount(obj_ptr), before + 1);
        assert!(matches!(decoded, Value::Object(_)));

        drop(decoded);
    });
}

#[test]
fn decode_full_transfer_keeps_refcount_net_of_wrapper() {
    common::run(|| {
        let (_obj, obj_ptr, _) = fresh_gobject();

        unsafe { glib::gobject_ffi::g_object_ref(obj_ptr) };
        let before = get_gobject_refcount(obj_ptr);

        let decoded = full()
            .decode(&ffi::FfiValue::Ptr(obj_ptr as *mut c_void))
            .expect("full decode should succeed");

        assert_eq!(get_gobject_refcount(obj_ptr), before);
        assert!(matches!(decoded, Value::Object(_)));
    });
}

#[test]
fn decode_floating_object_is_sunk() {
    common::run(|| {
        let obj_ptr = unsafe {
            glib::gobject_ffi::g_object_new(
                glib::gobject_ffi::g_initially_unowned_get_type(),
                std::ptr::null(),
            )
        };

        assert!(unsafe { glib::gobject_ffi::g_object_is_floating(obj_ptr) != 0 });
        let before = get_gobject_refcount(obj_ptr);

        let decoded = full()
            .decode(&ffi::FfiValue::Ptr(obj_ptr as *mut c_void))
            .expect("floating decode should succeed");

        assert!(!unsafe { glib::gobject_ffi::g_object_is_floating(obj_ptr) != 0 });
        assert_eq!(get_gobject_refcount(obj_ptr), before);
        assert!(matches!(decoded, Value::Object(_)));
    });
}

#[test]
fn decode_null_pointer_yields_null() {
    common::run(|| {
        assert_decode_null_yields_null(&borrowed());
    });
}

#[test]
fn ptr_to_value_wraps_borrowed_object() {
    common::run(|| {
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
    common::run(|| {
        assert_read_null_yields_null(&borrowed());
    });
}

#[test]
fn read_from_raw_ptr_dereferences_and_wraps() {
    common::run(|| {
        let (_obj, obj_ptr, _) = fresh_gobject();

        let value = unsafe { read_slot(&borrowed(), obj_ptr as *mut c_void) }
            .expect("read_from_raw_ptr should succeed");
        assert!(matches!(value, Value::Object(_)));
        drop(value);
    });
}

#[test]
fn write_return_to_raw_ptr_full_transfer_writes_referenced_pointer() {
    common::run(|| {
        let (_obj, obj_ptr, before) = fresh_gobject();

        let slot = write_return_into_slot(&full(), &Ok(object_value_of(obj_ptr)));

        assert_eq!(slot, obj_ptr as *mut c_void);
        assert_eq!(get_gobject_refcount(obj_ptr), before + 1);
        unsafe { glib::gobject_ffi::g_object_unref(obj_ptr) };
    });
}

#[test]
fn write_return_to_raw_ptr_borrowed_keeps_refcount() {
    common::run(|| {
        let (_obj, obj_ptr, before) = fresh_gobject();

        let slot = write_return_into_slot(&borrowed(), &Ok(object_value_of(obj_ptr)));

        assert_eq!(slot, obj_ptr as *mut c_void);
        assert_eq!(get_gobject_refcount(obj_ptr), before);
    });
}

#[test]
fn write_return_to_raw_ptr_err_writes_null() {
    common::run(|| {
        assert_write_return_err_writes_null(&borrowed());
    });
}

#[test]
fn write_value_to_raw_ptr_writes_object() {
    common::run(|| {
        let (_obj, obj_ptr, before) = fresh_gobject();

        let mut slot: *mut c_void = std::ptr::null_mut();
        unsafe {
            borrowed().write_value_to_raw_ptr(
                &mut slot as *mut *mut c_void as *mut c_void,
                &object_value_of(obj_ptr),
            )
        }
        .expect("write_value_to_raw_ptr should succeed");

        assert_eq!(slot, obj_ptr as *mut c_void);
        assert_eq!(get_gobject_refcount(obj_ptr), before + 1);

        unsafe { glib::gobject_ffi::g_object_unref(slot.cast()) };
    });
}

#[test]
fn write_value_to_raw_ptr_unrefs_previous_object() {
    common::run(|| {
        let (_old, old_ptr, _) = fresh_gobject();
        let (_new, new_ptr, _) = fresh_gobject();

        unsafe { glib::gobject_ffi::g_object_ref(old_ptr.cast()) };
        let mut slot: *mut c_void = old_ptr as *mut c_void;
        let old_before = get_gobject_refcount(old_ptr);
        let new_before = get_gobject_refcount(new_ptr);

        unsafe {
            borrowed().write_value_to_raw_ptr(
                &mut slot as *mut *mut c_void as *mut c_void,
                &object_value_of(new_ptr),
            )
        }
        .expect("write_value_to_raw_ptr should succeed");

        assert_eq!(slot, new_ptr as *mut c_void);
        assert_eq!(get_gobject_refcount(new_ptr), new_before + 1);
        assert_eq!(get_gobject_refcount(old_ptr), old_before - 1);

        unsafe { glib::gobject_ffi::g_object_unref(slot.cast()) };
    });
}

#[test]
fn write_value_to_raw_ptr_null_releases_previous_object() {
    common::run(|| {
        let (_obj, obj_ptr, _) = fresh_gobject();

        unsafe { glib::gobject_ffi::g_object_ref(obj_ptr.cast()) };
        let mut slot: *mut c_void = obj_ptr as *mut c_void;
        let before = get_gobject_refcount(obj_ptr);

        unsafe {
            borrowed()
                .write_value_to_raw_ptr(&mut slot as *mut *mut c_void as *mut c_void, &Value::Null)
        }
        .expect("write_value_to_raw_ptr should succeed");

        assert!(slot.is_null());
        assert_eq!(get_gobject_refcount(obj_ptr), before - 1);
    });
}

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

        // SAFETY: the full-transfer encode took one extra reference on the live `obj_ptr` (whose
        // pending transfer was disarmed); this releases exactly that reference.
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

        // SAFETY: `obj_ptr` is the live GObject of the `_obj` binding; the full `ref_for_transfer`
        // takes one new strong reference that the explicit `g_object_unref` below balances.
        let returned = unsafe { full().ref_for_transfer(obj_ptr as *mut c_void) }
            .expect("ref_for_transfer should succeed");

        assert_eq!(get_gobject_refcount(obj_ptr), before + 1);
        assert_eq!(returned, obj_ptr as *mut c_void);

        // SAFETY: `obj_ptr` is still live; this releases the reference added by `ref_for_transfer`.
        unsafe { glib::gobject_ffi::g_object_unref(obj_ptr) };
        assert_eq!(get_gobject_refcount(obj_ptr), before);
    });
}

#[test]
fn ref_for_transfer_borrowed_keeps_refcount() {
    common::run(|| {
        let (_obj, obj_ptr, before) = fresh_gobject();

        // SAFETY: `obj_ptr` is the live GObject of the `_obj` binding; the borrowed
        // `ref_for_transfer` returns it unchanged without taking a reference.
        let returned = unsafe { borrowed().ref_for_transfer(obj_ptr as *mut c_void) }
            .expect("ref_for_transfer should succeed");

        assert_eq!(get_gobject_refcount(obj_ptr), before);
        assert_eq!(returned, obj_ptr as *mut c_void);
    });
}

#[test]
fn ref_for_transfer_full_null_is_noop() {
    common::run(|| {
        // SAFETY: `ref_for_transfer` tolerates a null pointer, returning it without dereferencing
        // or taking a reference.
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

        // SAFETY: `obj_ptr` is the live GObject of the `_obj` binding; this extra reference models
        // the full-transfer caller's owned reference that the decode consumes.
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
        // SAFETY: `g_initially_unowned_get_type` is a valid GType and a null varargs terminator is
        // the documented "no properties" call, so `g_object_new` returns a fresh floating object.
        let obj_ptr = unsafe {
            glib::gobject_ffi::g_object_new(
                glib::gobject_ffi::g_initially_unowned_get_type(),
                std::ptr::null(),
            )
        };

        // SAFETY: `obj_ptr` is the freshly created, live object; `g_object_is_floating` queries its
        // floating state.
        assert!(unsafe { glib::gobject_ffi::g_object_is_floating(obj_ptr) != 0 });
        let before = get_gobject_refcount(obj_ptr);

        let decoded = full()
            .decode(&ffi::FfiValue::Ptr(obj_ptr as *mut c_void))
            .expect("floating decode should succeed");

        // SAFETY: `obj_ptr` is still live (the decode ref-sank rather than freed it); this queries
        // its now-non-floating state.
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

        // SAFETY: `obj_ptr` is the live GObject of the `_obj` binding; the borrowed `read` wraps it
        // and takes one new strong reference released when `value` is dropped.
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

        // SAFETY: `read_slot` places `obj_ptr` into a pointer slot and reads through it; `obj_ptr`
        // is the live GObject of the `_obj` binding, so the slot points to a valid object.
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
        // SAFETY: the full-transfer return write took one extra reference on the live `obj_ptr`;
        // this releases exactly that reference.
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
        // SAFETY: the address of the live, writable pointer stack local `slot` is the pointer slot
        // the codec writes into; it was null, so no previous object is released, and the write
        // stores a newly referenced pointer to the live `obj_ptr`.
        unsafe {
            borrowed().write_value_to_raw_ptr(
                &mut slot as *mut *mut c_void as *mut c_void,
                &object_value_of(obj_ptr),
            )
        }
        .expect("write_value_to_raw_ptr should succeed");

        assert_eq!(slot, obj_ptr as *mut c_void);
        assert_eq!(get_gobject_refcount(obj_ptr), before + 1);

        // SAFETY: `slot` now holds the live `obj_ptr` with the extra reference taken by the write;
        // this releases exactly that reference.
        unsafe { glib::gobject_ffi::g_object_unref(slot.cast()) };
    });
}

#[test]
fn write_value_to_raw_ptr_unrefs_previous_object() {
    common::run(|| {
        let (_old, old_ptr, _) = fresh_gobject();
        let (_new, new_ptr, _) = fresh_gobject();

        // SAFETY: `old_ptr` is the live old GObject; this extra reference is the one the slot owns
        // and that the codec releases when it overwrites the slot below.
        unsafe { glib::gobject_ffi::g_object_ref(old_ptr.cast()) };
        let mut slot: *mut c_void = old_ptr as *mut c_void;
        let old_before = get_gobject_refcount(old_ptr);
        let new_before = get_gobject_refcount(new_ptr);

        // SAFETY: the address of the live, writable pointer stack local `slot` (currently holding
        // the owned `old_ptr`) is the slot the codec swaps: it references the live `new_ptr` and
        // releases the previously owned `old_ptr`, keeping the count balanced.
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

        // SAFETY: `slot` now holds the live `new_ptr` with the reference taken by the write; this
        // releases exactly that reference.
        unsafe { glib::gobject_ffi::g_object_unref(slot.cast()) };
    });
}

#[test]
fn write_value_to_raw_ptr_null_releases_previous_object() {
    common::run(|| {
        let (_obj, obj_ptr, _) = fresh_gobject();

        // SAFETY: `obj_ptr` is the live GObject; this extra reference is the one the slot owns and
        // that the codec releases when it clears the slot below.
        unsafe { glib::gobject_ffi::g_object_ref(obj_ptr.cast()) };
        let mut slot: *mut c_void = obj_ptr as *mut c_void;
        let before = get_gobject_refcount(obj_ptr);

        // SAFETY: the address of the live, writable pointer stack local `slot` (currently holding
        // the owned `obj_ptr`) is the slot the codec writes; a null value stores null and releases
        // the previously owned `obj_ptr`.
        unsafe {
            borrowed()
                .write_value_to_raw_ptr(&mut slot as *mut *mut c_void as *mut c_void, &Value::Null)
        }
        .expect("write_value_to_raw_ptr should succeed");

        assert!(slot.is_null());
        assert_eq!(get_gobject_refcount(obj_ptr), before - 1);
    });
}

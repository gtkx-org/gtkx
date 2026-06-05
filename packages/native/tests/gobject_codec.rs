//! Coverage tests for [`native::types::GObjectType`] codec implementations.

mod common;

use std::ffi::c_void;

use gtk4::glib;
use gtk4::prelude::ObjectType as _;

use native::ffi;
use native::managed::NativeHandle;
use native::types::{FfiDecoder, FfiEncoder, GObjectType, Ownership, RawPtrCodec};
use native::value::Value;

use common::get_gobject_refcount;

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

#[test]
fn encode_full_transfer_adds_exactly_one_ref() {
    common::run(|| {
        let obj = glib::Object::new::<glib::Object>();
        let obj_ptr = obj.as_ptr();
        let before = get_gobject_refcount(obj_ptr);

        let encoded = full()
            .encode(
                &Value::Object(NativeHandle::borrowed(obj_ptr as *mut c_void)),
                false,
            )
            .expect("full encode should succeed");

        let after = get_gobject_refcount(obj_ptr);
        assert_eq!(after, before + 1);

        let ffi::FfiValue::Ptr(ptr) = encoded else {
            panic!("expected Ptr ffi value");
        };
        assert_eq!(ptr, obj_ptr as *mut c_void);

        unsafe { glib::gobject_ffi::g_object_unref(obj_ptr) };
        assert_eq!(get_gobject_refcount(obj_ptr), before);
    });
}

#[test]
fn encode_borrowed_does_not_change_refcount() {
    common::run(|| {
        let obj = glib::Object::new::<glib::Object>();
        let obj_ptr = obj.as_ptr();
        let before = get_gobject_refcount(obj_ptr);

        let encoded = borrowed()
            .encode(
                &Value::Object(NativeHandle::borrowed(obj_ptr as *mut c_void)),
                false,
            )
            .expect("borrowed encode should succeed");

        assert_eq!(get_gobject_refcount(obj_ptr), before);
        assert!(matches!(encoded, ffi::FfiValue::Ptr(_)));
    });
}

#[test]
fn encode_null_object_stays_null() {
    common::run(|| {
        let encoded = full()
            .encode(&Value::Null, false)
            .expect("null encode should succeed");
        assert!(matches!(encoded, ffi::FfiValue::Ptr(p) if p.is_null()));
    });
}

#[test]
fn encode_rejects_non_object() {
    common::run(|| {
        assert!(full().encode(&Value::Number(1.0), false).is_err());
    });
}

#[test]
fn ref_for_transfer_full_adds_one_ref() {
    common::run(|| {
        let obj = glib::Object::new::<glib::Object>();
        let obj_ptr = obj.as_ptr();
        let before = get_gobject_refcount(obj_ptr);

        let returned = full()
            .ref_for_transfer(obj_ptr as *mut c_void)
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
        let obj = glib::Object::new::<glib::Object>();
        let obj_ptr = obj.as_ptr();
        let before = get_gobject_refcount(obj_ptr);

        let returned = borrowed()
            .ref_for_transfer(obj_ptr as *mut c_void)
            .expect("ref_for_transfer should succeed");

        assert_eq!(get_gobject_refcount(obj_ptr), before);
        assert_eq!(returned, obj_ptr as *mut c_void);
    });
}

#[test]
fn ref_for_transfer_full_null_is_noop() {
    common::run(|| {
        let returned = full()
            .ref_for_transfer(std::ptr::null_mut())
            .expect("null ref_for_transfer should succeed");
        assert!(returned.is_null());
    });
}

#[test]
fn decode_borrowed_adds_exactly_one_ref() {
    common::run(|| {
        let obj = glib::Object::new::<glib::Object>();
        let obj_ptr = obj.as_ptr();
        let before = get_gobject_refcount(obj_ptr);

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
        let obj = glib::Object::new::<glib::Object>();
        let obj_ptr = obj.as_ptr();

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
        let decoded = borrowed()
            .decode(&ffi::FfiValue::Ptr(std::ptr::null_mut()))
            .expect("null decode should succeed");
        assert!(matches!(decoded, Value::Null));
    });
}

#[test]
fn decode_invalid_type_class_bails() {
    common::run(|| {
        let mut fake = [0usize; 4];
        let fake_ptr = fake.as_mut_ptr() as *mut c_void;
        let result = borrowed().decode(&ffi::FfiValue::Ptr(fake_ptr));
        assert!(result.is_err());
    });
}

#[test]
fn ptr_to_value_wraps_borrowed_object() {
    common::run(|| {
        let obj = glib::Object::new::<glib::Object>();
        let obj_ptr = obj.as_ptr();
        let before = get_gobject_refcount(obj_ptr);

        let value = borrowed()
            .ptr_to_value(obj_ptr as *mut c_void, "ctx")
            .expect("ptr_to_value should succeed");

        assert_eq!(get_gobject_refcount(obj_ptr), before + 1);
        assert!(matches!(value, Value::Object(_)));
        drop(value);
    });
}

#[test]
fn ptr_to_value_null_yields_null() {
    common::run(|| {
        let value = borrowed()
            .ptr_to_value(std::ptr::null_mut(), "ctx")
            .expect("null ptr_to_value should succeed");
        assert!(matches!(value, Value::Null));
    });
}

#[test]
fn ptr_to_value_invalid_type_class_bails() {
    common::run(|| {
        let mut fake = [0usize; 4];
        let fake_ptr = fake.as_mut_ptr() as *mut c_void;
        assert!(borrowed().ptr_to_value(fake_ptr, "ctx").is_err());
    });
}

#[test]
fn read_from_raw_ptr_dereferences_and_wraps() {
    common::run(|| {
        let obj = glib::Object::new::<glib::Object>();
        let obj_ptr = obj.as_ptr() as *mut c_void;
        let slot: *mut c_void = obj_ptr;

        let value = borrowed()
            .read_from_raw_ptr(&slot as *const *mut c_void as *const c_void, "ctx")
            .expect("read_from_raw_ptr should succeed");
        assert!(matches!(value, Value::Object(_)));
        drop(value);
    });
}

#[test]
fn write_return_to_raw_ptr_writes_object_pointer() {
    common::run(|| {
        let obj = glib::Object::new::<glib::Object>();
        let obj_ptr = obj.as_ptr();
        let before = get_gobject_refcount(obj_ptr);

        let mut slot: *mut c_void = std::ptr::null_mut();
        let value: Result<Value, ()> = Ok(Value::Object(NativeHandle::borrowed(
            obj_ptr as *mut c_void,
        )));
        borrowed().write_return_to_raw_ptr(&mut slot as *mut *mut c_void as *mut c_void, &value);

        assert_eq!(slot, obj_ptr as *mut c_void);
        assert_eq!(get_gobject_refcount(obj_ptr), before + 1);
        unsafe { glib::gobject_ffi::g_object_unref(obj_ptr) };
    });
}

#[test]
fn write_return_to_raw_ptr_err_writes_null() {
    common::run(|| {
        let mut slot: *mut c_void = std::ptr::dangling_mut::<c_void>();
        let value: Result<Value, ()> = Err(());
        borrowed().write_return_to_raw_ptr(&mut slot as *mut *mut c_void as *mut c_void, &value);
        assert!(slot.is_null());
    });
}

#[test]
fn write_value_to_raw_ptr_writes_object() {
    common::run(|| {
        let obj = glib::Object::new::<glib::Object>();
        let obj_ptr = obj.as_ptr();
        let before = get_gobject_refcount(obj_ptr);

        let mut slot: *mut c_void = std::ptr::null_mut();
        borrowed()
            .write_value_to_raw_ptr(
                &mut slot as *mut *mut c_void as *mut c_void,
                &Value::Object(NativeHandle::borrowed(obj_ptr as *mut c_void)),
            )
            .expect("write_value_to_raw_ptr should succeed");

        assert_eq!(slot, obj_ptr as *mut c_void);
        assert_eq!(get_gobject_refcount(obj_ptr), before + 1);

        unsafe { glib::gobject_ffi::g_object_unref(slot.cast()) };
    });
}

#[test]
fn write_value_to_raw_ptr_unrefs_previous_object() {
    common::run(|| {
        let old = glib::Object::new::<glib::Object>();
        let new = glib::Object::new::<glib::Object>();
        let old_ptr = old.as_ptr();
        let new_ptr = new.as_ptr();

        unsafe { glib::gobject_ffi::g_object_ref(old_ptr.cast()) };
        let mut slot: *mut c_void = old_ptr as *mut c_void;
        let old_before = get_gobject_refcount(old_ptr);
        let new_before = get_gobject_refcount(new_ptr);

        borrowed()
            .write_value_to_raw_ptr(
                &mut slot as *mut *mut c_void as *mut c_void,
                &Value::Object(NativeHandle::borrowed(new_ptr as *mut c_void)),
            )
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
        let obj = glib::Object::new::<glib::Object>();
        let obj_ptr = obj.as_ptr();

        unsafe { glib::gobject_ffi::g_object_ref(obj_ptr.cast()) };
        let mut slot: *mut c_void = obj_ptr as *mut c_void;
        let before = get_gobject_refcount(obj_ptr);

        borrowed()
            .write_value_to_raw_ptr(&mut slot as *mut *mut c_void as *mut c_void, &Value::Null)
            .expect("write_value_to_raw_ptr should succeed");

        assert!(slot.is_null());
        assert_eq!(get_gobject_refcount(obj_ptr), before - 1);
    });
}

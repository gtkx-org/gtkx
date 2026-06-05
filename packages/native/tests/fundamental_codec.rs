//! Coverage tests for [`native::types::FundamentalType`] codec implementations.

mod common;

use std::ffi::c_void;

use gtk4::glib;

use native::ffi;
use native::managed::NativeHandle;
use native::types::{FfiDecoder, FfiEncoder, FundamentalType, Ownership, RawPtrCodec};
use native::value::Value;

fn create_param_spec() -> *mut c_void {
    unsafe {
        let param = glib::gobject_ffi::g_param_spec_boolean(
            c"cov-param".as_ptr(),
            c"Cov".as_ptr(),
            c"A coverage parameter".as_ptr(),
            glib::ffi::GFALSE,
            glib::gobject_ffi::G_PARAM_READABLE,
        );
        param as *mut c_void
    }
}

fn param_spec_refcount(ptr: *mut c_void) -> u32 {
    if ptr.is_null() {
        return 0;
    }
    unsafe { (*(ptr as *mut glib::gobject_ffi::GParamSpec)).ref_count }
}

fn fundamental(ownership: Ownership) -> FundamentalType {
    FundamentalType {
        ownership,
        library: "libgobject-2.0.so.0".to_owned(),
        ref_func: "g_param_spec_ref".to_owned(),
        unref_func: "g_param_spec_unref".to_owned(),
        type_name: Some("GParam".to_owned()),
    }
}

#[test]
fn lookup_fns_resolves_ref_and_unref() {
    common::run(|| {
        let (ref_fn, unref_fn) = fundamental(Ownership::Borrowed)
            .lookup_fns()
            .expect("lookup_fns should succeed");
        assert!(ref_fn.is_some());
        assert!(unref_fn.is_some());
    });
}

#[test]
fn encode_full_adds_exactly_one_ref() {
    common::run(|| {
        let pspec = create_param_spec();
        let before = param_spec_refcount(pspec);

        let encoded = fundamental(Ownership::Full)
            .encode(&Value::Object(NativeHandle::borrowed(pspec)), false)
            .expect("full encode should succeed");
        assert!(matches!(encoded, ffi::FfiValue::Ptr(p) if p == pspec));
        assert_eq!(param_spec_refcount(pspec), before + 1);

        unsafe {
            glib::gobject_ffi::g_param_spec_unref(pspec.cast());
            glib::gobject_ffi::g_param_spec_unref(pspec.cast());
        }
    });
}

#[test]
fn encode_borrowed_keeps_refcount() {
    common::run(|| {
        let pspec = create_param_spec();
        let before = param_spec_refcount(pspec);

        let encoded = fundamental(Ownership::Borrowed)
            .encode(&Value::Object(NativeHandle::borrowed(pspec)), false)
            .expect("borrowed encode should succeed");
        assert!(matches!(encoded, ffi::FfiValue::Ptr(p) if p == pspec));
        assert_eq!(param_spec_refcount(pspec), before);

        unsafe { glib::gobject_ffi::g_param_spec_unref(pspec.cast()) };
    });
}

#[test]
fn encode_full_null_pointer_stays_null() {
    common::run(|| {
        let encoded = fundamental(Ownership::Full)
            .encode(&Value::Null, false)
            .expect("null encode should succeed");
        assert!(matches!(encoded, ffi::FfiValue::Ptr(p) if p.is_null()));
    });
}

#[test]
fn ref_for_transfer_full_adds_one_ref() {
    common::run(|| {
        let pspec = create_param_spec();
        let before = param_spec_refcount(pspec);

        let returned = fundamental(Ownership::Full)
            .ref_for_transfer(pspec)
            .expect("ref_for_transfer should succeed");
        assert_eq!(returned, pspec);
        assert_eq!(param_spec_refcount(pspec), before + 1);

        unsafe {
            glib::gobject_ffi::g_param_spec_unref(pspec.cast());
            glib::gobject_ffi::g_param_spec_unref(pspec.cast());
        }
    });
}

#[test]
fn ref_for_transfer_borrowed_keeps_refcount() {
    common::run(|| {
        let pspec = create_param_spec();
        let before = param_spec_refcount(pspec);

        let returned = fundamental(Ownership::Borrowed)
            .ref_for_transfer(pspec)
            .expect("ref_for_transfer should succeed");
        assert_eq!(returned, pspec);
        assert_eq!(param_spec_refcount(pspec), before);

        unsafe { glib::gobject_ffi::g_param_spec_unref(pspec.cast()) };
    });
}

fn fundamental_without_ref_fn(ownership: Ownership) -> FundamentalType {
    FundamentalType {
        ownership,
        library: "libgobject-2.0.so.0".to_owned(),
        ref_func: String::new(),
        unref_func: String::new(),
        type_name: Some("GParam".to_owned()),
    }
}

#[test]
fn ref_for_transfer_full_without_ref_fn_keeps_pointer() {
    common::run(|| {
        let pspec = create_param_spec();
        let before = param_spec_refcount(pspec);

        let returned = fundamental_without_ref_fn(Ownership::Full)
            .ref_for_transfer(pspec)
            .expect("ref_for_transfer should succeed");
        assert_eq!(returned, pspec);
        assert_eq!(param_spec_refcount(pspec), before);

        unsafe { glib::gobject_ffi::g_param_spec_unref(pspec.cast()) };
    });
}

#[test]
fn encode_full_without_ref_fn_keeps_pointer() {
    common::run(|| {
        let pspec = create_param_spec();
        let before = param_spec_refcount(pspec);

        let encoded = fundamental_without_ref_fn(Ownership::Full)
            .encode(&Value::Object(NativeHandle::borrowed(pspec)), false)
            .expect("encode should succeed");
        assert!(matches!(encoded, ffi::FfiValue::Ptr(p) if p == pspec));
        assert_eq!(param_spec_refcount(pspec), before);

        unsafe { glib::gobject_ffi::g_param_spec_unref(pspec.cast()) };
    });
}

#[test]
fn write_return_to_raw_ptr_without_ref_fn_writes_plain_pointer() {
    common::run(|| {
        let pspec = create_param_spec();
        let before = param_spec_refcount(pspec);

        let mut slot: *mut c_void = std::ptr::null_mut();
        let value: Result<Value, ()> = Ok(Value::Object(NativeHandle::borrowed(pspec)));
        fundamental_without_ref_fn(Ownership::Borrowed)
            .write_return_to_raw_ptr(&mut slot as *mut *mut c_void as *mut c_void, &value);

        assert_eq!(slot, pspec);
        assert_eq!(param_spec_refcount(pspec), before);

        unsafe { glib::gobject_ffi::g_param_spec_unref(pspec.cast()) };
    });
}

#[test]
fn ref_for_transfer_full_null_is_noop() {
    common::run(|| {
        let returned = fundamental(Ownership::Full)
            .ref_for_transfer(std::ptr::null_mut())
            .expect("null ref_for_transfer should succeed");
        assert!(returned.is_null());
    });
}

#[test]
fn decode_borrowed_adds_exactly_one_ref() {
    common::run(|| {
        let pspec = create_param_spec();
        let before = param_spec_refcount(pspec);

        let decoded = fundamental(Ownership::Borrowed)
            .decode(&ffi::FfiValue::Ptr(pspec))
            .expect("borrowed decode should succeed");
        assert!(matches!(decoded, Value::Object(_)));
        assert_eq!(param_spec_refcount(pspec), before + 1);

        drop(decoded);
        assert_eq!(param_spec_refcount(pspec), before);
        unsafe { glib::gobject_ffi::g_param_spec_unref(pspec.cast()) };
    });
}

#[test]
fn decode_full_takes_ownership() {
    common::run(|| {
        let pspec = create_param_spec();
        let before = param_spec_refcount(pspec);

        let decoded = fundamental(Ownership::Full)
            .decode(&ffi::FfiValue::Ptr(pspec))
            .expect("full decode should succeed");
        assert!(matches!(decoded, Value::Object(_)));
        assert_eq!(param_spec_refcount(pspec), before);

        drop(decoded);
    });
}

#[test]
fn decode_null_yields_null() {
    common::run(|| {
        let decoded = fundamental(Ownership::Borrowed)
            .decode(&ffi::FfiValue::Ptr(std::ptr::null_mut()))
            .expect("null decode should succeed");
        assert!(matches!(decoded, Value::Null));
    });
}

#[test]
fn ptr_to_value_wraps_fundamental() {
    common::run(|| {
        let pspec = create_param_spec();
        let before = param_spec_refcount(pspec);

        let value = fundamental(Ownership::Borrowed)
            .ptr_to_value(pspec, "ctx")
            .expect("ptr_to_value should succeed");
        assert!(matches!(value, Value::Object(_)));
        assert_eq!(param_spec_refcount(pspec), before + 1);

        drop(value);
        unsafe { glib::gobject_ffi::g_param_spec_unref(pspec.cast()) };
    });
}

#[test]
fn ptr_to_value_null_yields_null() {
    common::run(|| {
        let value = fundamental(Ownership::Borrowed)
            .ptr_to_value(std::ptr::null_mut(), "ctx")
            .expect("null ptr_to_value should succeed");
        assert!(matches!(value, Value::Null));
    });
}

#[test]
fn read_from_raw_ptr_dereferences_slot() {
    common::run(|| {
        let pspec = create_param_spec();
        let slot: *mut c_void = pspec;

        let value = fundamental(Ownership::Borrowed)
            .read_from_raw_ptr(&slot as *const *mut c_void as *const c_void, "ctx")
            .expect("read_from_raw_ptr should succeed");
        assert!(matches!(value, Value::Object(_)));
        drop(value);
        unsafe { glib::gobject_ffi::g_param_spec_unref(pspec.cast()) };
    });
}

#[test]
fn write_return_to_raw_ptr_writes_referenced_pointer() {
    common::run(|| {
        let pspec = create_param_spec();
        let before = param_spec_refcount(pspec);

        let mut slot: *mut c_void = std::ptr::null_mut();
        let value: Result<Value, ()> = Ok(Value::Object(NativeHandle::borrowed(pspec)));
        fundamental(Ownership::Borrowed)
            .write_return_to_raw_ptr(&mut slot as *mut *mut c_void as *mut c_void, &value);

        assert_eq!(slot, pspec);
        assert_eq!(param_spec_refcount(pspec), before + 1);

        unsafe {
            glib::gobject_ffi::g_param_spec_unref(pspec.cast());
            glib::gobject_ffi::g_param_spec_unref(pspec.cast());
        }
    });
}

#[test]
fn write_return_to_raw_ptr_err_writes_null() {
    common::run(|| {
        let mut slot: *mut c_void = std::ptr::dangling_mut::<c_void>();
        let value: Result<Value, ()> = Err(());
        fundamental(Ownership::Borrowed)
            .write_return_to_raw_ptr(&mut slot as *mut *mut c_void as *mut c_void, &value);
        assert!(slot.is_null());
    });
}

#[test]
fn write_value_to_raw_ptr_writes_fundamental() {
    common::run(|| {
        let pspec = create_param_spec();
        let before = param_spec_refcount(pspec);

        let mut slot: *mut c_void = std::ptr::null_mut();
        fundamental(Ownership::Borrowed)
            .write_value_to_raw_ptr(
                &mut slot as *mut *mut c_void as *mut c_void,
                &Value::Object(NativeHandle::borrowed(pspec)),
            )
            .expect("write_value_to_raw_ptr should succeed");

        assert_eq!(slot, pspec);
        assert_eq!(param_spec_refcount(pspec), before + 1);

        unsafe { glib::gobject_ffi::g_param_spec_unref(slot.cast()) };
        unsafe { glib::gobject_ffi::g_param_spec_unref(pspec.cast()) };
    });
}

#[test]
fn write_value_to_raw_ptr_unrefs_previous_fundamental() {
    common::run(|| {
        let old = create_param_spec();
        let new = create_param_spec();

        unsafe { glib::gobject_ffi::g_param_spec_ref(old.cast()) };
        let mut slot: *mut c_void = old;
        let old_before = param_spec_refcount(old);
        let new_before = param_spec_refcount(new);

        fundamental(Ownership::Borrowed)
            .write_value_to_raw_ptr(
                &mut slot as *mut *mut c_void as *mut c_void,
                &Value::Object(NativeHandle::borrowed(new)),
            )
            .expect("write_value_to_raw_ptr should succeed");

        assert_eq!(slot, new);
        assert_eq!(param_spec_refcount(new), new_before + 1);
        assert_eq!(param_spec_refcount(old), old_before - 1);

        unsafe { glib::gobject_ffi::g_param_spec_unref(slot.cast()) };
        unsafe { glib::gobject_ffi::g_param_spec_unref(old.cast()) };
        unsafe { glib::gobject_ffi::g_param_spec_unref(new.cast()) };
    });
}

#[test]
fn write_value_to_raw_ptr_null_releases_previous_fundamental() {
    common::run(|| {
        let pspec = create_param_spec();

        unsafe { glib::gobject_ffi::g_param_spec_ref(pspec.cast()) };
        let mut slot: *mut c_void = pspec;
        let before = param_spec_refcount(pspec);

        fundamental(Ownership::Borrowed)
            .write_value_to_raw_ptr(&mut slot as *mut *mut c_void as *mut c_void, &Value::Null)
            .expect("write_value_to_raw_ptr should succeed");

        assert!(slot.is_null());
        assert_eq!(param_spec_refcount(pspec), before - 1);

        unsafe { glib::gobject_ffi::g_param_spec_unref(pspec.cast()) };
    });
}

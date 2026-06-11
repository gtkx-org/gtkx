//! Coverage tests for [`native::types::FundamentalType`] codec implementations.

mod common;

use std::ffi::c_void;

use gtk4::glib;

use native::ffi;
use native::managed::NativeHandle;
use native::types::{FfiDecoder, FfiEncoder, FundamentalType, Ownership, RawPtrCodec};
use native::value::Value;

fn create_param_spec() -> *mut c_void {
    // SAFETY: Creating a GParamSpec from static NUL-terminated literals has no pointer preconditions.
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
    // SAFETY: The pointer addresses a live GParamSpec created by this test.
    unsafe { (*(ptr as *mut glib::gobject_ffi::GParamSpec)).ref_count }
}

fn release_param_spec_refs(ptr: *mut c_void, count: u32) {
    for _ in 0..count {
        // SAFETY: Releases a reference this test owns on the live GParamSpec.
        unsafe { glib::gobject_ffi::g_param_spec_unref(ptr.cast()) };
    }
}

fn fundamental_with_fns(ownership: Ownership, ref_func: &str, unref_func: &str) -> FundamentalType {
    FundamentalType {
        ownership,
        library: "libgobject-2.0.so.0".to_owned(),
        ref_func: ref_func.to_owned(),
        unref_func: unref_func.to_owned(),
        type_name: Some("GParam".to_owned()),
    }
}

fn fundamental(ownership: Ownership) -> FundamentalType {
    fundamental_with_fns(ownership, "g_param_spec_ref", "g_param_spec_unref")
}

fn fundamental_without_ref_fn(ownership: Ownership) -> FundamentalType {
    fundamental_with_fns(ownership, "", "")
}

fn fundamental_without_unref_fn(ownership: Ownership) -> FundamentalType {
    fundamental_with_fns(ownership, "g_param_spec_ref", "")
}

fn fundamental_with_unresolvable_symbols(ownership: Ownership) -> FundamentalType {
    fundamental_with_fns(ownership, "gtkx_cov_missing_ref", "gtkx_cov_missing_unref")
}

fn encode_param_spec(codec: &FundamentalType, pspec: *mut c_void) -> ffi::FfiValue {
    codec
        .encode(&Value::Object(NativeHandle::borrowed(pspec)), false)
        .expect("encode should succeed")
}

fn assert_encode_returns_plain_pointer(codec: &FundamentalType, expected_extra_refs: u32) {
    let pspec = create_param_spec();
    let before = param_spec_refcount(pspec);

    let encoded = encode_param_spec(codec, pspec);
    assert!(matches!(encoded, ffi::FfiValue::Ptr(p) if p == pspec));
    assert_eq!(param_spec_refcount(pspec), before + expected_extra_refs);

    release_param_spec_refs(pspec, expected_extra_refs + 1);
}

fn assert_ref_for_transfer(codec: &FundamentalType, expected_extra_refs: u32) {
    let pspec = create_param_spec();
    let before = param_spec_refcount(pspec);

    // SAFETY: `pspec` addresses a live GParamSpec.
    let returned =
        unsafe { codec.ref_for_transfer(pspec) }.expect("ref_for_transfer should succeed");
    assert_eq!(returned, pspec);
    assert_eq!(param_spec_refcount(pspec), before + expected_extra_refs);

    release_param_spec_refs(pspec, expected_extra_refs + 1);
}

fn assert_write_return_writes_pointer(codec: &FundamentalType, expected_extra_refs: u32) {
    let pspec = create_param_spec();
    let before = param_spec_refcount(pspec);

    let mut slot: *mut c_void = std::ptr::null_mut();
    let value: Result<Value, ()> = Ok(Value::Object(NativeHandle::borrowed(pspec)));
    // SAFETY: `slot` is a writable local pointer-sized slot and `pspec`
    // addresses a live GParamSpec.
    unsafe {
        codec.write_return_to_raw_ptr(&mut slot as *mut *mut c_void as *mut c_void, &value);
    }

    assert_eq!(slot, pspec);
    assert_eq!(param_spec_refcount(pspec), before + expected_extra_refs);

    release_param_spec_refs(pspec, expected_extra_refs + 1);
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

        let encoded = encode_param_spec(&fundamental(Ownership::Full), pspec);
        encoded.disarm_pending_transfer();
        assert!(matches!(&encoded, ffi::FfiValue::Storage(s) if s.ptr() == pspec));
        assert_eq!(param_spec_refcount(pspec), before + 1);

        release_param_spec_refs(pspec, 2);
    });
}

#[test]
fn encode_full_releases_reference_when_call_never_happens() {
    common::run(|| {
        let pspec = create_param_spec();
        let before = param_spec_refcount(pspec);

        let encoded = encode_param_spec(&fundamental(Ownership::Full), pspec);
        drop(encoded);
        assert_eq!(param_spec_refcount(pspec), before);

        release_param_spec_refs(pspec, 1);
    });
}

#[test]
fn encode_borrowed_keeps_refcount() {
    common::run(|| {
        assert_encode_returns_plain_pointer(&fundamental(Ownership::Borrowed), 0);
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
        assert_ref_for_transfer(&fundamental(Ownership::Full), 1);
    });
}

#[test]
fn ref_for_transfer_borrowed_keeps_refcount() {
    common::run(|| {
        assert_ref_for_transfer(&fundamental(Ownership::Borrowed), 0);
    });
}

#[test]
fn encode_full_without_unref_fn_returns_referenced_pointer() {
    common::run(|| {
        assert_encode_returns_plain_pointer(&fundamental_without_unref_fn(Ownership::Full), 1);
    });
}

#[test]
fn transfer_release_borrowed_is_none() {
    common::run(|| {
        assert!(
            fundamental(Ownership::Borrowed)
                .transfer_release()
                .is_none()
        );
    });
}

#[test]
fn transfer_release_full_without_fns_is_none() {
    common::run(|| {
        assert!(
            fundamental_without_ref_fn(Ownership::Full)
                .transfer_release()
                .is_none()
        );
    });
}

#[test]
fn transfer_release_full_with_unresolvable_symbols_is_none() {
    common::run(|| {
        assert!(
            fundamental_with_unresolvable_symbols(Ownership::Full)
                .transfer_release()
                .is_none()
        );
    });
}

#[test]
fn transfer_release_full_releases_one_reference() {
    common::run(|| {
        let release = fundamental(Ownership::Full)
            .transfer_release()
            .expect("full transfer_release should yield a release");
        assert!(matches!(release, ffi::PendingRelease::Fundamental(_)));

        let pspec = create_param_spec();
        // SAFETY: Takes a reference on the live GParamSpec this test created.
        unsafe { glib::gobject_ffi::g_param_spec_ref(pspec.cast()) };
        let before = param_spec_refcount(pspec);

        ffi::PendingTransfer::new(pspec, release).release_now();
        assert_eq!(param_spec_refcount(pspec), before - 1);

        release_param_spec_refs(pspec, 1);
    });
}

#[test]
fn ref_for_transfer_full_without_ref_fn_keeps_pointer() {
    common::run(|| {
        assert_ref_for_transfer(&fundamental_without_ref_fn(Ownership::Full), 0);
    });
}

#[test]
fn encode_full_without_ref_fn_keeps_pointer() {
    common::run(|| {
        assert_encode_returns_plain_pointer(&fundamental_without_ref_fn(Ownership::Full), 0);
    });
}

#[test]
fn write_return_to_raw_ptr_without_ref_fn_writes_plain_pointer() {
    common::run(|| {
        assert_write_return_writes_pointer(&fundamental_without_ref_fn(Ownership::Borrowed), 0);
    });
}

#[test]
fn write_return_to_raw_ptr_full_without_ref_fn_writes_plain_pointer() {
    common::run(|| {
        assert_write_return_writes_pointer(&fundamental_without_ref_fn(Ownership::Full), 0);
    });
}

#[test]
fn ref_for_transfer_full_null_is_noop() {
    common::run(|| {
        // SAFETY: Null short-circuits before any reference is taken.
        let returned =
            unsafe { fundamental(Ownership::Full).ref_for_transfer(std::ptr::null_mut()) }
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
        release_param_spec_refs(pspec, 1);
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

        // SAFETY: `pspec` addresses a live GParamSpec.
        let value = unsafe { fundamental(Ownership::Borrowed).ptr_to_value(pspec, "ctx") }
            .expect("ptr_to_value should succeed");
        assert!(matches!(value, Value::Object(_)));
        assert_eq!(param_spec_refcount(pspec), before + 1);

        drop(value);
        release_param_spec_refs(pspec, 1);
    });
}

#[test]
fn ptr_to_value_null_yields_null() {
    common::run(|| {
        // SAFETY: Null short-circuits before any read.
        let value =
            unsafe { fundamental(Ownership::Borrowed).ptr_to_value(std::ptr::null_mut(), "ctx") }
                .expect("null ptr_to_value should succeed");
        assert!(matches!(value, Value::Null));
    });
}

#[test]
fn read_from_raw_ptr_dereferences_slot() {
    common::run(|| {
        let pspec = create_param_spec();
        let slot: *mut c_void = pspec;

        // SAFETY: `slot` is a live local pointer-sized slot holding a live
        // GParamSpec pointer.
        let value = unsafe {
            fundamental(Ownership::Borrowed)
                .read_from_raw_ptr(&slot as *const *mut c_void as *const c_void, "ctx")
        }
        .expect("read_from_raw_ptr should succeed");
        assert!(matches!(value, Value::Object(_)));
        drop(value);
        release_param_spec_refs(pspec, 1);
    });
}

#[test]
fn write_return_to_raw_ptr_full_transfer_writes_referenced_pointer() {
    common::run(|| {
        assert_write_return_writes_pointer(&fundamental(Ownership::Full), 1);
    });
}

#[test]
fn write_return_to_raw_ptr_borrowed_keeps_refcount() {
    common::run(|| {
        assert_write_return_writes_pointer(&fundamental(Ownership::Borrowed), 0);
    });
}

#[test]
fn write_return_to_raw_ptr_err_writes_null() {
    common::run(|| {
        let mut slot: *mut c_void = std::ptr::dangling_mut::<c_void>();
        let value: Result<Value, ()> = Err(());
        // SAFETY: `slot` is a writable local pointer-sized slot.
        unsafe {
            fundamental(Ownership::Borrowed)
                .write_return_to_raw_ptr(&mut slot as *mut *mut c_void as *mut c_void, &value);
        }
        assert!(slot.is_null());
    });
}

#[test]
fn write_value_to_raw_ptr_writes_fundamental() {
    common::run(|| {
        let pspec = create_param_spec();
        let before = param_spec_refcount(pspec);

        let mut slot: *mut c_void = std::ptr::null_mut();
        // SAFETY: `slot` is a writable local pointer-sized slot and
        // `pspec` addresses a live GParamSpec.
        unsafe {
            fundamental(Ownership::Borrowed).write_value_to_raw_ptr(
                &mut slot as *mut *mut c_void as *mut c_void,
                &Value::Object(NativeHandle::borrowed(pspec)),
            )
        }
        .expect("write_value_to_raw_ptr should succeed");

        assert_eq!(slot, pspec);
        assert_eq!(param_spec_refcount(pspec), before + 1);

        release_param_spec_refs(pspec, 2);
    });
}

#[test]
fn write_value_to_raw_ptr_unrefs_previous_fundamental() {
    common::run(|| {
        let old = create_param_spec();
        let new = create_param_spec();

        // SAFETY: Takes a reference on the live GParamSpec this test created.
        unsafe { glib::gobject_ffi::g_param_spec_ref(old.cast()) };
        let mut slot: *mut c_void = old;
        let old_before = param_spec_refcount(old);
        let new_before = param_spec_refcount(new);

        // SAFETY: `slot` is a writable local pointer-sized slot holding an
        // owned reference, and `new` addresses a live GParamSpec.
        unsafe {
            fundamental(Ownership::Borrowed).write_value_to_raw_ptr(
                &mut slot as *mut *mut c_void as *mut c_void,
                &Value::Object(NativeHandle::borrowed(new)),
            )
        }
        .expect("write_value_to_raw_ptr should succeed");

        assert_eq!(slot, new);
        assert_eq!(param_spec_refcount(new), new_before + 1);
        assert_eq!(param_spec_refcount(old), old_before - 1);

        release_param_spec_refs(new, 2);
        release_param_spec_refs(old, 1);
    });
}

#[test]
fn write_value_to_raw_ptr_null_releases_previous_fundamental() {
    common::run(|| {
        let pspec = create_param_spec();

        // SAFETY: Takes a reference on the live GParamSpec this test created.
        unsafe { glib::gobject_ffi::g_param_spec_ref(pspec.cast()) };
        let mut slot: *mut c_void = pspec;
        let before = param_spec_refcount(pspec);

        // SAFETY: `slot` is a writable local pointer-sized slot holding an
        // owned reference.
        unsafe {
            fundamental(Ownership::Borrowed)
                .write_value_to_raw_ptr(&mut slot as *mut *mut c_void as *mut c_void, &Value::Null)
        }
        .expect("write_value_to_raw_ptr should succeed");

        assert!(slot.is_null());
        assert_eq!(param_spec_refcount(pspec), before - 1);

        release_param_spec_refs(pspec, 1);
    });
}

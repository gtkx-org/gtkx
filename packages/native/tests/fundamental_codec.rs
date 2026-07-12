use test_support as helpers;

use std::ffi::c_void;

use gtk4::glib;

use napi::Env;
use napi::JsValue as _;
use napi::bindgen_prelude::{External, Unknown};

use native::ffi;
use native::ffi::codec::{Decoder, Encoder, FundamentalCodec, Ownership, ReadSource};
use native::handle::Handle;

use helpers::napi_mock;
use helpers::{
    assert_decode_null_yields_null, assert_read_null_yields_null,
    assert_write_return_err_writes_null, make_bool_param_spec as create_param_spec,
    param_spec_refcount, read_slot, write_return_into_slot,
};

fn release_param_spec_refs(ptr: *mut c_void, count: u32) {
    for _ in 0..count {
        unsafe { glib::gobject_ffi::g_param_spec_unref(ptr.cast()) };
    }
}

fn object_value<'e>(env: &'e Env, pspec: *mut c_void) -> Unknown<'e> {
    External::new(Handle::from_glib_borrow(pspec))
        .into_unknown(env)
        .expect("into_unknown should succeed")
}

fn fundamental_with_fns(
    ownership: Ownership,
    ref_fn_name: &str,
    unref_fn_name: &str,
) -> FundamentalCodec {
    FundamentalCodec {
        ownership,
        shared_library: "libgobject-2.0.so.0".to_owned(),
        ref_fn_name: ref_fn_name.to_owned(),
        unref_fn_name: unref_fn_name.to_owned(),
    }
}

fn fundamental(ownership: Ownership) -> FundamentalCodec {
    fundamental_with_fns(ownership, "g_param_spec_ref", "g_param_spec_unref")
}

fn fundamental_without_ref_fn(ownership: Ownership) -> FundamentalCodec {
    fundamental_with_fns(ownership, "", "")
}

fn fundamental_without_unref_fn(ownership: Ownership) -> FundamentalCodec {
    fundamental_with_fns(ownership, "g_param_spec_ref", "")
}

fn fundamental_with_unresolvable_symbols(ownership: Ownership) -> FundamentalCodec {
    fundamental_with_fns(ownership, "gtkx_cov_missing_ref", "gtkx_cov_missing_unref")
}

fn fundamental_with_only_unref_fn(ownership: Ownership) -> FundamentalCodec {
    fundamental_with_fns(ownership, "", "g_param_spec_unref")
}

fn encode_param_spec(codec: &FundamentalCodec, pspec: *mut c_void) -> ffi::Stash {
    let env = helpers::fake_env();
    codec
        .encode(&env, object_value(&env, pspec))
        .expect("encode should succeed")
}

fn assert_encode_returns_plain_pointer(codec: &FundamentalCodec, expected_extra_refs: u32) {
    let pspec = create_param_spec();
    let before = param_spec_refcount(pspec);

    let encoded = encode_param_spec(codec, pspec);
    assert!(matches!(encoded, ffi::Stash::Ptr(p) if p == pspec));
    assert_eq!(param_spec_refcount(pspec), before + expected_extra_refs);

    release_param_spec_refs(pspec, expected_extra_refs + 1);
}

fn assert_ref_for_transfer(codec: &FundamentalCodec, expected_extra_refs: u32) {
    let pspec = create_param_spec();
    let before = param_spec_refcount(pspec);

    let returned =
        unsafe { codec.ref_for_transfer(pspec) }.expect("ref_for_transfer should succeed");
    assert_eq!(returned, pspec);
    assert_eq!(param_spec_refcount(pspec), before + expected_extra_refs);

    release_param_spec_refs(pspec, expected_extra_refs + 1);
}

fn write_return_of_fresh_param_spec(codec: &FundamentalCodec) -> (*mut c_void, u32, *mut c_void) {
    let pspec = create_param_spec();
    let before = param_spec_refcount(pspec);

    let env = helpers::fake_env();
    let slot = write_return_into_slot(&env, codec, &Ok(object_value(&env, pspec)));

    (pspec, before, slot)
}

fn assert_write_return_writes_pointer(codec: &FundamentalCodec, expected_extra_refs: u32) {
    let (pspec, before, slot) = write_return_of_fresh_param_spec(codec);

    assert_eq!(slot, pspec);
    assert_eq!(param_spec_refcount(pspec), before + expected_extra_refs);

    release_param_spec_refs(pspec, expected_extra_refs + 1);
}

fn assert_write_return_writes_null_and_reports(
    codec: &FundamentalCodec,
    expected_in_message: &str,
) {
    let (pspec, before, slot) = write_return_of_fresh_param_spec(codec);

    assert!(
        slot.is_null(),
        "a transfer-full fundamental return without a usable ref function must not alias ownership"
    );
    assert_eq!(param_spec_refcount(pspec), before);
    let fatals = napi_mock::fatal_exceptions();
    assert_eq!(fatals.len(), 1);
    let message = napi_mock::read_object_property(fatals[0], "message")
        .and_then(napi_mock::read_string)
        .expect("the fatal exception should carry a message");
    assert!(message.contains(expected_in_message));

    release_param_spec_refs(pspec, 1);
}

#[test]
fn lookup_fns_resolves_ref_and_unref() {
    helpers::run(|| {
        let (ref_fn, unref_fn) = fundamental(Ownership::Borrowed)
            .lookup_fns()
            .expect("lookup_fns should succeed");
        assert!(ref_fn.is_some());
        assert!(unref_fn.is_some());
    });
}

#[test]
fn encode_full_adds_exactly_one_ref() {
    helpers::run(|| {
        let pspec = create_param_spec();
        let before = param_spec_refcount(pspec);

        let encoded = encode_param_spec(&fundamental(Ownership::Full), pspec);
        encoded.disarm_pending_transfer();
        assert!(matches!(&encoded, ffi::Stash::Storage(s) if s.ptr() == pspec));
        assert_eq!(param_spec_refcount(pspec), before + 1);

        release_param_spec_refs(pspec, 2);
    });
}

#[test]
fn encode_full_releases_reference_when_call_never_happens() {
    helpers::run(|| {
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
    helpers::run(|| {
        assert_encode_returns_plain_pointer(&fundamental(Ownership::Borrowed), 0);
    });
}

#[test]
fn encode_full_null_pointer_stays_null() {
    helpers::run(|| {
        helpers::assert_encode_null_yields_null_ptr(&fundamental(Ownership::Full));
    });
}

#[test]
fn ref_for_transfer_full_adds_one_ref() {
    helpers::run(|| {
        assert_ref_for_transfer(&fundamental(Ownership::Full), 1);
    });
}

#[test]
fn ref_for_transfer_borrowed_keeps_refcount() {
    helpers::run(|| {
        assert_ref_for_transfer(&fundamental(Ownership::Borrowed), 0);
    });
}

#[test]
fn encode_full_without_unref_fn_returns_referenced_pointer() {
    helpers::run(|| {
        assert_encode_returns_plain_pointer(&fundamental_without_unref_fn(Ownership::Full), 1);
    });
}

#[test]
fn transfer_release_borrowed_is_none() {
    helpers::run(|| {
        assert!(
            fundamental(Ownership::Borrowed)
                .transfer_release()
                .is_none()
        );
    });
}

#[test]
fn transfer_release_full_without_fns_is_none() {
    helpers::run(|| {
        assert!(
            fundamental_without_ref_fn(Ownership::Full)
                .transfer_release()
                .is_none()
        );
    });
}

#[test]
fn transfer_release_full_with_unresolvable_symbols_is_none() {
    helpers::run(|| {
        assert!(
            fundamental_with_unresolvable_symbols(Ownership::Full)
                .transfer_release()
                .is_none()
        );
    });
}

#[test]
fn transfer_release_full_releases_one_reference() {
    helpers::run(|| {
        let release = fundamental(Ownership::Full)
            .transfer_release()
            .expect("full transfer_release should yield a release");
        assert!(matches!(release, ffi::ReleaseKind::Fundamental(_)));

        let pspec = create_param_spec();
        unsafe { glib::gobject_ffi::g_param_spec_ref(pspec.cast()) };
        let before = param_spec_refcount(pspec);

        ffi::PendingTransfer::new(pspec, release).release_now();
        assert_eq!(param_spec_refcount(pspec), before - 1);

        release_param_spec_refs(pspec, 1);
    });
}

#[test]
fn ref_for_transfer_full_without_ref_fn_keeps_pointer() {
    helpers::run(|| {
        assert_ref_for_transfer(&fundamental_without_ref_fn(Ownership::Full), 0);
    });
}

#[test]
fn encode_full_without_ref_fn_keeps_pointer() {
    helpers::run(|| {
        assert_encode_returns_plain_pointer(&fundamental_without_ref_fn(Ownership::Full), 0);
    });
}
#[test]
fn write_return_to_pointer_full_without_ref_fn_writes_plain_pointer() {
    helpers::run(|| {
        assert_write_return_writes_pointer(&fundamental_without_ref_fn(Ownership::Full), 0);
    });
}

#[test]
fn ref_for_transfer_full_null_is_noop() {
    helpers::run(|| {
        let returned =
            unsafe { fundamental(Ownership::Full).ref_for_transfer(std::ptr::null_mut()) }
                .expect("null ref_for_transfer should succeed");
        assert!(returned.is_null());
    });
}

#[test]
fn decode_borrowed_adds_exactly_one_ref() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let pspec = create_param_spec();
        let before = param_spec_refcount(pspec);

        let decoded = fundamental(Ownership::Borrowed)
            .decode(&env, &ffi::Stash::Ptr(pspec))
            .expect("borrowed decode should succeed");
        assert!(napi_mock::read_external(decoded.raw()).is_some());
        assert_eq!(param_spec_refcount(pspec), before + 1);

        napi_mock::collect(decoded.raw());
        assert_eq!(param_spec_refcount(pspec), before);

        release_param_spec_refs(pspec, 1);
    });
}

#[test]
fn decode_full_takes_ownership() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let pspec = create_param_spec();
        let before = param_spec_refcount(pspec);

        let decoded = fundamental(Ownership::Full)
            .decode(&env, &ffi::Stash::Ptr(pspec))
            .expect("full decode should succeed");
        assert!(napi_mock::read_external(decoded.raw()).is_some());
        assert_eq!(param_spec_refcount(pspec), before);
    });
}

#[test]
fn decode_null_yields_null() {
    helpers::run(|| {
        assert_decode_null_yields_null(&fundamental(Ownership::Borrowed));
    });
}

#[test]
fn ptr_to_value_wraps_fundamental() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let pspec = create_param_spec();
        let before = param_spec_refcount(pspec);

        let value =
            unsafe { fundamental(Ownership::Borrowed).read(&env, ReadSource::Value(pspec, "ctx")) }
                .expect("ptr_to_value should succeed");
        assert!(napi_mock::read_external(value.raw()).is_some());
        assert_eq!(param_spec_refcount(pspec), before + 1);

        release_param_spec_refs(pspec, 1);
    });
}

#[test]
fn ptr_to_value_null_yields_null() {
    helpers::run(|| {
        assert_read_null_yields_null(&fundamental(Ownership::Borrowed));
    });
}

#[test]
fn read_from_pointer_dereferences_slot() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let pspec = create_param_spec();

        let value = unsafe { read_slot(&env, &fundamental(Ownership::Borrowed), pspec) }
            .expect("read_from_pointer should succeed");
        assert!(napi_mock::read_external(value.raw()).is_some());
        release_param_spec_refs(pspec, 1);
    });
}

#[test]
fn write_return_to_pointer_full_transfer_writes_referenced_pointer() {
    helpers::run(|| {
        assert_write_return_writes_pointer(&fundamental(Ownership::Full), 1);
    });
}

#[test]
fn write_return_to_pointer_borrowed_keeps_refcount() {
    helpers::run(|| {
        assert_write_return_writes_pointer(&fundamental(Ownership::Borrowed), 0);
    });
}

#[test]
fn write_return_to_pointer_err_writes_null() {
    helpers::run(|| {
        assert_write_return_err_writes_null(&fundamental(Ownership::Borrowed));
    });
}

#[test]
fn write_return_to_pointer_full_unresolvable_symbols_writes_null_and_reports() {
    helpers::run(|| {
        assert_write_return_writes_null_and_reports(
            &fundamental_with_unresolvable_symbols(Ownership::Full),
            "gtkx_cov_missing_ref",
        );
    });
}

#[test]
fn write_return_to_pointer_full_unref_without_ref_writes_null_and_reports() {
    helpers::run(|| {
        assert_write_return_writes_null_and_reports(
            &fundamental_with_only_unref_fn(Ownership::Full),
            "g_param_spec_unref",
        );
    });
}

#[test]
fn write_return_to_pointer_full_resolvable_fns_ref_without_reporting() {
    helpers::run(|| {
        assert_write_return_writes_pointer(&fundamental(Ownership::Full), 1);
        assert!(napi_mock::fatal_exceptions().is_empty());
    });
}

#[test]
fn write_return_to_pointer_borrowed_unresolvable_symbols_writes_same_pointer() {
    helpers::run(|| {
        assert_write_return_writes_pointer(
            &fundamental_with_unresolvable_symbols(Ownership::Borrowed),
            0,
        );
        assert!(napi_mock::fatal_exceptions().is_empty());
    });
}

#[test]
fn write_value_to_pointer_writes_fundamental() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let pspec = create_param_spec();
        let before = param_spec_refcount(pspec);

        let slot = helpers::write_value_into_slot(
            &env,
            &fundamental(Ownership::Borrowed),
            std::ptr::null_mut(),
            object_value(&env, pspec),
        );

        assert_eq!(slot, pspec);
        assert_eq!(param_spec_refcount(pspec), before + 1);

        release_param_spec_refs(pspec, 2);
    });
}

#[test]
fn write_value_to_pointer_unrefs_previous_fundamental() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let old = create_param_spec();
        let new = create_param_spec();

        unsafe { glib::gobject_ffi::g_param_spec_ref(old.cast()) };
        let old_before = param_spec_refcount(old);
        let new_before = param_spec_refcount(new);

        let slot = helpers::write_value_into_slot(
            &env,
            &fundamental(Ownership::Borrowed),
            old,
            object_value(&env, new),
        );

        assert_eq!(slot, new);
        assert_eq!(param_spec_refcount(new), new_before + 1);
        assert_eq!(param_spec_refcount(old), old_before - 1);

        release_param_spec_refs(new, 2);
        release_param_spec_refs(old, 1);
    });
}

#[test]
fn write_value_to_pointer_null_releases_previous_fundamental() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let pspec = create_param_spec();

        unsafe { glib::gobject_ffi::g_param_spec_ref(pspec.cast()) };
        let before = param_spec_refcount(pspec);

        let slot = helpers::write_value_into_slot(
            &env,
            &fundamental(Ownership::Borrowed),
            pspec,
            napi_mock::to_unknown(&env, napi_mock::fake_null()),
        );

        assert!(slot.is_null());
        assert_eq!(param_spec_refcount(pspec), before - 1);

        release_param_spec_refs(pspec, 1);
    });
}

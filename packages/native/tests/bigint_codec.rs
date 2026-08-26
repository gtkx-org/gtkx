use std::ffi::c_void;

use napi::JsValue as _;
use napi::sys::napi_value;
use native::ffi::codec::{BigIntCodec, Decoder, Encoder, PtrWriter, ReadCtx, SlotInit};
use native::ffi::{self, Slot, StashData};
use test_support as helpers;
use test_support::napi_mock;

fn assert_encodes_i64(build: impl FnOnce() -> napi_value, expected: i64) {
    helpers::run(move || {
        let env = helpers::fake_env();
        let stash = BigIntCodec::I64
            .encode(&env, napi_mock::to_unknown(&env, build()))
            .expect("i64 encode should succeed");
        assert!(matches!(stash, ffi::Stash::I64(actual) if actual == expected));
    });
}

fn assert_encodes_u64(build: impl FnOnce() -> napi_value, expected: u64) {
    helpers::run(move || {
        let env = helpers::fake_env();
        let stash = BigIntCodec::U64
            .encode(&env, napi_mock::to_unknown(&env, build()))
            .expect("u64 encode should succeed");
        assert!(matches!(stash, ffi::Stash::U64(actual) if actual == expected));
    });
}

fn assert_encode_errors(codec: BigIntCodec, build: impl FnOnce() -> napi_value) {
    helpers::run(move || {
        let env = helpers::fake_env();
        assert!(
            codec
                .encode(&env, napi_mock::to_unknown(&env, build()))
                .is_err()
        );
    });
}

fn assert_decodes_bigint(codec: BigIntCodec, build: impl FnOnce() -> ffi::Stash, expected: i128) {
    helpers::run(move || {
        let env = helpers::fake_env();
        let value = codec.decode(&env, &build()).expect("decode should succeed");
        assert_eq!(napi_mock::read_bigint_i128(value.raw()), Some(expected));
    });
}

fn assert_decode_errors(codec: BigIntCodec, build: impl FnOnce() -> ffi::Stash) {
    helpers::run(move || {
        let env = helpers::fake_env();
        assert!(codec.decode(&env, &build()).is_err());
    });
}

fn assert_reads_value(codec: BigIntCodec, bits: usize, expected: i128) {
    helpers::run(move || {
        let env = helpers::fake_env();
        let ptr = std::ptr::without_provenance_mut::<c_void>(bits);
        let value = unsafe { codec.read(&env, ReadCtx::value(ptr, "ctx")) }
            .expect("read from Value should succeed");
        assert_eq!(napi_mock::read_bigint_i128(value.raw()), Some(expected));
    });
}

fn assert_reads_slot(codec: BigIntCodec, bits: usize, expected: i128) {
    helpers::run(move || {
        let env = helpers::fake_env();
        let ptr = std::ptr::without_provenance_mut::<c_void>(bits);
        let value = unsafe { helpers::read_slot(&env, &codec, ptr) }
            .expect("read from Slot should succeed");
        assert_eq!(napi_mock::read_bigint_i128(value.raw()), Some(expected));
    });
}

fn assert_to_stash_storage_errors(codec: BigIntCodec, build: impl FnOnce() -> Vec<napi_value>) {
    helpers::run(move || {
        let env = helpers::fake_env();
        let values: Vec<_> = build()
            .into_iter()
            .map(|raw| napi_mock::to_unknown(&env, raw))
            .collect();
        assert!(codec.to_stash_storage(&values).is_err());
    });
}

fn assert_write_return_i64(build: impl FnOnce() -> Result<napi_value, ()>, expected: isize) {
    helpers::run(move || {
        let env = helpers::fake_env();
        let value = build().map(|raw| napi_mock::to_unknown(&env, raw));
        let slot = helpers::write_return_into_slot(&env, &BigIntCodec::I64, &value);
        assert_eq!(slot.addr().cast_signed(), expected);
    });
}

fn assert_write_return_u64(build: impl FnOnce() -> Result<napi_value, ()>, expected: u64) {
    helpers::run(move || {
        let env = helpers::fake_env();
        let value = build().map(|raw| napi_mock::to_unknown(&env, raw));
        let slot = helpers::write_return_into_slot(&env, &BigIntCodec::U64, &value);
        assert_eq!(slot.addr() as u64, expected);
    });
}

fn assert_write_value_i64(build: impl FnOnce() -> napi_value, expected: isize) {
    helpers::run(move || {
        let env = helpers::fake_env();
        let value = napi_mock::to_unknown(&env, build());
        let slot =
            helpers::write_value_into_slot(&env, &BigIntCodec::I64, std::ptr::null_mut(), value);
        assert_eq!(slot.addr().cast_signed(), expected);
    });
}

fn assert_write_value_u64(build: impl FnOnce() -> napi_value, expected: u64) {
    helpers::run(move || {
        let env = helpers::fake_env();
        let value = napi_mock::to_unknown(&env, build());
        let slot =
            helpers::write_value_into_slot(&env, &BigIntCodec::U64, std::ptr::null_mut(), value);
        assert_eq!(slot.addr() as u64, expected);
    });
}

fn assert_write_value_errors(codec: BigIntCodec, build: impl FnOnce() -> napi_value) {
    helpers::run(move || {
        let env = helpers::fake_env();
        let mut backing: *mut c_void = std::ptr::null_mut();
        let slot = unsafe { Slot::new((&raw mut backing).cast::<c_void>()) };
        assert!(
            codec
                .write_value_to_ptr(
                    &env,
                    slot,
                    napi_mock::to_unknown(&env, build()),
                    SlotInit::Initialized
                )
                .is_err()
        );
    });
}

#[test]
fn encode_i64_from_bigint() {
    assert_encodes_i64(
        || napi_mock::fake_bigint_i128(-5_000_000_000),
        -5_000_000_000,
    );
}

#[test]
fn encode_i64_from_number() {
    assert_encodes_i64(|| napi_mock::fake_double(42.0), 42);
}

#[test]
fn encode_i64_max_bigint() {
    assert_encodes_i64(
        || napi_mock::fake_bigint_i128(i128::from(i64::MAX)),
        i64::MAX,
    );
}

#[test]
fn encode_i64_from_null_yields_zero() {
    assert_encodes_i64(napi_mock::fake_null, 0);
}

#[test]
fn encode_u64_from_bigint() {
    assert_encodes_u64(|| napi_mock::fake_bigint_i128(9_000_000_000), 9_000_000_000);
}

#[test]
fn encode_u64_from_number() {
    assert_encodes_u64(|| napi_mock::fake_double(7.0), 7);
}

#[test]
fn encode_u64_max_bigint() {
    assert_encodes_u64(
        || napi_mock::fake_bigint_i128(i128::from(u64::MAX)),
        u64::MAX,
    );
}

#[test]
fn encode_u64_from_undefined_yields_zero() {
    assert_encodes_u64(napi_mock::fake_undefined, 0);
}

#[test]
fn encode_i64_overflow_errors() {
    assert_encode_errors(BigIntCodec::I64, || {
        napi_mock::fake_bigint_i128(i128::from(i64::MAX) + 1)
    });
}

#[test]
fn encode_i64_underflow_errors() {
    assert_encode_errors(BigIntCodec::I64, || {
        napi_mock::fake_bigint_i128(i128::from(i64::MIN) - 1)
    });
}

#[test]
fn encode_u64_negative_errors() {
    assert_encode_errors(BigIntCodec::U64, || napi_mock::fake_bigint_i128(-1));
}

#[test]
fn encode_u64_overflow_errors() {
    assert_encode_errors(BigIntCodec::U64, || {
        napi_mock::fake_bigint_i128(i128::from(u64::MAX) + 1)
    });
}

#[test]
fn encode_non_integer_number_errors() {
    assert_encode_errors(BigIntCodec::I64, || napi_mock::fake_double(1.5));
}

#[test]
fn encode_non_finite_number_errors() {
    assert_encode_errors(BigIntCodec::I64, || napi_mock::fake_double(f64::INFINITY));
}

#[test]
fn encode_number_above_safe_range_errors() {
    assert_encode_errors(BigIntCodec::I64, || napi_mock::fake_double(1e16));
}

#[test]
fn encode_number_below_safe_range_errors() {
    assert_encode_errors(BigIntCodec::I64, || napi_mock::fake_double(-1e16));
}

#[test]
fn encode_wrong_type_errors() {
    assert_encode_errors(BigIntCodec::I64, || napi_mock::fake_bool(true));
}

#[test]
fn decode_i64_stash() {
    assert_decodes_bigint(
        BigIntCodec::I64,
        || ffi::Stash::I64(-9_000_000_000),
        -9_000_000_000,
    );
}

#[test]
fn decode_u64_stash() {
    assert_decodes_bigint(
        BigIntCodec::U64,
        || ffi::Stash::U64(9_000_000_000),
        9_000_000_000,
    );
}

#[test]
fn decode_reads_stash_variant_regardless_of_codec() {
    assert_decodes_bigint(BigIntCodec::I64, || ffi::Stash::U64(5), 5);
}

#[test]
fn decode_wrong_stash_errors() {
    assert_decode_errors(BigIntCodec::I64, || ffi::Stash::I32(5));
}

#[test]
fn read_value_i64_positive() {
    assert_reads_value(BigIntCodec::I64, 100, 100);
}

#[test]
fn read_value_i64_negative() {
    assert_reads_value(BigIntCodec::I64, usize::MAX, -1);
}

#[test]
fn read_value_u64_full_range() {
    assert_reads_value(BigIntCodec::U64, usize::MAX, i128::from(u64::MAX));
}

#[test]
fn read_slot_i64_positive() {
    assert_reads_slot(BigIntCodec::I64, 4321, 4321);
}

#[test]
fn read_slot_i64_negative() {
    assert_reads_slot(BigIntCodec::I64, usize::MAX, -1);
}

#[test]
fn read_slot_u64_positive() {
    assert_reads_slot(BigIntCodec::U64, 9000, 9000);
}

#[test]
fn byte_size_i64_is_eight() {
    assert_eq!(BigIntCodec::I64.byte_size(), 8);
}

#[test]
fn byte_size_u64_is_eight() {
    assert_eq!(BigIntCodec::U64.byte_size(), 8);
}

#[test]
fn read_slice_i64_reads_each_element() {
    helpers::run(|| {
        let data: [i64; 3] = [-1, 0, 5_000_000_000];
        let values = unsafe { BigIntCodec::I64.read_slice(data.as_ptr().cast(), data.len()) };
        assert_eq!(values, vec![-1i128, 0, 5_000_000_000]);
    });
}

#[test]
fn read_slice_u64_reads_each_element() {
    helpers::run(|| {
        let data: [u64; 2] = [0, 9_000_000_000];
        let values = unsafe { BigIntCodec::U64.read_slice(data.as_ptr().cast(), data.len()) };
        assert_eq!(values, vec![0i128, 9_000_000_000]);
    });
}

#[test]
fn read_slice_empty_yields_no_values() {
    helpers::run(|| {
        let data: [i64; 1] = [7];
        let values = unsafe { BigIntCodec::I64.read_slice(data.as_ptr().cast(), 0) };
        assert!(values.is_empty());
    });
}

#[test]
fn to_stash_storage_i64_collects_values() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let array = [
            napi_mock::to_unknown(&env, napi_mock::fake_bigint_i128(-1)),
            napi_mock::to_unknown(&env, napi_mock::fake_bigint_i128(2)),
            napi_mock::to_unknown(&env, napi_mock::fake_double(3.0)),
        ];
        let storage = BigIntCodec::I64
            .to_stash_storage(&array)
            .expect("i64 storage should succeed");
        match storage.data() {
            StashData::I64Vec(vec) => assert_eq!(vec, &vec![-1i64, 2, 3]),
            _ => panic!("expected I64Vec"),
        }
    });
}

#[test]
fn to_stash_storage_u64_collects_values() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let array = [
            napi_mock::to_unknown(&env, napi_mock::fake_bigint_i128(1)),
            napi_mock::to_unknown(&env, napi_mock::fake_double(2.0)),
        ];
        let storage = BigIntCodec::U64
            .to_stash_storage(&array)
            .expect("u64 storage should succeed");
        match storage.data() {
            StashData::U64Vec(vec) => assert_eq!(vec, &vec![1u64, 2]),
            _ => panic!("expected U64Vec"),
        }
    });
}

#[test]
fn to_stash_storage_i64_overflow_errors() {
    assert_to_stash_storage_errors(BigIntCodec::I64, || {
        vec![napi_mock::fake_bigint_i128(i128::from(i64::MAX) + 1)]
    });
}

#[test]
fn to_stash_storage_u64_negative_errors() {
    assert_to_stash_storage_errors(BigIntCodec::U64, || vec![napi_mock::fake_bigint_i128(-1)]);
}

#[test]
fn to_stash_storage_element_type_errors() {
    assert_to_stash_storage_errors(BigIntCodec::I64, || vec![napi_mock::fake_bool(true)]);
}

#[test]
fn write_return_i64_ok_writes_value() {
    assert_write_return_i64(|| Ok(napi_mock::fake_bigint_i128(42)), 42);
}

#[test]
fn write_return_i64_err_writes_zero() {
    assert_write_return_i64(|| Err(()), 0);
}

#[test]
fn write_return_i64_out_of_range_writes_zero() {
    assert_write_return_i64(
        || Ok(napi_mock::fake_bigint_i128(i128::from(i64::MAX) + 1)),
        0,
    );
}

#[test]
fn write_return_u64_ok_writes_value() {
    assert_write_return_u64(|| Ok(napi_mock::fake_bigint_i128(9)), 9);
}

#[test]
fn write_return_u64_out_of_range_writes_zero() {
    assert_write_return_u64(|| Ok(napi_mock::fake_bigint_i128(-1)), 0);
}

#[test]
fn write_value_i64_writes_scalar() {
    assert_write_value_i64(|| napi_mock::fake_bigint_i128(-7), -7);
}

#[test]
fn write_value_u64_writes_scalar() {
    assert_write_value_u64(|| napi_mock::fake_bigint_i128(9_000_000_000), 9_000_000_000);
}

#[test]
fn write_value_out_of_range_errors() {
    assert_write_value_errors(BigIntCodec::U64, || napi_mock::fake_bigint_i128(-1));
}

#[test]
fn write_value_wrong_type_errors() {
    assert_write_value_errors(BigIntCodec::I64, || napi_mock::fake_bool(true));
}

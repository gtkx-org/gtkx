use std::ffi::{c_char, c_void};
use std::ptr;

use napi::sys;

use test_support::napi_mock;

#[test]
fn mock_intercepts_and_round_trips_napi_calls() {
    test_support::run(|| {
        let env = test_support::fake_env();

        let mut created: sys::napi_value = ptr::null_mut();
        let status = unsafe { sys::napi_create_double(env.raw(), 3.5, &raw mut created) };
        assert_eq!(status, sys::Status::napi_ok);
        assert!(!created.is_null());

        let mut back = 0.0;
        unsafe { sys::napi_get_value_double(env.raw(), created, &raw mut back) };
        assert!((back - 3.5).abs() < f64::EPSILON);

        let mut kind: sys::napi_valuetype = -1;
        unsafe { sys::napi_typeof(env.raw(), created, &raw mut kind) };
        assert_eq!(kind, sys::ValueType::napi_number);

        assert!(napi_mock::count("napi_create_double") >= 1);
        assert!(napi_mock::count("napi_get_value_double") >= 1);
    });
}

#[test]
fn value_getters_report_type_mismatch_statuses() {
    test_support::run(|| {
        let env = test_support::fake_env();
        let string = napi_mock::fake_string("nope");
        let number = napi_mock::fake_double(1.5);

        let mut double_out = 7.0;
        let status = unsafe { sys::napi_get_value_double(env.raw(), string, &raw mut double_out) };
        assert_eq!(status, sys::Status::napi_number_expected);
        assert!((double_out - 7.0).abs() < f64::EPSILON);

        let mut int_out = 7;
        let status = unsafe { sys::napi_get_value_int32(env.raw(), string, &raw mut int_out) };
        assert_eq!(status, sys::Status::napi_number_expected);

        let mut uint_out = 7u32;
        let status = unsafe { sys::napi_get_value_uint32(env.raw(), string, &raw mut uint_out) };
        assert_eq!(status, sys::Status::napi_number_expected);

        let mut bool_out = true;
        let status = unsafe { sys::napi_get_value_bool(env.raw(), number, &raw mut bool_out) };
        assert_eq!(status, sys::Status::napi_boolean_expected);

        let mut length = 0usize;
        let status = unsafe {
            sys::napi_get_value_string_utf8(env.raw(), number, ptr::null_mut(), 0, &raw mut length)
        };
        assert_eq!(status, sys::Status::napi_string_expected);

        let mut word_count = 0usize;
        let status = unsafe {
            sys::napi_get_value_bigint_words(
                env.raw(),
                number,
                ptr::null_mut(),
                &raw mut word_count,
                ptr::null_mut(),
            )
        };
        assert_eq!(status, sys::Status::napi_bigint_expected);

        let mut int64_out = 0i64;
        let mut lossless = false;
        let status = unsafe {
            sys::napi_get_value_bigint_int64(
                env.raw(),
                number,
                &raw mut int64_out,
                &raw mut lossless,
            )
        };
        assert_eq!(status, sys::Status::napi_bigint_expected);

        let mut uint64_out = 0u64;
        let status = unsafe {
            sys::napi_get_value_bigint_uint64(
                env.raw(),
                number,
                &raw mut uint64_out,
                &raw mut lossless,
            )
        };
        assert_eq!(status, sys::Status::napi_bigint_expected);

        let mut external_out: *mut c_void = ptr::null_mut();
        let status =
            unsafe { sys::napi_get_value_external(env.raw(), number, &raw mut external_out) };
        assert_eq!(status, sys::Status::napi_invalid_arg);
    });
}

#[test]
fn property_access_on_null_or_undefined_reports_object_expected() {
    test_support::run(|| {
        let env = test_support::fake_env();
        let undefined = napi_mock::fake_undefined();
        let null = napi_mock::fake_null();
        let key = c"value".as_ptr();

        let mut out: sys::napi_value = ptr::null_mut();
        let status =
            unsafe { sys::napi_get_named_property(env.raw(), undefined, key, &raw mut out) };
        assert_eq!(status, sys::Status::napi_object_expected);

        let value = napi_mock::fake_double(1.0);
        let status = unsafe { sys::napi_set_named_property(env.raw(), null, key, value) };
        assert_eq!(status, sys::Status::napi_object_expected);

        let status = unsafe { sys::napi_get_element(env.raw(), undefined, 0, &raw mut out) };
        assert_eq!(status, sys::Status::napi_object_expected);

        let status = unsafe { sys::napi_set_element(env.raw(), null, 0, value) };
        assert_eq!(status, sys::Status::napi_object_expected);

        let status = unsafe { sys::napi_coerce_to_object(env.raw(), null, &raw mut out) };
        assert_eq!(status, sys::Status::napi_object_expected);
    });
}

#[test]
fn array_length_on_a_non_array_reports_array_expected() {
    test_support::run(|| {
        let env = test_support::fake_env();
        let object = napi_mock::fake_object(&[]);
        let mut length = 0u32;
        let status = unsafe { sys::napi_get_array_length(env.raw(), object, &raw mut length) };
        assert_eq!(status, sys::Status::napi_array_expected);
    });
}

#[test]
fn view_info_on_mismatched_values_reports_invalid_arg() {
    test_support::run(|| {
        let env = test_support::fake_env();
        let object = napi_mock::fake_object(&[]);

        let mut length = 0usize;
        let status = unsafe {
            sys::napi_get_typedarray_info(
                env.raw(),
                object,
                ptr::null_mut(),
                &raw mut length,
                ptr::null_mut(),
                ptr::null_mut(),
                ptr::null_mut(),
            )
        };
        assert_eq!(status, sys::Status::napi_invalid_arg);

        let status = unsafe {
            sys::napi_get_dataview_info(
                env.raw(),
                object,
                &raw mut length,
                ptr::null_mut(),
                ptr::null_mut(),
                ptr::null_mut(),
            )
        };
        assert_eq!(status, sys::Status::napi_invalid_arg);
    });
}

#[test]
fn call_function_on_a_non_function_reports_function_expected() {
    test_support::run(|| {
        let env = test_support::fake_env();
        let target = napi_mock::fake_double(1.0);
        let recv = napi_mock::fake_undefined();
        let mut out: sys::napi_value = ptr::null_mut();
        let status = unsafe {
            sys::napi_call_function(env.raw(), recv, target, 0, ptr::null(), &raw mut out)
        };
        assert_eq!(status, sys::Status::napi_function_expected);
        assert!(out.is_null());
    });
}

#[test]
fn reference_unref_at_zero_reports_generic_failure() {
    test_support::run(|| {
        let env = test_support::fake_env();
        let object = napi_mock::fake_object(&[]);
        let mut ref_: sys::napi_ref = ptr::null_mut();
        let status = unsafe { sys::napi_create_reference(env.raw(), object, 0, &raw mut ref_) };
        assert_eq!(status, sys::Status::napi_ok);

        let mut count = 42u32;
        let status = unsafe { sys::napi_reference_unref(env.raw(), ref_, &raw mut count) };
        assert_eq!(status, sys::Status::napi_generic_failure);
        assert_eq!(count, 42);
        assert_eq!(napi_mock::reference_count(ref_), Some(0));
    });
}

#[test]
fn string_getter_with_zero_capacity_writes_nothing() {
    test_support::run(|| {
        let env = test_support::fake_env();
        let value = napi_mock::fake_string("hi");
        let mut buf: [c_char; 4] = [0x7F; 4];
        let mut written = 99usize;
        let status = unsafe {
            sys::napi_get_value_string_utf8(env.raw(), value, buf.as_mut_ptr(), 0, &raw mut written)
        };
        assert_eq!(status, sys::Status::napi_ok);
        assert_eq!(written, 0);
        assert_eq!(buf[0], 0x7F);
    });
}

#[test]
fn bigint_words_reports_the_total_needed_word_count() {
    test_support::run(|| {
        let env = test_support::fake_env();
        let value = napi_mock::fake_bigint_i128(1);

        let mut count = 0usize;
        let status = unsafe {
            sys::napi_get_value_bigint_words(
                env.raw(),
                value,
                ptr::null_mut(),
                &raw mut count,
                ptr::null_mut(),
            )
        };
        assert_eq!(status, sys::Status::napi_ok);
        assert_eq!(count, 2);

        let mut words = [0u64; 1];
        let mut sign = -1;
        count = 1;
        let status = unsafe {
            sys::napi_get_value_bigint_words(
                env.raw(),
                value,
                &raw mut sign,
                &raw mut count,
                words.as_mut_ptr(),
            )
        };
        assert_eq!(status, sys::Status::napi_ok);
        assert_eq!(count, 2);
        assert_eq!(words[0], 1);
        assert_eq!(sign, 0);
    });
}

#[test]
fn read_bigint_round_trips_i128_min() {
    test_support::run(|| {
        let value = napi_mock::fake_bigint_i128(i128::MIN);
        assert_eq!(napi_mock::read_bigint_i128(value), Some(i128::MIN));
    });
}

#[test]
fn read_bigint_handles_magnitudes_at_the_i128_boundary() {
    test_support::run(|| {
        let env = test_support::fake_env();
        let words = [0u64, 1u64 << 63];

        let mut positive: sys::napi_value = ptr::null_mut();
        let status = unsafe {
            sys::napi_create_bigint_words(env.raw(), 0, 2, words.as_ptr(), &raw mut positive)
        };
        assert_eq!(status, sys::Status::napi_ok);
        assert_eq!(napi_mock::read_bigint_i128(positive), None);

        let mut negative: sys::napi_value = ptr::null_mut();
        let status = unsafe {
            sys::napi_create_bigint_words(env.raw(), 1, 2, words.as_ptr(), &raw mut negative)
        };
        assert_eq!(status, sys::Status::napi_ok);
        assert_eq!(napi_mock::read_bigint_i128(negative), Some(i128::MIN));
    });
}

#[test]
fn bigint_scalar_getters_wrap_and_report_losslessness() {
    test_support::run(|| {
        let env = test_support::fake_env();

        let two_pow_64_words = [0u64, 1u64];
        let mut two_pow_64: sys::napi_value = ptr::null_mut();
        unsafe {
            sys::napi_create_bigint_words(
                env.raw(),
                0,
                2,
                two_pow_64_words.as_ptr(),
                &raw mut two_pow_64,
            )
        };
        let mut int64_out = 5i64;
        let mut lossless = true;
        let status = unsafe {
            sys::napi_get_value_bigint_int64(
                env.raw(),
                two_pow_64,
                &raw mut int64_out,
                &raw mut lossless,
            )
        };
        assert_eq!(status, sys::Status::napi_ok);
        assert_eq!(int64_out, 0);
        assert!(!lossless);

        let minus_one_words = [1u64];
        let mut minus_one: sys::napi_value = ptr::null_mut();
        unsafe {
            sys::napi_create_bigint_words(
                env.raw(),
                1,
                1,
                minus_one_words.as_ptr(),
                &raw mut minus_one,
            )
        };
        let mut uint64_out = 0u64;
        lossless = true;
        let status = unsafe {
            sys::napi_get_value_bigint_uint64(
                env.raw(),
                minus_one,
                &raw mut uint64_out,
                &raw mut lossless,
            )
        };
        assert_eq!(status, sys::Status::napi_ok);
        assert_eq!(uint64_out, u64::MAX);
        assert!(!lossless);

        let mut int64_min: sys::napi_value = ptr::null_mut();
        let int64_min_words = [i64::MIN.unsigned_abs()];
        unsafe {
            sys::napi_create_bigint_words(
                env.raw(),
                1,
                1,
                int64_min_words.as_ptr(),
                &raw mut int64_min,
            )
        };
        lossless = false;
        let status = unsafe {
            sys::napi_get_value_bigint_int64(
                env.raw(),
                int64_min,
                &raw mut int64_out,
                &raw mut lossless,
            )
        };
        assert_eq!(status, sys::Status::napi_ok);
        assert_eq!(int64_out, i64::MIN);
        assert!(lossless);
    });
}

unsafe extern "C" fn bump_finalize_count(
    _env: sys::napi_env,
    data: *mut c_void,
    _hint: *mut c_void,
) {
    unsafe { *data.cast::<u32>() += 1 };
}

#[test]
fn collect_runs_the_external_finalizer_exactly_once() {
    test_support::run(|| {
        let env = test_support::fake_env();
        let mut finalized = 0u32;
        let mut external: sys::napi_value = ptr::null_mut();
        let status = unsafe {
            sys::napi_create_external(
                env.raw(),
                (&raw mut finalized).cast(),
                Some(bump_finalize_count),
                ptr::null_mut(),
                &raw mut external,
            )
        };
        assert_eq!(status, sys::Status::napi_ok);
        assert_eq!(finalized, 0);

        napi_mock::collect(external);
        assert_eq!(finalized, 1);

        napi_mock::collect(external);
        assert_eq!(finalized, 1);
    });
}

#[test]
fn shared_views_expose_a_non_arraybuffer_backing_buffer() {
    test_support::run(|| {
        let env = test_support::fake_env();
        let mut data = [0u8; 4];

        let shared = napi_mock::fake_shared_typed_array(
            sys::TypedarrayType::uint8_array,
            data.as_mut_ptr().cast(),
            4,
            0,
        );
        let plain = napi_mock::fake_typed_array(
            sys::TypedarrayType::uint8_array,
            data.as_mut_ptr().cast(),
            4,
            0,
        );

        for (view, expected_plain) in [(shared, false), (plain, true)] {
            let mut buffer: sys::napi_value = ptr::null_mut();
            let status = unsafe {
                sys::napi_get_typedarray_info(
                    env.raw(),
                    view,
                    ptr::null_mut(),
                    ptr::null_mut(),
                    ptr::null_mut(),
                    &raw mut buffer,
                    ptr::null_mut(),
                )
            };
            assert_eq!(status, sys::Status::napi_ok);
            let mut is_arraybuffer = !expected_plain;
            unsafe { sys::napi_is_arraybuffer(env.raw(), buffer, &raw mut is_arraybuffer) };
            assert_eq!(is_arraybuffer, expected_plain);
        }
    });
}

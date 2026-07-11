use test_support as helpers;
use test_support::napi_mock;

use std::ffi::c_void;

use libffi::middle;
use native::ffi::Slot;
use native::ffi::codec::{Decoder, Encoder, FloatCodec, IntegerCodec, PtrWriter, ReadSource};
use native::ffi::{self};

use napi::Env;
use napi::JsValue as _;
use napi::bindgen_prelude::{External, Unknown};

fn double<'e>(env: &'e Env, value: f64) -> Unknown<'e> {
    napi_mock::to_unknown(env, napi_mock::fake_double(value))
}

#[test]
fn integer_dispatch_ffi_type_u8() {
    let kind = IntegerCodec::U8;
    let ffi_type = kind.ffi_type();
    assert_eq!(
        ffi_type.as_raw_ptr(),
        libffi::middle::Type::u8().as_raw_ptr()
    );
}

#[test]
fn integer_dispatch_ffi_type_i64() {
    let kind = IntegerCodec::I64;
    let ffi_type = kind.ffi_type();
    assert_eq!(
        ffi_type.as_raw_ptr(),
        libffi::middle::Type::i64().as_raw_ptr()
    );
}

#[test]
fn integer_dispatch_read_slice() {
    let data: [u32; 3] = [100, 200, 300];
    let ptr = data.as_ptr() as *const u8;

    let result = unsafe { IntegerCodec::U32.read_slice(ptr, 3) };
    assert_eq!(result, vec![100.0, 200.0, 300.0]);
}

#[test]
fn integer_dispatch_read_slice_signed() {
    let data: [i16; 3] = [-100, 0, 100];
    let ptr = data.as_ptr() as *const u8;

    let result = unsafe { IntegerCodec::I16.read_slice(ptr, 3) };
    assert_eq!(result, vec![-100.0, 0.0, 100.0]);
}

#[test]
fn integer_kind_byte_size() {
    assert_eq!(IntegerCodec::U8.byte_size(), 1);
    assert_eq!(IntegerCodec::I8.byte_size(), 1);
    assert_eq!(IntegerCodec::U16.byte_size(), 2);
    assert_eq!(IntegerCodec::I16.byte_size(), 2);
    assert_eq!(IntegerCodec::U32.byte_size(), 4);
    assert_eq!(IntegerCodec::I32.byte_size(), 4);
    assert_eq!(IntegerCodec::U64.byte_size(), 8);
    assert_eq!(IntegerCodec::I64.byte_size(), 8);
}

#[test]
fn float_dispatch_ffi_type_f32() {
    let kind = FloatCodec::F32;
    let ffi_type = kind.ffi_type();
    assert_eq!(
        ffi_type.as_raw_ptr(),
        libffi::middle::Type::f32().as_raw_ptr()
    );
}

#[test]
fn float_dispatch_ffi_type_f64() {
    let kind = FloatCodec::F64;
    let ffi_type = kind.ffi_type();
    assert_eq!(
        ffi_type.as_raw_ptr(),
        libffi::middle::Type::f64().as_raw_ptr()
    );
}

#[test]
fn float_dispatch_read_ptr_f32() {
    let value: f32 = 3.125;
    let ptr = &value as *const f32 as *const u8;

    let result = unsafe { FloatCodec::F32.read_ptr(ptr) };
    assert!((result - 3.125).abs() < 0.001);
}

#[test]
fn float_dispatch_read_ptr_f64() {
    let value: f64 = std::f64::consts::E;
    let ptr = &value as *const f64 as *const u8;

    let result = unsafe { FloatCodec::F64.read_ptr(ptr) };
    assert!((result - std::f64::consts::E).abs() < 0.000_000_1);
}

#[test]
fn float_dispatch_write_ptr_f32() {
    let mut value: f32 = 0.0;
    let ptr = &mut value as *mut f32 as *mut u8;

    unsafe { FloatCodec::F32.write_ptr(ptr, 1.5) };
    assert!((value - 1.5).abs() < 0.001);
}

#[test]
fn float_dispatch_write_ptr_f64() {
    let mut value: f64 = 0.0;
    let ptr = &mut value as *mut f64 as *mut u8;

    unsafe { FloatCodec::F64.write_ptr(ptr, std::f64::consts::PI) };
    assert!((value - std::f64::consts::PI).abs() < 0.000_000_1);
}

const INTEGER_KINDS: [IntegerCodec; 8] = [
    IntegerCodec::U8,
    IntegerCodec::I8,
    IntegerCodec::U16,
    IntegerCodec::I16,
    IntegerCodec::U32,
    IntegerCodec::I32,
    IntegerCodec::U64,
    IntegerCodec::I64,
];

#[test]
fn integer_checked_to_stash_accepts_in_range() {
    for kind in INTEGER_KINDS {
        assert!(kind.checked_to_stash(1.0).is_ok());
        assert!(kind.checked_to_stash(0.0).is_ok());
    }
}

#[test]
fn integer_checked_to_stash_accepts_and_rejects() {
    let ok = IntegerCodec::U8.checked_to_stash_storage(&[1.0, 2.0, 3.0]);
    assert!(ok.is_ok());
    let bad = IntegerCodec::U8.checked_to_stash_storage(&[1.0, 999.0]);
    let err = bad.expect_err("out-of-range element should fail");
    assert!(err.to_string().contains("element 1"));
}

#[test]
fn integer_ptr_to_value_raw_round_trips() {
    for kind in INTEGER_KINDS {
        let value = kind
            .number_from_ptr_raw(8 as *mut c_void, "test")
            .expect("a small pointer payload converts losslessly");
        assert_eq!(value, 8.0);
    }
}

#[test]
fn integer_encode_accepts_number_object_and_optional_null() {
    helpers::run(|| {
        let env = helpers::fake_env();

        let encoded = Encoder::encode(&IntegerCodec::I32, &env, double(&env, 7.0)).unwrap();
        assert!(matches!(encoded, ffi::Stash::I32(7)));

        let handle = native::Handle::from_glib_borrow(16 as *mut c_void);
        let external = External::new(handle).into_unknown(&env).unwrap();
        let from_object = Encoder::encode(&IntegerCodec::I64, &env, external).unwrap();
        assert!(matches!(from_object, ffi::Stash::I64(16)));

        let optional = Encoder::encode(
            &IntegerCodec::I32,
            &env,
            napi_mock::to_unknown(&env, napi_mock::fake_null()),
        )
        .unwrap();
        assert!(matches!(optional, ffi::Stash::I32(0)));

        let optional_undef = Encoder::encode(
            &IntegerCodec::U32,
            &env,
            napi_mock::to_unknown(&env, napi_mock::fake_undefined()),
        )
        .unwrap();
        assert!(matches!(optional_undef, ffi::Stash::U32(0)));
    });
}

#[test]
fn integer_libffi_type_matches_ffi_type() {
    for kind in INTEGER_KINDS {
        assert_libffi_type_matches(kind);
    }
}

#[test]
fn integer_decode_reads_number_and_rejects_non_numeric() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let decoded = Decoder::decode(&IntegerCodec::I32, &env, &ffi::Stash::I32(42)).unwrap();
        assert_eq!(napi_mock::read_double(decoded.raw()), Some(42.0));
        assert!(Decoder::decode(&IntegerCodec::I32, &env, &ffi::Stash::Void).is_err());
    });
}

#[test]
fn integer_pointer_codec_round_trips() {
    helpers::run(|| {
        let env = helpers::fake_env();
        for kind in INTEGER_KINDS {
            let mut slot: i64 = 0;
            let ret = &mut slot as *mut i64 as *mut c_void;
            PtrWriter::write_return_to_ptr(
                &kind,
                &env,
                unsafe { Slot::new(ret) },
                &Ok(double(&env, 5.0)),
            );
            let read = unsafe {
                Decoder::read(&kind, &env, ReadSource::Slot(ret as *const c_void, "ctx"))
            }
            .unwrap();
            assert_eq!(napi_mock::read_double(read.raw()), Some(5.0));

            PtrWriter::write_return_to_ptr(&kind, &env, unsafe { Slot::new(ret) }, &Err(()));
            let zero = unsafe {
                Decoder::read(&kind, &env, ReadSource::Slot(ret as *const c_void, "ctx"))
            }
            .unwrap();
            assert_eq!(napi_mock::read_double(zero.raw()), Some(0.0));

            let mut field: i64 = 0;
            let field_ptr = &mut field as *mut i64 as *mut c_void;
            PtrWriter::write_value_to_ptr(
                &kind,
                &env,
                unsafe { Slot::new(field_ptr) },
                double(&env, 9.0),
            )
            .unwrap();
            let from_field =
                unsafe { Decoder::read(&kind, &env, ReadSource::Value(12 as *mut c_void, "ctx")) }
                    .unwrap();
            assert_eq!(napi_mock::read_double(from_field.raw()), Some(12.0));
            assert!(
                PtrWriter::write_value_to_ptr(
                    &kind,
                    &env,
                    unsafe { Slot::new(field_ptr) },
                    napi_mock::to_unknown(&env, napi_mock::fake_bool(true)),
                )
                .is_err()
            );
        }
    });
}

extern "C" fn ret_u8() -> u8 {
    8
}
extern "C" fn ret_i8() -> i8 {
    -8
}
extern "C" fn ret_u16() -> u16 {
    16
}
extern "C" fn ret_i16() -> i16 {
    -16
}
extern "C" fn ret_u32() -> u32 {
    32
}
extern "C" fn ret_i32() -> i32 {
    -32
}
extern "C" fn ret_u64() -> u64 {
    64
}
extern "C" fn ret_i64() -> i64 {
    -64
}
extern "C" fn ret_f32() -> f32 {
    1.5
}
extern "C" fn ret_f64() -> f64 {
    2.5
}

fn call_zero_arg(kind: IntegerCodec, code: *mut c_void) -> f64 {
    let cif = middle::Cif::new(Vec::new(), kind.ffi_type());
    let result = Encoder::call_cif(&kind, &cif, middle::CodePtr(code), &[]).unwrap();
    result.to_number().unwrap()
}

trait LibffiKind: Encoder + Copy {
    fn as_ffi_type(self) -> middle::Type;
}

impl LibffiKind for IntegerCodec {
    fn as_ffi_type(self) -> middle::Type {
        self.ffi_type()
    }
}

impl LibffiKind for FloatCodec {
    fn as_ffi_type(self) -> middle::Type {
        self.ffi_type()
    }
}

fn assert_libffi_type_matches<K>(kind: K)
where
    K: LibffiKind,
{
    let expected = kind.as_ffi_type().as_raw_ptr();
    assert_eq!(Encoder::libffi_type(&kind).as_raw_ptr(), expected);
}

unsafe fn assert_pointer_codec_round_trip<K>(
    env: &Env,
    kind: &K,
    slot: &mut [u8; 8],
    value_ptr: *mut c_void,
) where
    K: PtrWriter + Decoder,
{
    let ptr = slot.as_mut_ptr().cast::<c_void>();
    PtrWriter::write_value_to_ptr(kind, env, unsafe { Slot::new(ptr) }, double(env, 2.0)).unwrap();
    unsafe { Decoder::read(kind, env, ReadSource::Slot(ptr.cast_const(), "c")) }.unwrap();
    PtrWriter::write_return_to_ptr(kind, env, unsafe { Slot::new(ptr) }, &Ok(double(env, 1.0)));
    unsafe { Decoder::read(kind, env, ReadSource::Value(value_ptr, "c")) }.unwrap();
}

#[test]
fn integer_call_cif_invokes_native_functions() {
    assert_eq!(call_zero_arg(IntegerCodec::U8, ret_u8 as *mut c_void), 8.0);
    assert_eq!(call_zero_arg(IntegerCodec::I8, ret_i8 as *mut c_void), -8.0);
    assert_eq!(
        call_zero_arg(IntegerCodec::U16, ret_u16 as *mut c_void),
        16.0
    );
    assert_eq!(
        call_zero_arg(IntegerCodec::I16, ret_i16 as *mut c_void),
        -16.0
    );
    assert_eq!(
        call_zero_arg(IntegerCodec::U32, ret_u32 as *mut c_void),
        32.0
    );
    assert_eq!(
        call_zero_arg(IntegerCodec::I32, ret_i32 as *mut c_void),
        -32.0
    );
    assert_eq!(
        call_zero_arg(IntegerCodec::U64, ret_u64 as *mut c_void),
        64.0
    );
    assert_eq!(
        call_zero_arg(IntegerCodec::I64, ret_i64 as *mut c_void),
        -64.0
    );
}

#[test]
fn integer_call_return_covers_all_widths() {
    for (kind, code) in [
        (IntegerCodec::U8, ret_u8 as *mut c_void),
        (IntegerCodec::I8, ret_i8 as *mut c_void),
        (IntegerCodec::U16, ret_u16 as *mut c_void),
        (IntegerCodec::I16, ret_i16 as *mut c_void),
        (IntegerCodec::U32, ret_u32 as *mut c_void),
        (IntegerCodec::I32, ret_i32 as *mut c_void),
        (IntegerCodec::U64, ret_u64 as *mut c_void),
        (IntegerCodec::I64, ret_i64 as *mut c_void),
    ] {
        let cif = middle::Cif::new(Vec::new(), kind.ffi_type());
        let value = kind.call_return(&cif, middle::CodePtr(code), &[]);
        assert!(value.to_number().is_ok());
    }
}

#[test]
fn float_checked_to_stash_handles_range() {
    assert!(matches!(
        FloatCodec::F32.checked_to_stash(1.5).unwrap(),
        ffi::Stash::F32(_)
    ));
    assert!(FloatCodec::F32.checked_to_stash(1e40).is_err());
    assert!(FloatCodec::F32.checked_to_stash(-1e40).is_err());
    assert!(matches!(
        FloatCodec::F32.checked_to_stash(f64::INFINITY).unwrap(),
        ffi::Stash::F32(_)
    ));
    assert!(matches!(
        FloatCodec::F64.checked_to_stash(1e40).unwrap(),
        ffi::Stash::F64(_)
    ));
}

#[test]
fn float_ptr_to_value_raw_handles_null_and_value() {
    let value: f64 = 4.25;
    let ptr = &value as *const f64 as *mut c_void;
    assert!((unsafe { FloatCodec::F64.number_from_ptr_raw(ptr) } - 4.25).abs() < 1e-9);
    assert_eq!(
        unsafe { FloatCodec::F64.number_from_ptr_raw(std::ptr::null_mut()) },
        0.0
    );
    let f: f32 = 1.25;
    let fptr = &f as *const f32 as *mut c_void;
    assert!((unsafe { FloatCodec::F32.number_from_ptr_raw(fptr) } - 1.25).abs() < 1e-6);
}

#[test]
fn float_codec_encode_decode_and_raw_ptr() {
    helpers::run(|| {
        let env = helpers::fake_env();
        for kind in [FloatCodec::F32, FloatCodec::F64] {
            let encoded = Encoder::encode(&kind, &env, double(&env, 2.5)).unwrap();
            assert!(Decoder::decode(&kind, &env, &encoded).is_ok());
            assert!(
                Encoder::encode(
                    &kind,
                    &env,
                    napi_mock::to_unknown(&env, napi_mock::fake_null())
                )
                .is_ok()
            );
            assert!(
                Encoder::encode(
                    &kind,
                    &env,
                    napi_mock::to_unknown(&env, napi_mock::fake_bool(true))
                )
                .is_err()
            );
            assert_libffi_type_matches(kind);

            let mut slot: f64 = 0.0;
            let ret = &mut slot as *mut f64 as *mut c_void;
            PtrWriter::write_return_to_ptr(
                &kind,
                &env,
                unsafe { Slot::new(ret) },
                &Ok(double(&env, 1.0)),
            );
            assert!(
                unsafe { Decoder::read(&kind, &env, ReadSource::Slot(ret as *const c_void, "c")) }
                    .is_ok()
            );
            PtrWriter::write_return_to_ptr(&kind, &env, unsafe { Slot::new(ret) }, &Err(()));
            PtrWriter::write_value_to_ptr(
                &kind,
                &env,
                unsafe { Slot::new(ret) },
                double(&env, 3.0),
            )
            .unwrap();
            assert!(
                unsafe { Decoder::read(&kind, &env, ReadSource::Value(std::ptr::null_mut(), "c")) }
                    .is_ok()
            );
            assert!(
                PtrWriter::write_value_to_ptr(
                    &kind,
                    &env,
                    unsafe { Slot::new(ret) },
                    napi_mock::to_unknown(&env, napi_mock::fake_null()),
                )
                .is_ok()
            );
        }
    });
}

#[test]
fn float_call_cif_invokes_native_functions() {
    let cif32 = middle::Cif::new(Vec::new(), FloatCodec::F32.ffi_type());
    let r32 = Encoder::call_cif(
        &FloatCodec::F32,
        &cif32,
        middle::CodePtr(ret_f32 as *mut c_void),
        &[],
    )
    .unwrap();
    assert!((r32.to_number().unwrap() - 1.5).abs() < 1e-6);

    let cif64 = middle::Cif::new(Vec::new(), FloatCodec::F64.ffi_type());
    let r64 = FloatCodec::F64.call_return(&cif64, middle::CodePtr(ret_f64 as *mut c_void), &[]);
    assert!((r64.to_number().unwrap() - 2.5).abs() < 1e-9);
}

#[test]
fn enum_flags_encode_decode_and_libffi_type() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let enum_flags = helpers::enum_codec();
        let encoded = Encoder::encode(&enum_flags, &env, double(&env, 1.0)).unwrap();
        assert!(matches!(encoded, ffi::Stash::I32(1)));
        let decoded = Decoder::decode(&enum_flags, &env, &ffi::Stash::I32(1)).unwrap();
        assert_eq!(napi_mock::read_double(decoded.raw()), Some(1.0));
        assert_eq!(
            Encoder::libffi_type(&enum_flags).as_raw_ptr(),
            IntegerCodec::I32.ffi_type().as_raw_ptr()
        );
    });
}

#[test]
fn enum_flags_call_cif_invokes_native_function() {
    helpers::run(|| {
        let enum_flags = helpers::enum_codec();
        let cif = middle::Cif::new(Vec::new(), IntegerCodec::I32.ffi_type());
        let result = Encoder::call_cif(
            &enum_flags,
            &cif,
            middle::CodePtr(ret_i32 as *mut c_void),
            &[],
        )
        .unwrap();
        assert!(matches!(result, ffi::Stash::I32(-32)));
    });
}

#[test]
fn enum_flags_pointer_codec() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let enum_flags = helpers::enum_codec();
        let mut slot: i64 = 0;
        let ptr = &mut slot as *mut i64 as *mut c_void;
        PtrWriter::write_value_to_ptr(
            &enum_flags,
            &env,
            unsafe { Slot::new(ptr) },
            double(&env, 2.0),
        )
        .unwrap();
        let read = unsafe {
            Decoder::read(
                &enum_flags,
                &env,
                ReadSource::Slot(ptr as *const c_void, "c"),
            )
        }
        .unwrap();
        assert_eq!(napi_mock::read_double(read.raw()), Some(2.0));
        PtrWriter::write_return_to_ptr(
            &enum_flags,
            &env,
            unsafe { Slot::new(ptr) },
            &Ok(double(&env, 4.0)),
        );
        let from_ptr =
            unsafe { Decoder::read(&enum_flags, &env, ReadSource::Value(3 as *mut c_void, "c")) }
                .unwrap();
        assert_eq!(napi_mock::read_double(from_ptr.raw()), Some(3.0));
    });
}

#[test]
fn integer_dispatch_methods_cover_every_kind() {
    let buffer = [0u8; 64];
    for kind in INTEGER_KINDS {
        let _ = kind.ffi_type();

        let mut slot = [0u8; 8];
        unsafe { kind.write_ptr(slot.as_mut_ptr(), 3.0) };
        assert_eq!(unsafe { kind.read_ptr(slot.as_ptr()) }, 3.0);

        assert!(unsafe { kind.read_slice(buffer.as_ptr(), 2) }.len() == 2);

        let stash = kind.to_stash(1.0);
        assert!(stash.to_number().is_ok());
    }
}

#[test]
fn integer_codec_covers_every_kind() {
    helpers::run(|| {
        let env = helpers::fake_env();
        for kind in INTEGER_KINDS {
            kind.checked_to_stash(1.0).unwrap();
            assert!(kind.number_from_ptr_raw(4 as *mut c_void, "test").is_ok());

            let encoded = Encoder::encode(&kind, &env, double(&env, 1.0)).unwrap();
            Decoder::decode(&kind, &env, &encoded).unwrap();

            let mut slot = [0u8; 8];
            unsafe {
                assert_pointer_codec_round_trip(
                    &env,
                    &kind,
                    &mut slot,
                    std::ptr::dangling_mut::<c_void>(),
                );
            }
        }
    });
}

#[test]
fn float_codec_covers_every_kind() {
    helpers::run(|| {
        let env = helpers::fake_env();
        for kind in [FloatCodec::F32, FloatCodec::F64] {
            let _ = kind.ffi_type();
            let mut slot = [0u8; 8];
            unsafe { kind.write_ptr(slot.as_mut_ptr(), 1.5) };
            let _ = unsafe { kind.read_ptr(slot.as_ptr()) };
            kind.checked_to_stash(1.5).unwrap();
            assert_eq!(
                unsafe { kind.number_from_ptr_raw(std::ptr::null_mut()) },
                0.0
            );

            let encoded = Encoder::encode(&kind, &env, double(&env, 1.0)).unwrap();
            Decoder::decode(&kind, &env, &encoded).unwrap();

            unsafe {
                assert_pointer_codec_round_trip(&env, &kind, &mut slot, std::ptr::null_mut());
            }
        }
    });
}

#[test]
fn u64_read_beyond_2_53_errors_instead_of_rounding() {
    let env = helpers::fake_env();
    let stored: u64 = 9_007_199_254_740_993;
    let ptr = std::ptr::from_ref(&stored).cast::<c_void>();
    let err =
        unsafe { Decoder::read(&IntegerCodec::U64, &env, ReadSource::Slot(ptr, "test read")) }
            .map(|_| ())
            .expect_err("a u64 beyond 2^53 must not round silently");
    assert!(err.to_string().contains("2^53"));
    assert!(err.to_string().contains("test read"));
}

#[test]
fn i64_read_beyond_negative_2_53_errors_instead_of_rounding() {
    let env = helpers::fake_env();
    let stored: i64 = -9_007_199_254_740_993;
    let ptr = std::ptr::from_ref(&stored).cast::<c_void>();
    let err =
        unsafe { Decoder::read(&IntegerCodec::I64, &env, ReadSource::Slot(ptr, "test read")) }
            .map(|_| ())
            .expect_err("an i64 beyond -2^53 must not round silently");
    assert!(err.to_string().contains("2^53"));
}

#[test]
fn u64_read_at_2_53_still_converts() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let stored: u64 = 9_007_199_254_740_992;
        let ptr = std::ptr::from_ref(&stored).cast::<c_void>();
        let value =
            unsafe { Decoder::read(&IntegerCodec::U64, &env, ReadSource::Slot(ptr, "test read")) }
                .expect("2^53 itself is exactly representable");
        assert_eq!(
            napi_mock::read_double(value.raw()),
            Some(9_007_199_254_740_992.0)
        );
    });
}

#[test]
fn u64_pointer_payload_beyond_2_53_errors() {
    let err = IntegerCodec::U64
        .number_from_ptr_raw(usize::MAX as *mut c_void, "test pointer")
        .expect_err("a u64 pointer payload beyond 2^53 must not round silently");
    assert!(err.to_string().contains("2^53"));
}

#[test]
fn i64_pointer_payload_of_all_bits_set_is_minus_one() {
    let value = IntegerCodec::I64
        .number_from_ptr_raw(usize::MAX as *mut c_void, "test pointer")
        .expect("-1 is exactly representable");
    assert_eq!(value, -1.0);
}

#[test]
fn stash_to_number_guards_64_bit_payloads() {
    let err = ffi::Stash::U64(u64::MAX)
        .to_number()
        .expect_err("u64::MAX must not round silently");
    assert!(err.to_string().contains("2^53"));

    let err = ffi::Stash::I64(i64::MIN)
        .to_number()
        .expect_err("i64::MIN must not round silently");
    assert!(err.to_string().contains("2^53"));

    assert_eq!(ffi::Stash::U64(42).to_number().unwrap(), 42.0);
}

#[test]
fn u64_slice_read_beyond_2_53_errors() {
    let data: [u64; 2] = [1, 9_007_199_254_740_993];
    let err =
        unsafe { IntegerCodec::U64.checked_read_slice(data.as_ptr().cast(), 2, "test slice") }
            .expect_err("a 64-bit element beyond 2^53 must not round silently");
    assert!(err.to_string().contains("2^53"));

    let small: [u64; 2] = [1, 2];
    let values =
        unsafe { IntegerCodec::U64.checked_read_slice(small.as_ptr().cast(), 2, "test slice") }
            .expect("small 64-bit elements convert exactly");
    assert_eq!(values, vec![1.0, 2.0]);
}

#[test]
fn i64_slice_read_checked_converts_small_and_rejects_beyond_2_53() {
    let small: [i64; 3] = [-7, 0, 7];
    let values =
        unsafe { IntegerCodec::I64.checked_read_slice(small.as_ptr().cast(), 3, "test slice") }
            .expect("small 64-bit elements convert exactly");
    assert_eq!(values, vec![-7.0, 0.0, 7.0]);

    let big: [i64; 1] = [-9_007_199_254_740_993];
    let err = unsafe { IntegerCodec::I64.checked_read_slice(big.as_ptr().cast(), 1, "test slice") }
        .expect_err("a 64-bit element beyond -2^53 must not round silently");
    assert!(err.to_string().contains("2^53"));
}

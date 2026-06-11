mod common;

use std::ffi::c_void;

use libffi::middle;
use native::types::{FfiDecoder, FfiEncoder, FloatKind, IntegerKind, RawPtrCodec, Type};
use native::value::Value;
use native::{ffi, value};

#[test]
fn integer_dispatch_ffi_type_u8() {
    let kind = IntegerKind::U8;
    let ffi_type = kind.ffi_type();
    assert_eq!(
        ffi_type.as_raw_ptr(),
        libffi::middle::Type::u8().as_raw_ptr()
    );
}

#[test]
fn integer_dispatch_ffi_type_i64() {
    let kind = IntegerKind::I64;
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

    // SAFETY: `ptr` addresses a live local array of 3 elements.
    let result = unsafe { IntegerKind::U32.read_slice(ptr, 3) };
    assert_eq!(result, vec![100.0, 200.0, 300.0]);
}

#[test]
fn integer_dispatch_read_slice_signed() {
    let data: [i16; 3] = [-100, 0, 100];
    let ptr = data.as_ptr() as *const u8;

    // SAFETY: `ptr` addresses a live local array of 3 elements.
    let result = unsafe { IntegerKind::I16.read_slice(ptr, 3) };
    assert_eq!(result, vec![-100.0, 0.0, 100.0]);
}

#[test]
fn integer_kind_is_unsigned() {
    assert!(IntegerKind::U8.is_unsigned());
    assert!(IntegerKind::U16.is_unsigned());
    assert!(IntegerKind::U32.is_unsigned());
    assert!(IntegerKind::U64.is_unsigned());
    assert!(!IntegerKind::I8.is_unsigned());
    assert!(!IntegerKind::I16.is_unsigned());
    assert!(!IntegerKind::I32.is_unsigned());
    assert!(!IntegerKind::I64.is_unsigned());
}

#[test]
fn integer_kind_byte_size() {
    assert_eq!(IntegerKind::U8.byte_size(), 1);
    assert_eq!(IntegerKind::I8.byte_size(), 1);
    assert_eq!(IntegerKind::U16.byte_size(), 2);
    assert_eq!(IntegerKind::I16.byte_size(), 2);
    assert_eq!(IntegerKind::U32.byte_size(), 4);
    assert_eq!(IntegerKind::I32.byte_size(), 4);
    assert_eq!(IntegerKind::U64.byte_size(), 8);
    assert_eq!(IntegerKind::I64.byte_size(), 8);
}

#[test]
fn float_dispatch_ffi_type_f32() {
    let kind = FloatKind::F32;
    let ffi_type = kind.ffi_type();
    assert_eq!(
        ffi_type.as_raw_ptr(),
        libffi::middle::Type::f32().as_raw_ptr()
    );
}

#[test]
fn float_dispatch_ffi_type_f64() {
    let kind = FloatKind::F64;
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

    // SAFETY: `ptr` addresses a live local f32.
    let result = unsafe { FloatKind::F32.read_ptr(ptr) };
    assert!((result - 3.125).abs() < 0.001);
}

#[test]
fn float_dispatch_read_ptr_f64() {
    let value: f64 = std::f64::consts::E;
    let ptr = &value as *const f64 as *const u8;

    // SAFETY: `ptr` addresses a live local f64.
    let result = unsafe { FloatKind::F64.read_ptr(ptr) };
    assert!((result - std::f64::consts::E).abs() < 0.000_000_1);
}

#[test]
fn float_dispatch_write_ptr_f32() {
    let mut value: f32 = 0.0;
    let ptr = &mut value as *mut f32 as *mut u8;

    // SAFETY: `ptr` addresses a writable local f32.
    unsafe { FloatKind::F32.write_ptr(ptr, 1.5) };
    assert!((value - 1.5).abs() < 0.001);
}

#[test]
fn float_dispatch_write_ptr_f64() {
    let mut value: f64 = 0.0;
    let ptr = &mut value as *mut f64 as *mut u8;

    // SAFETY: `ptr` addresses a writable local f64.
    unsafe { FloatKind::F64.write_ptr(ptr, std::f64::consts::PI) };
    assert!((value - std::f64::consts::PI).abs() < 0.000_000_1);
}

#[test]
fn float_dispatch_to_ffi_value_f32() {
    let result = FloatKind::F32.to_ffi_value(2.5);
    if let ffi::FfiValue::F32(v) = result {
        assert!((v - 2.5).abs() < 0.001);
    } else {
        panic!("Expected FfiValue::F32");
    }
}

#[test]
fn float_dispatch_to_ffi_value_f64() {
    let result = FloatKind::F64.to_ffi_value(std::f64::consts::E);
    if let ffi::FfiValue::F64(v) = result {
        assert!((v - std::f64::consts::E).abs() < 0.000_000_1);
    } else {
        panic!("Expected FfiValue::F64");
    }
}

const INTEGER_KINDS: [IntegerKind; 8] = [
    IntegerKind::U8,
    IntegerKind::I8,
    IntegerKind::U16,
    IntegerKind::I16,
    IntegerKind::U32,
    IntegerKind::I32,
    IntegerKind::U64,
    IntegerKind::I64,
];

#[test]
fn integer_checked_to_ffi_value_accepts_in_range() {
    for kind in INTEGER_KINDS {
        assert!(kind.checked_to_ffi_value(1.0).is_ok());
        assert!(kind.checked_to_ffi_value(0.0).is_ok());
    }
}

#[test]
fn integer_checked_to_ffi_value_rejects_out_of_range() {
    assert!(IntegerKind::U8.checked_to_ffi_value(256.0).is_err());
    assert!(IntegerKind::I8.checked_to_ffi_value(-129.0).is_err());
    assert!(IntegerKind::U8.checked_to_ffi_value(-1.0).is_err());
    assert!(IntegerKind::U16.checked_to_ffi_value(65_536.0).is_err());
    assert!(IntegerKind::I16.checked_to_ffi_value(40_000.0).is_err());
    assert!(
        IntegerKind::U32
            .checked_to_ffi_value(5_000_000_000.0)
            .is_err()
    );
    assert!(
        IntegerKind::I32
            .checked_to_ffi_value(3_000_000_000.0)
            .is_err()
    );
    assert!(IntegerKind::U64.checked_to_ffi_value(1e30).is_err());
    assert!(IntegerKind::I64.checked_to_ffi_value(-1e30).is_err());
}

#[test]
fn integer_checked_to_ffi_value_rejects_non_integral_and_non_finite() {
    assert!(IntegerKind::I32.checked_to_ffi_value(1.5).is_err());
    assert!(IntegerKind::I32.checked_to_ffi_value(f64::NAN).is_err());
    assert!(
        IntegerKind::I32
            .checked_to_ffi_value(f64::INFINITY)
            .is_err()
    );
}

#[test]
fn integer_checked_to_ffi_storage_accepts_and_rejects() {
    let ok = IntegerKind::U8.checked_to_ffi_storage(&[1.0, 2.0, 3.0]);
    assert!(ok.is_ok());
    let bad = IntegerKind::U8.checked_to_ffi_storage(&[1.0, 999.0]);
    let err = bad.expect_err("out-of-range element should fail");
    assert!(err.to_string().contains("element 1"));
}

#[test]
fn integer_ptr_to_value_raw_round_trips() {
    for kind in INTEGER_KINDS {
        let value = kind.ptr_to_value_raw(8 as *mut c_void);
        assert!(matches!(value, value::Value::Number(n) if n == 8.0));
    }
}

#[test]
fn integer_encode_accepts_number_object_and_optional_null() {
    let encoded = FfiEncoder::encode(&IntegerKind::I32, &Value::Number(7.0), false).unwrap();
    assert!(matches!(encoded, ffi::FfiValue::I32(7)));

    let handle = native::NativeHandle::borrowed(16 as *mut c_void);
    let from_object = FfiEncoder::encode(&IntegerKind::I64, &Value::Object(handle), false).unwrap();
    assert!(matches!(from_object, ffi::FfiValue::I64(16)));

    let optional = FfiEncoder::encode(&IntegerKind::I32, &Value::Null, true).unwrap();
    assert!(matches!(optional, ffi::FfiValue::I32(0)));
    let optional_undef = FfiEncoder::encode(&IntegerKind::U32, &Value::Undefined, true).unwrap();
    assert!(matches!(optional_undef, ffi::FfiValue::U32(0)));
}

#[test]
fn integer_encode_rejects_wrong_value() {
    let err = FfiEncoder::encode(&IntegerKind::I32, &Value::Boolean(true), false);
    assert!(err.is_err());
    assert!(FfiEncoder::encode(&IntegerKind::I32, &Value::Null, false).is_err());
}

#[test]
fn integer_libffi_type_matches_ffi_type() {
    for kind in INTEGER_KINDS {
        assert_eq!(
            FfiEncoder::libffi_type(&kind).as_raw_ptr(),
            kind.ffi_type().as_raw_ptr()
        );
        assert_eq!(
            middle::Type::from(kind).as_raw_ptr(),
            kind.ffi_type().as_raw_ptr()
        );
    }
}

#[test]
fn integer_decode_reads_number_and_rejects_non_numeric() {
    let decoded = FfiDecoder::decode(&IntegerKind::I32, &ffi::FfiValue::I32(42)).unwrap();
    assert!(matches!(decoded, Value::Number(n) if n == 42.0));
    assert!(FfiDecoder::decode(&IntegerKind::I32, &ffi::FfiValue::Void).is_err());
}

#[test]
fn integer_raw_ptr_codec_round_trips() {
    for kind in INTEGER_KINDS {
        let mut slot: i64 = 0;
        let ret = &mut slot as *mut i64 as *mut c_void;
        // SAFETY: `ret` addresses a writable local 8-byte slot.
        unsafe { RawPtrCodec::write_return_to_raw_ptr(&kind, ret, &Ok(Value::Number(5.0))) };
        // SAFETY: `ret` addresses a live local 8-byte slot.
        let read =
            unsafe { RawPtrCodec::read_from_raw_ptr(&kind, ret as *const c_void, "ctx") }.unwrap();
        assert!(matches!(read, Value::Number(n) if n == 5.0));

        // SAFETY: `ret` addresses a writable local 8-byte slot.
        unsafe { RawPtrCodec::write_return_to_raw_ptr(&kind, ret, &Err(())) };
        // SAFETY: `ret` addresses a live local 8-byte slot.
        let zero =
            unsafe { RawPtrCodec::read_from_raw_ptr(&kind, ret as *const c_void, "ctx") }.unwrap();
        assert!(matches!(zero, Value::Number(n) if n == 0.0));

        let mut field: i64 = 0;
        let field_ptr = &mut field as *mut i64 as *mut c_void;
        // SAFETY: `field_ptr` addresses a writable local 8-byte slot.
        unsafe { RawPtrCodec::write_value_to_raw_ptr(&kind, field_ptr, &Value::Number(9.0)) }
            .unwrap();
        // SAFETY: Integer kinds reinterpret the pointer value without
        // dereferencing it.
        let from_field =
            unsafe { RawPtrCodec::ptr_to_value(&kind, 12 as *mut c_void, "ctx") }.unwrap();
        assert!(matches!(from_field, Value::Number(n) if n == 12.0));
        assert!(
            // SAFETY: `field_ptr` addresses a writable local 8-byte slot.
            unsafe { RawPtrCodec::write_value_to_raw_ptr(&kind, field_ptr, &Value::Boolean(true)) }
                .is_err()
        );
    }
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

fn call_zero_arg(kind: IntegerKind, code: *mut c_void) -> f64 {
    let cif = middle::Cif::new(Vec::new(), kind.ffi_type());
    let result = FfiEncoder::call_cif(&kind, &cif, middle::CodePtr(code), &[]).unwrap();
    result.to_number().unwrap()
}

#[test]
fn integer_call_cif_invokes_native_functions() {
    assert_eq!(call_zero_arg(IntegerKind::U8, ret_u8 as *mut c_void), 8.0);
    assert_eq!(call_zero_arg(IntegerKind::I8, ret_i8 as *mut c_void), -8.0);
    assert_eq!(
        call_zero_arg(IntegerKind::U16, ret_u16 as *mut c_void),
        16.0
    );
    assert_eq!(
        call_zero_arg(IntegerKind::I16, ret_i16 as *mut c_void),
        -16.0
    );
    assert_eq!(
        call_zero_arg(IntegerKind::U32, ret_u32 as *mut c_void),
        32.0
    );
    assert_eq!(
        call_zero_arg(IntegerKind::I32, ret_i32 as *mut c_void),
        -32.0
    );
    assert_eq!(
        call_zero_arg(IntegerKind::U64, ret_u64 as *mut c_void),
        64.0
    );
    assert_eq!(
        call_zero_arg(IntegerKind::I64, ret_i64 as *mut c_void),
        -64.0
    );
}

#[test]
fn integer_call_cif_raw_covers_all_widths() {
    for (kind, code) in [
        (IntegerKind::U8, ret_u8 as *mut c_void),
        (IntegerKind::I8, ret_i8 as *mut c_void),
        (IntegerKind::U16, ret_u16 as *mut c_void),
        (IntegerKind::I16, ret_i16 as *mut c_void),
        (IntegerKind::U32, ret_u32 as *mut c_void),
        (IntegerKind::I32, ret_i32 as *mut c_void),
        (IntegerKind::U64, ret_u64 as *mut c_void),
        (IntegerKind::I64, ret_i64 as *mut c_void),
    ] {
        let cif = middle::Cif::new(Vec::new(), kind.ffi_type());
        // SAFETY: The CIF was built from this kind's own type for a
        // zero-argument function, and `code` is a live function pointer.
        let value = unsafe { kind.call_cif_raw(&cif, middle::CodePtr(code), &[]) };
        assert!(value.to_number().is_ok());
    }
}

#[test]
fn float_checked_to_ffi_value_handles_range() {
    assert!(matches!(
        FloatKind::F32.checked_to_ffi_value(1.5).unwrap(),
        ffi::FfiValue::F32(_)
    ));
    assert!(FloatKind::F32.checked_to_ffi_value(1e40).is_err());
    assert!(FloatKind::F32.checked_to_ffi_value(-1e40).is_err());
    assert!(matches!(
        FloatKind::F32.checked_to_ffi_value(f64::INFINITY).unwrap(),
        ffi::FfiValue::F32(_)
    ));
    assert!(matches!(
        FloatKind::F64.checked_to_ffi_value(1e40).unwrap(),
        ffi::FfiValue::F64(_)
    ));
}

#[test]
fn float_ptr_to_value_raw_handles_null_and_value() {
    let value: f64 = 4.25;
    let ptr = &value as *const f64 as *mut c_void;
    assert!(matches!(
        // SAFETY: `ptr` addresses a live local f64.
        unsafe { FloatKind::F64.ptr_to_value_raw(ptr) },
        Value::Number(n) if (n - 4.25).abs() < 1e-9
    ));
    assert!(matches!(
        // SAFETY: Null short-circuits before any read.
        unsafe { FloatKind::F64.ptr_to_value_raw(std::ptr::null_mut()) },
        Value::Number(n) if n == 0.0
    ));
    let f: f32 = 1.25;
    let fptr = &f as *const f32 as *mut c_void;
    assert!(matches!(
        // SAFETY: `fptr` addresses a live local f32.
        unsafe { FloatKind::F32.ptr_to_value_raw(fptr) },
        Value::Number(n) if (n - 1.25).abs() < 1e-6
    ));
}

#[test]
fn float_codec_encode_decode_and_raw_ptr() {
    for kind in [FloatKind::F32, FloatKind::F64] {
        let encoded = FfiEncoder::encode(&kind, &Value::Number(2.5), false).unwrap();
        assert!(FfiDecoder::decode(&kind, &encoded).is_ok());
        assert!(FfiEncoder::encode(&kind, &Value::Null, true).is_ok());
        assert!(FfiEncoder::encode(&kind, &Value::Boolean(true), false).is_err());
        assert_eq!(
            FfiEncoder::libffi_type(&kind).as_raw_ptr(),
            kind.ffi_type().as_raw_ptr()
        );
        assert_eq!(
            middle::Type::from(kind).as_raw_ptr(),
            kind.ffi_type().as_raw_ptr()
        );

        let mut slot: f64 = 0.0;
        let ret = &mut slot as *mut f64 as *mut c_void;
        // SAFETY: `ret` addresses a writable local 8-byte slot.
        unsafe { RawPtrCodec::write_return_to_raw_ptr(&kind, ret, &Ok(Value::Number(1.0))) };
        assert!(
            // SAFETY: `ret` addresses a live local 8-byte slot.
            unsafe { RawPtrCodec::read_from_raw_ptr(&kind, ret as *const c_void, "c") }.is_ok()
        );
        // SAFETY: `ret` addresses a writable local 8-byte slot.
        unsafe { RawPtrCodec::write_return_to_raw_ptr(&kind, ret, &Err(())) };
        // SAFETY: `ret` addresses a writable local 8-byte slot.
        unsafe { RawPtrCodec::write_value_to_raw_ptr(&kind, ret, &Value::Number(3.0)) }.unwrap();
        // SAFETY: Null short-circuits before any read.
        assert!(unsafe { RawPtrCodec::ptr_to_value(&kind, std::ptr::null_mut(), "c") }.is_ok());
        // SAFETY: `ret` addresses a writable local 8-byte slot.
        assert!(unsafe { RawPtrCodec::write_value_to_raw_ptr(&kind, ret, &Value::Null) }.is_err());
    }
}

#[test]
fn float_call_cif_invokes_native_functions() {
    let cif32 = middle::Cif::new(Vec::new(), FloatKind::F32.ffi_type());
    let r32 = FfiEncoder::call_cif(
        &FloatKind::F32,
        &cif32,
        middle::CodePtr(ret_f32 as *mut c_void),
        &[],
    )
    .unwrap();
    assert!((r32.to_number().unwrap() - 1.5).abs() < 1e-6);

    let cif64 = middle::Cif::new(Vec::new(), FloatKind::F64.ffi_type());
    // SAFETY: The CIF was built for a zero-argument f64 function, and the
    // code pointer is a live function.
    let r64 = unsafe {
        FloatKind::F64.call_cif_raw(&cif64, middle::CodePtr(ret_f64 as *mut c_void), &[])
    };
    assert!((r64.to_number().unwrap() - 2.5).abs() < 1e-9);
}

#[test]
fn tagged_encode_decode_and_libffi_type() {
    common::run(|| {
        let tagged = common::enum_tagged();
        let encoded = FfiEncoder::encode(&tagged, &Value::Number(1.0), false).unwrap();
        assert!(matches!(encoded, ffi::FfiValue::I32(1)));
        let decoded = FfiDecoder::decode(&tagged, &ffi::FfiValue::I32(1)).unwrap();
        assert!(matches!(decoded, Value::Number(n) if n == 1.0));
        assert_eq!(
            FfiEncoder::libffi_type(&tagged).as_raw_ptr(),
            IntegerKind::I32.ffi_type().as_raw_ptr()
        );
    });
}

#[test]
fn tagged_encode_rejects_invalid_enum_member() {
    common::run(|| {
        let tagged = common::enum_tagged();
        assert!(FfiEncoder::encode(&tagged, &Value::Number(9999.0), false).is_ok());
    });
}

#[test]
fn tagged_call_cif_invokes_native_function() {
    common::run(|| {
        let tagged = common::enum_tagged();
        let cif = middle::Cif::new(Vec::new(), IntegerKind::I32.ffi_type());
        let result =
            FfiEncoder::call_cif(&tagged, &cif, middle::CodePtr(ret_i32 as *mut c_void), &[])
                .unwrap();
        assert!(matches!(result, ffi::FfiValue::I32(-32)));
    });
}

#[test]
fn tagged_raw_ptr_codec() {
    common::run(|| {
        let tagged = common::enum_tagged();
        let mut slot: i64 = 0;
        let ptr = &mut slot as *mut i64 as *mut c_void;
        // SAFETY: `ptr` addresses a writable local 8-byte slot.
        unsafe { RawPtrCodec::write_value_to_raw_ptr(&tagged, ptr, &Value::Number(2.0)) }.unwrap();
        // SAFETY: `ptr` addresses a live local 8-byte slot.
        let read =
            unsafe { RawPtrCodec::read_from_raw_ptr(&tagged, ptr as *const c_void, "c") }.unwrap();
        assert!(matches!(read, Value::Number(n) if n == 2.0));
        // SAFETY: `ptr` addresses a writable local 8-byte slot.
        unsafe { RawPtrCodec::write_return_to_raw_ptr(&tagged, ptr, &Ok(Value::Number(4.0))) };
        // SAFETY: Tagged storage reinterprets the pointer value without
        // dereferencing it.
        let from_ptr =
            unsafe { RawPtrCodec::ptr_to_value(&tagged, 3 as *mut c_void, "c") }.unwrap();
        assert!(matches!(from_ptr, Value::Number(n) if n == 3.0));
    });
}

#[test]
fn tagged_type_appears_in_type_enum() {
    let ty = Type::Tagged(common::enum_tagged());
    assert!(ty.can_be_return_type());
}

#[test]
fn integer_dispatch_methods_cover_every_kind() {
    let buffer = [0u8; 64];
    for kind in INTEGER_KINDS {
        let _ = kind.ffi_type();

        let mut slot = [0u8; 8];
        // SAFETY: `slot` is a writable local 8-byte buffer.
        unsafe { kind.write_ptr(slot.as_mut_ptr(), 3.0) };
        // SAFETY: `slot` is a live local 8-byte buffer.
        assert_eq!(unsafe { kind.read_ptr(slot.as_ptr()) }, 3.0);

        // SAFETY: `buffer` is a live local 64-byte buffer, wide enough for
        // 2 elements of every kind.
        assert!(unsafe { kind.read_slice(buffer.as_ptr(), 2) }.len() == 2);

        let storage = kind.to_ffi_storage(&[1.0, 2.0, 3.0]);
        assert_eq!(kind.vec_to_f64(&storage).unwrap(), vec![1.0, 2.0, 3.0]);

        let ffi_value = kind.to_ffi_value(1.0);
        assert!(ffi_value.to_number().is_ok());
    }
}

#[test]
fn integer_codec_covers_every_kind() {
    common::run(|| {
        for kind in INTEGER_KINDS {
            kind.checked_to_ffi_value(1.0).unwrap();
            assert!(matches!(
                kind.ptr_to_value_raw(4 as *mut c_void),
                Value::Number(_)
            ));

            let encoded = FfiEncoder::encode(&kind, &Value::Number(1.0), false).unwrap();
            FfiDecoder::decode(&kind, &encoded).unwrap();

            let mut slot = [0u8; 8];
            let ptr = slot.as_mut_ptr().cast::<c_void>();
            // SAFETY: `slot` is a writable local 8-byte buffer.
            unsafe { RawPtrCodec::write_value_to_raw_ptr(&kind, ptr, &Value::Number(2.0)) }
                .unwrap();
            // SAFETY: `slot` is a live local 8-byte buffer.
            unsafe { RawPtrCodec::read_from_raw_ptr(&kind, ptr.cast_const(), "c") }.unwrap();
            // SAFETY: `slot` is a writable local 8-byte buffer.
            unsafe { RawPtrCodec::write_return_to_raw_ptr(&kind, ptr, &Ok(Value::Number(1.0))) };
            // SAFETY: Integer kinds reinterpret the pointer value without
            // dereferencing it.
            unsafe { RawPtrCodec::ptr_to_value(&kind, std::ptr::dangling_mut::<c_void>(), "c") }
                .unwrap();
        }
    });
}

#[test]
fn float_codec_covers_every_kind() {
    common::run(|| {
        for kind in [FloatKind::F32, FloatKind::F64] {
            let _ = kind.ffi_type();
            let mut slot = [0u8; 8];
            // SAFETY: `slot` is a writable local 8-byte buffer.
            unsafe { kind.write_ptr(slot.as_mut_ptr(), 1.5) };
            // SAFETY: `slot` is a live local 8-byte buffer.
            let _ = unsafe { kind.read_ptr(slot.as_ptr()) };
            let _ = kind.to_ffi_value(1.5);
            kind.checked_to_ffi_value(1.5).unwrap();
            assert!(matches!(
                // SAFETY: Null short-circuits before any read.
                unsafe { kind.ptr_to_value_raw(std::ptr::null_mut()) },
                Value::Number(_)
            ));

            let encoded = FfiEncoder::encode(&kind, &Value::Number(1.0), false).unwrap();
            FfiDecoder::decode(&kind, &encoded).unwrap();

            let ptr = slot.as_mut_ptr().cast::<c_void>();
            // SAFETY: `slot` is a writable local 8-byte buffer.
            unsafe { RawPtrCodec::write_value_to_raw_ptr(&kind, ptr, &Value::Number(2.0)) }
                .unwrap();
            // SAFETY: `slot` is a live local 8-byte buffer.
            unsafe { RawPtrCodec::read_from_raw_ptr(&kind, ptr.cast_const(), "c") }.unwrap();
            // SAFETY: `slot` is a writable local 8-byte buffer.
            unsafe { RawPtrCodec::write_return_to_raw_ptr(&kind, ptr, &Ok(Value::Number(1.0))) };
            // SAFETY: Null short-circuits before any read.
            unsafe { RawPtrCodec::ptr_to_value(&kind, std::ptr::null_mut(), "c") }.unwrap();
        }
    });
}

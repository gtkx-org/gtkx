use native::ffi;
use native::types::{FloatKind, IntegerKind};

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

    let result = IntegerKind::U32.read_slice(ptr, 3);
    assert_eq!(result, vec![100.0, 200.0, 300.0]);
}

#[test]
fn integer_dispatch_read_slice_signed() {
    let data: [i16; 3] = [-100, 0, 100];
    let ptr = data.as_ptr() as *const u8;

    let result = IntegerKind::I16.read_slice(ptr, 3);
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

    let result = FloatKind::F32.read_ptr(ptr);
    assert!((result - 3.125).abs() < 0.001);
}

#[test]
fn float_dispatch_read_ptr_f64() {
    let value: f64 = std::f64::consts::E;
    let ptr = &value as *const f64 as *const u8;

    let result = FloatKind::F64.read_ptr(ptr);
    assert!((result - std::f64::consts::E).abs() < 0.000_000_1);
}

#[test]
fn float_dispatch_write_ptr_f32() {
    let mut value: f32 = 0.0;
    let ptr = &mut value as *mut f32 as *mut u8;

    FloatKind::F32.write_ptr(ptr, 1.5);
    assert!((value - 1.5).abs() < 0.001);
}

#[test]
fn float_dispatch_write_ptr_f64() {
    let mut value: f64 = 0.0;
    let ptr = &mut value as *mut f64 as *mut u8;

    FloatKind::F64.write_ptr(ptr, std::f64::consts::PI);
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

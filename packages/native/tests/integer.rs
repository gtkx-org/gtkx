use native::cif;
use native::integer;
use native::types::{IntegerSign, IntegerSize, IntegerType};

fn int_type(size: IntegerSize, sign: IntegerSign) -> IntegerType {
    IntegerType { size, sign }
}

#[test]
fn read_u8() {
    let value: u8 = 200;
    let ptr = &value as *const u8;
    let result = integer::read(&int_type(IntegerSize::_8, IntegerSign::Unsigned), ptr);
    assert_eq!(result, 200.0);
}

#[test]
fn read_i8() {
    let value: i8 = -50;
    let ptr = &value as *const i8 as *const u8;
    let result = integer::read(&int_type(IntegerSize::_8, IntegerSign::Signed), ptr);
    assert_eq!(result, -50.0);
}

#[test]
fn read_u16() {
    let value: u16 = 50000;
    let ptr = &value as *const u16 as *const u8;
    let result = integer::read(&int_type(IntegerSize::_16, IntegerSign::Unsigned), ptr);
    assert_eq!(result, 50000.0);
}

#[test]
fn read_i16() {
    let value: i16 = -20000;
    let ptr = &value as *const i16 as *const u8;
    let result = integer::read(&int_type(IntegerSize::_16, IntegerSign::Signed), ptr);
    assert_eq!(result, -20000.0);
}

#[test]
fn read_u32() {
    let value: u32 = 3_000_000_000;
    let ptr = &value as *const u32 as *const u8;
    let result = integer::read(&int_type(IntegerSize::_32, IntegerSign::Unsigned), ptr);
    assert_eq!(result, 3_000_000_000.0);
}

#[test]
fn read_i32() {
    let value: i32 = -1_000_000_000;
    let ptr = &value as *const i32 as *const u8;
    let result = integer::read(&int_type(IntegerSize::_32, IntegerSign::Signed), ptr);
    assert_eq!(result, -1_000_000_000.0);
}

#[test]
fn read_u64() {
    let value: u64 = 9_000_000_000;
    let ptr = &value as *const u64 as *const u8;
    let result = integer::read(&int_type(IntegerSize::_64, IntegerSign::Unsigned), ptr);
    assert_eq!(result, 9_000_000_000.0);
}

#[test]
fn read_i64() {
    let value: i64 = -5_000_000_000;
    let ptr = &value as *const i64 as *const u8;
    let result = integer::read(&int_type(IntegerSize::_64, IntegerSign::Signed), ptr);
    assert_eq!(result, -5_000_000_000.0);
}

#[test]
fn write_u8() {
    let mut value: u8 = 0;
    let ptr = &mut value as *mut u8;
    integer::write(&int_type(IntegerSize::_8, IntegerSign::Unsigned), ptr, 123.0);
    assert_eq!(value, 123);
}

#[test]
fn write_i8() {
    let mut value: i8 = 0;
    let ptr = &mut value as *mut i8 as *mut u8;
    integer::write(&int_type(IntegerSize::_8, IntegerSign::Signed), ptr, -42.0);
    assert_eq!(value, -42);
}

#[test]
fn write_u16() {
    let mut value: u16 = 0;
    let ptr = &mut value as *mut u16 as *mut u8;
    integer::write(
        &int_type(IntegerSize::_16, IntegerSign::Unsigned),
        ptr,
        12345.0,
    );
    assert_eq!(value, 12345);
}

#[test]
fn write_i16() {
    let mut value: i16 = 0;
    let ptr = &mut value as *mut i16 as *mut u8;
    integer::write(
        &int_type(IntegerSize::_16, IntegerSign::Signed),
        ptr,
        -12345.0,
    );
    assert_eq!(value, -12345);
}

#[test]
fn write_u32() {
    let mut value: u32 = 0;
    let ptr = &mut value as *mut u32 as *mut u8;
    integer::write(
        &int_type(IntegerSize::_32, IntegerSign::Unsigned),
        ptr,
        1_234_567_890.0,
    );
    assert_eq!(value, 1_234_567_890);
}

#[test]
fn write_i32() {
    let mut value: i32 = 0;
    let ptr = &mut value as *mut i32 as *mut u8;
    integer::write(
        &int_type(IntegerSize::_32, IntegerSign::Signed),
        ptr,
        -1_234_567_890.0,
    );
    assert_eq!(value, -1_234_567_890);
}

#[test]
fn write_u64() {
    let mut value: u64 = 0;
    let ptr = &mut value as *mut u64 as *mut u8;
    integer::write(
        &int_type(IntegerSize::_64, IntegerSign::Unsigned),
        ptr,
        9_876_543_210.0,
    );
    assert_eq!(value, 9_876_543_210);
}

#[test]
fn write_i64() {
    let mut value: i64 = 0;
    let ptr = &mut value as *mut i64 as *mut u8;
    integer::write(
        &int_type(IntegerSize::_64, IntegerSign::Signed),
        ptr,
        -9_876_543_210.0,
    );
    assert_eq!(value, -9_876_543_210);
}

#[test]
fn to_cif_u8() {
    let result = integer::to_cif(&int_type(IntegerSize::_8, IntegerSign::Unsigned), 100.0);
    assert!(matches!(result, cif::Value::U8(100)));
}

#[test]
fn to_cif_i8() {
    let result = integer::to_cif(&int_type(IntegerSize::_8, IntegerSign::Signed), -50.0);
    assert!(matches!(result, cif::Value::I8(-50)));
}

#[test]
fn to_cif_u16() {
    let result = integer::to_cif(&int_type(IntegerSize::_16, IntegerSign::Unsigned), 30000.0);
    assert!(matches!(result, cif::Value::U16(30000)));
}

#[test]
fn to_cif_i16() {
    let result = integer::to_cif(&int_type(IntegerSize::_16, IntegerSign::Signed), -15000.0);
    assert!(matches!(result, cif::Value::I16(-15000)));
}

#[test]
fn to_cif_u32() {
    let result = integer::to_cif(
        &int_type(IntegerSize::_32, IntegerSign::Unsigned),
        2_000_000_000.0,
    );
    assert!(matches!(result, cif::Value::U32(2_000_000_000)));
}

#[test]
fn to_cif_i32() {
    let result = integer::to_cif(
        &int_type(IntegerSize::_32, IntegerSign::Signed),
        -1_000_000_000.0,
    );
    assert!(matches!(result, cif::Value::I32(-1_000_000_000)));
}

#[test]
fn to_cif_u64() {
    let result = integer::to_cif(
        &int_type(IntegerSize::_64, IntegerSign::Unsigned),
        5_000_000_000.0,
    );
    assert!(matches!(result, cif::Value::U64(5_000_000_000)));
}

#[test]
fn to_cif_i64() {
    let result = integer::to_cif(
        &int_type(IntegerSize::_64, IntegerSign::Signed),
        -5_000_000_000.0,
    );
    assert!(matches!(result, cif::Value::I64(-5_000_000_000)));
}

#[test]
fn f64_to_vec_u8() {
    let values = [1.0, 2.0, 3.0];
    let owned_ptr = integer::f64_to_vec(&int_type(IntegerSize::_8, IntegerSign::Unsigned), &values);
    let result = owned_ptr.value.downcast_ref::<Vec<u8>>().unwrap();
    assert_eq!(result, &vec![1u8, 2u8, 3u8]);
}

#[test]
fn f64_to_vec_i32() {
    let values = [-100.0, 0.0, 100.0];
    let owned_ptr =
        integer::f64_to_vec(&int_type(IntegerSize::_32, IntegerSign::Signed), &values);
    let result = owned_ptr.value.downcast_ref::<Vec<i32>>().unwrap();
    assert_eq!(result, &vec![-100i32, 0i32, 100i32]);
}

#[test]
fn vec_to_f64_u8() {
    let values: Vec<u8> = vec![10, 20, 30];
    let owned_ptr = cif::OwnedPtr::from_vec(values);
    let result =
        integer::vec_to_f64(&int_type(IntegerSize::_8, IntegerSign::Unsigned), &owned_ptr).unwrap();
    assert_eq!(result, vec![10.0, 20.0, 30.0]);
}

#[test]
fn vec_to_f64_i32() {
    let values: Vec<i32> = vec![-100, 0, 100];
    let owned_ptr = cif::OwnedPtr::from_vec(values);
    let result =
        integer::vec_to_f64(&int_type(IntegerSize::_32, IntegerSign::Signed), &owned_ptr).unwrap();
    assert_eq!(result, vec![-100.0, 0.0, 100.0]);
}

#[test]
fn vec_to_f64_wrong_type_fails() {
    let values: Vec<String> = vec!["not".to_string(), "numbers".to_string()];
    let owned_ptr = cif::OwnedPtr::new(
        Box::new(values),
        std::ptr::null_mut(),
    );
    let result =
        integer::vec_to_f64(&int_type(IntegerSize::_8, IntegerSign::Unsigned), &owned_ptr);
    assert!(result.is_err());
}

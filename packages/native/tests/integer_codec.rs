use native::ffi;
use native::ffi::codec::IntegerCodec;

fn assert_read_ptr<T: Copy>(kind: IntegerCodec, value: T, expected: f64) {
    let result = unsafe { kind.read_ptr((&raw const value).cast::<u8>()) };
    assert!((result - expected).abs() < f64::EPSILON);
}

fn assert_write_ptr<T: Copy + Default + PartialEq + std::fmt::Debug>(
    kind: IntegerCodec,
    value: f64,
    expected: T,
) {
    let mut slot = T::default();
    unsafe { kind.write_ptr((&raw mut slot).cast::<u8>(), value) };
    assert_eq!(slot, expected);
}

#[test]
fn read_u8() {
    assert_read_ptr(IntegerCodec::U8, 200u8, 200.0);
}

#[test]
fn read_i8() {
    assert_read_ptr(IntegerCodec::I8, -50i8, -50.0);
}

#[test]
fn read_u16() {
    assert_read_ptr(IntegerCodec::U16, 50000u16, 50000.0);
}

#[test]
fn read_i16() {
    assert_read_ptr(IntegerCodec::I16, -20000i16, -20000.0);
}

#[test]
fn read_u32() {
    assert_read_ptr(IntegerCodec::U32, 3_000_000_000u32, 3_000_000_000.0);
}

#[test]
fn read_i32() {
    assert_read_ptr(IntegerCodec::I32, -1_000_000_000i32, -1_000_000_000.0);
}

#[test]
fn read_u64() {
    assert_read_ptr(IntegerCodec::U64, 9_000_000_000u64, 9_000_000_000.0);
}

#[test]
fn read_i64() {
    assert_read_ptr(IntegerCodec::I64, -5_000_000_000i64, -5_000_000_000.0);
}

#[test]
fn write_u8() {
    assert_write_ptr(IntegerCodec::U8, 123.0, 123u8);
}

#[test]
fn write_i8() {
    assert_write_ptr(IntegerCodec::I8, -42.0, -42i8);
}

#[test]
fn write_u16() {
    assert_write_ptr(IntegerCodec::U16, 12345.0, 12345u16);
}

#[test]
fn write_i16() {
    assert_write_ptr(IntegerCodec::I16, -12345.0, -12345i16);
}

#[test]
fn write_u32() {
    assert_write_ptr(IntegerCodec::U32, 1_234_567_890.0, 1_234_567_890u32);
}

#[test]
fn write_i32() {
    assert_write_ptr(IntegerCodec::I32, -1_234_567_890.0, -1_234_567_890i32);
}

#[test]
fn write_u64() {
    assert_write_ptr(IntegerCodec::U64, 9_876_543_210.0, 9_876_543_210u64);
}

#[test]
fn write_i64() {
    assert_write_ptr(IntegerCodec::I64, -9_876_543_210.0, -9_876_543_210i64);
}

#[test]
fn to_stash_u8() {
    let result = IntegerCodec::U8.to_stash(100.0);
    assert!(matches!(result, ffi::Stash::U8(100)));
}

#[test]
fn to_stash_i8() {
    let result = IntegerCodec::I8.to_stash(-50.0);
    assert!(matches!(result, ffi::Stash::I8(-50)));
}

#[test]
fn to_stash_u16() {
    let result = IntegerCodec::U16.to_stash(30000.0);
    assert!(matches!(result, ffi::Stash::U16(30000)));
}

#[test]
fn to_stash_i16() {
    let result = IntegerCodec::I16.to_stash(-15000.0);
    assert!(matches!(result, ffi::Stash::I16(-15000)));
}

#[test]
fn to_stash_u32() {
    let result = IntegerCodec::U32.to_stash(2_000_000_000.0);
    assert!(matches!(result, ffi::Stash::U32(2_000_000_000)));
}

#[test]
fn to_stash_i32() {
    let result = IntegerCodec::I32.to_stash(-1_000_000_000.0);
    assert!(matches!(result, ffi::Stash::I32(-1_000_000_000)));
}

#[test]
fn to_stash_u64() {
    let result = IntegerCodec::U64.to_stash(5_000_000_000.0);
    assert!(matches!(result, ffi::Stash::U64(5_000_000_000)));
}

#[test]
fn to_stash_i64() {
    let result = IntegerCodec::I64.to_stash(-5_000_000_000.0);
    assert!(matches!(result, ffi::Stash::I64(-5_000_000_000)));
}

#[test]
fn to_stash_storage_u8() {
    let values = [1.0, 2.0, 3.0];
    let storage = IntegerCodec::U8.to_stash_storage(&values);
    match storage.data() {
        ffi::StashData::U8Vec(result) => assert_eq!(result, &vec![1u8, 2u8, 3u8]),
        _ => panic!("Expected U8Vec"),
    }
}

#[test]
fn to_stash_storage_i32() {
    let values = [-100.0, 0.0, 100.0];
    let storage = IntegerCodec::I32.to_stash_storage(&values);
    match storage.data() {
        ffi::StashData::I32Vec(result) => assert_eq!(result, &vec![-100i32, 0i32, 100i32]),
        _ => panic!("Expected I32Vec"),
    }
}

use std::ffi::c_void;

use libffi::middle;
use native::ffi;
use native::types::{BooleanType, FfiDecoder, FfiEncoder, RawPtrCodec, ReadSource};
use native::value::Value;

extern "C" fn ret_true() -> i32 {
    1
}

extern "C" fn ret_false() -> i32 {
    0
}

#[test]
fn encode_accepts_boolean_and_rejects_other() {
    let encoded = FfiEncoder::encode(&BooleanType, &Value::Boolean(true)).unwrap();
    assert!(matches!(encoded, ffi::FfiValue::I32(1)));

    let encoded_false = FfiEncoder::encode(&BooleanType, &Value::Boolean(false)).unwrap();
    assert!(matches!(encoded_false, ffi::FfiValue::I32(0)));

    let err = FfiEncoder::encode(&BooleanType, &Value::Number(1.0));
    assert!(err.is_err());
}

#[test]
fn libffi_type_is_i32() {
    assert_eq!(
        FfiEncoder::libffi_type(&BooleanType).as_raw_ptr(),
        middle::Type::i32().as_raw_ptr()
    );
}

#[test]
fn call_cif_invokes_native_function() {
    let cif = middle::Cif::new(Vec::new(), middle::Type::i32());

    let truthy = FfiEncoder::call_cif(
        &BooleanType,
        &cif,
        middle::CodePtr(ret_true as *mut c_void),
        &[],
    )
    .unwrap();
    assert!(matches!(truthy, ffi::FfiValue::I32(1)));

    let falsy = FfiEncoder::call_cif(
        &BooleanType,
        &cif,
        middle::CodePtr(ret_false as *mut c_void),
        &[],
    )
    .unwrap();
    assert!(matches!(falsy, ffi::FfiValue::I32(0)));
}

#[test]
fn decode_reads_i32_and_rejects_other() {
    let decoded = FfiDecoder::decode(&BooleanType, &ffi::FfiValue::I32(1)).unwrap();
    assert!(matches!(decoded, Value::Boolean(true)));

    let decoded_zero = FfiDecoder::decode(&BooleanType, &ffi::FfiValue::I32(0)).unwrap();
    assert!(matches!(decoded_zero, Value::Boolean(false)));

    assert!(FfiDecoder::decode(&BooleanType, &ffi::FfiValue::Void).is_err());
}

#[test]
fn ptr_to_value_treats_nonzero_as_true() {
    let anchor: u8 = 0;
    // SAFETY: `BooleanType` reads a `ReadSource::Value` by treating the pointer as nonzero/null
    // truthiness only; the non-null `anchor` pointer is a live stack local that is never
    // dereferenced, so the read is sound.
    let truthy = unsafe {
        FfiDecoder::read(
            &BooleanType,
            ReadSource::Value(&anchor as *const u8 as *mut c_void, "ctx"),
        )
    }
    .unwrap();
    assert!(matches!(truthy, Value::Boolean(true)));

    // SAFETY: a null `ReadSource::Value` pointer is the documented "false" case for `BooleanType`,
    // which inspects only the pointer's nullness and never dereferences it.
    let falsy =
        unsafe { FfiDecoder::read(&BooleanType, ReadSource::Value(std::ptr::null_mut(), "ctx")) }
            .unwrap();
    assert!(matches!(falsy, Value::Boolean(false)));
}

#[test]
fn read_from_raw_ptr_reads_i32_slot() {
    let truthy_slot: i32 = 1;
    let truthy_ptr = &truthy_slot as *const i32 as *const c_void;
    // SAFETY: `ReadSource::Slot` reads one `i32` from the slot; `truthy_ptr` points to the live,
    // correctly-typed `truthy_slot` stack local, so the in-bounds read is sound.
    let read =
        unsafe { FfiDecoder::read(&BooleanType, ReadSource::Slot(truthy_ptr, "ctx")) }.unwrap();
    assert!(matches!(read, Value::Boolean(true)));

    let falsy_slot: i32 = 0;
    let falsy_ptr = &falsy_slot as *const i32 as *const c_void;
    // SAFETY: `falsy_ptr` points to the live, correctly-typed `falsy_slot` `i32` stack local,
    // so reading one `i32` from the slot is in bounds and sound.
    let read_zero =
        unsafe { FfiDecoder::read(&BooleanType, ReadSource::Slot(falsy_ptr, "ctx")) }.unwrap();
    assert!(matches!(read_zero, Value::Boolean(false)));
}

#[test]
fn write_return_to_raw_ptr_writes_truthiness() {
    let mut slot: i64 = -1;
    let ret = &mut slot as *mut i64 as *mut c_void;

    // SAFETY: `ret` points to the live, writable `i64` stack local `slot`, which is at least as
    // wide as the boolean return word `write_return_to_raw_ptr` stores, so the write is in bounds.
    unsafe { RawPtrCodec::write_return_to_raw_ptr(&BooleanType, ret, &Ok(Value::Boolean(true))) };
    assert_eq!(slot, 1);

    // SAFETY: same writable `i64` slot `ret`; the boolean return word is written in bounds.
    unsafe { RawPtrCodec::write_return_to_raw_ptr(&BooleanType, ret, &Ok(Value::Boolean(false))) };
    assert_eq!(slot, 0);

    // SAFETY: same writable `i64` slot `ret`; the error case writes the zero return word in bounds.
    unsafe { RawPtrCodec::write_return_to_raw_ptr(&BooleanType, ret, &Err(())) };
    assert_eq!(slot, 0);
}

#[test]
fn write_value_to_raw_ptr_writes_boolean_and_rejects_other() {
    let mut slot: i32 = -1;
    let ptr = &mut slot as *mut i32 as *mut c_void;

    // SAFETY: `ptr` points to the live, writable `i32` stack local `slot`, the exact width
    // `write_value_to_raw_ptr` stores a boolean field into, so the write is in bounds.
    unsafe { RawPtrCodec::write_value_to_raw_ptr(&BooleanType, ptr, &Value::Boolean(true)) }
        .unwrap();
    assert_eq!(slot, 1);

    // SAFETY: same writable `i32` slot `ptr`; the boolean field is written in bounds.
    unsafe { RawPtrCodec::write_value_to_raw_ptr(&BooleanType, ptr, &Value::Boolean(false)) }
        .unwrap();
    assert_eq!(slot, 0);

    assert!(
        // SAFETY: same writable `i32` slot `ptr`; the call rejects the non-boolean value before
        // any write, so the slot is untouched.
        unsafe { RawPtrCodec::write_value_to_raw_ptr(&BooleanType, ptr, &Value::Number(1.0)) }
            .is_err()
    );
}

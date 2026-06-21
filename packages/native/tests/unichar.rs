mod common;

use std::ffi::c_void;

use libffi::middle;
use native::ffi;
use native::types::{FfiDecoder, FfiEncoder, RawPtrCodec, ReadSource, UnicharType};
use native::value::Value;

extern "C" fn ret_codepoint() -> u32 {
    'Z' as u32
}

#[test]
fn encode_accepts_string_number_and_optional_null() {
    let from_string = FfiEncoder::encode(&UnicharType, &Value::String("Aaa".to_owned())).unwrap();
    assert!(matches!(from_string, ffi::FfiValue::U32(c) if c == 'A' as u32));

    let from_empty = FfiEncoder::encode(&UnicharType, &Value::String(String::new())).unwrap();
    assert!(matches!(from_empty, ffi::FfiValue::U32(0)));

    let from_number = FfiEncoder::encode(&UnicharType, &Value::Number(66.0)).unwrap();
    assert!(matches!(from_number, ffi::FfiValue::U32(66)));

    let optional_null = FfiEncoder::encode(&UnicharType, &Value::Null).unwrap();
    assert!(matches!(optional_null, ffi::FfiValue::U32(0)));

    let optional_undef = FfiEncoder::encode(&UnicharType, &Value::Undefined).unwrap();
    assert!(matches!(optional_undef, ffi::FfiValue::U32(0)));
}

#[test]
fn encode_rejects_wrong_value_and_encodes_null_as_zero() {
    assert!(FfiEncoder::encode(&UnicharType, &Value::Boolean(true)).is_err());
    assert!(matches!(
        FfiEncoder::encode(&UnicharType, &Value::Null).unwrap(),
        ffi::FfiValue::U32(0)
    ));
}

#[test]
fn libffi_type_is_u32() {
    assert_eq!(
        FfiEncoder::libffi_type(&UnicharType).as_raw_ptr(),
        middle::Type::u32().as_raw_ptr()
    );
}

#[test]
fn call_cif_invokes_native_function() {
    let cif = middle::Cif::new(Vec::new(), middle::Type::u32());
    let result = FfiEncoder::call_cif(
        &UnicharType,
        &cif,
        middle::CodePtr(ret_codepoint as *mut c_void),
        &[],
    )
    .unwrap();
    assert!(matches!(result, ffi::FfiValue::U32(c) if c == 'Z' as u32));
}

#[test]
fn decode_reads_codepoint_and_rejects_invalid() {
    let decoded = FfiDecoder::decode(&UnicharType, &ffi::FfiValue::U32('Q' as u32)).unwrap();
    assert!(matches!(decoded, Value::String(ref s) if s == "Q"));

    assert!(FfiDecoder::decode(&UnicharType, &ffi::FfiValue::Void).is_err());

    let invalid = FfiDecoder::decode(&UnicharType, &ffi::FfiValue::U32(0x0011_0000));
    assert!(invalid.is_err());
}

#[test]
fn ptr_to_value_decodes_codepoint_and_replaces_invalid() {
    // SAFETY: `UnicharType` reads a `ReadSource::Value` by interpreting the pointer's integer
    // value as a codepoint; it never dereferences the pointer, so the synthesized `'X'` address
    // is sound to pass.
    let valid = unsafe {
        FfiDecoder::read(
            &UnicharType,
            ReadSource::Value('X' as usize as *mut c_void, "ctx"),
        )
    }
    .unwrap();
    assert!(matches!(valid, Value::String(ref s) if s == "X"));

    // SAFETY: the out-of-range codepoint is again only read from the pointer's integer value,
    // never dereferenced, and is replaced with the Unicode replacement character.
    let invalid = unsafe {
        FfiDecoder::read(
            &UnicharType,
            ReadSource::Value(0x0011_0000 as *mut c_void, "ctx"),
        )
    }
    .unwrap();
    assert!(matches!(invalid, Value::String(ref s) if s == "\u{FFFD}"));
}

#[test]
fn read_from_raw_ptr_decodes_codepoint_and_replaces_invalid() {
    let valid_slot: u32 = 'M' as u32;
    let valid_ptr = &valid_slot as *const u32 as *const c_void;
    // SAFETY: `ReadSource::Slot` reads one `u32` codepoint from the slot; `valid_ptr` points to
    // the live, correctly-typed `valid_slot` stack local, so the in-bounds read is sound.
    let read =
        unsafe { FfiDecoder::read(&UnicharType, ReadSource::Slot(valid_ptr, "ctx")) }.unwrap();
    assert!(matches!(read, Value::String(ref s) if s == "M"));

    let invalid_slot: u32 = 0x0011_0000;
    let invalid_ptr = &invalid_slot as *const u32 as *const c_void;
    // SAFETY: `invalid_ptr` points to the live, correctly-typed `invalid_slot` `u32`; reading
    // that one in-bounds value yields an out-of-range codepoint replaced with U+FFFD.
    let read_invalid =
        unsafe { FfiDecoder::read(&UnicharType, ReadSource::Slot(invalid_ptr, "ctx")) }.unwrap();
    assert!(matches!(read_invalid, Value::String(ref s) if s == "\u{FFFD}"));
}

#[test]
fn write_return_to_raw_ptr_writes_string_number_and_default() {
    let mut slot: u64 = 9;
    let ret = &mut slot as *mut u64 as *mut c_void;

    // SAFETY: `ret` points to the live, writable `u64` stack local `slot`, at least as wide as
    // the codepoint word `write_return_to_raw_ptr` stores, so each write below is in bounds.
    unsafe {
        RawPtrCodec::write_return_to_raw_ptr(
            &UnicharType,
            ret,
            &Ok(Value::String("Kkk".to_owned())),
        );
    }
    assert_eq!(slot, u64::from('K' as u32));

    // SAFETY: same writable `u64` slot `ret`; the empty string writes the zero codepoint in bounds.
    unsafe {
        RawPtrCodec::write_return_to_raw_ptr(&UnicharType, ret, &Ok(Value::String(String::new())));
    }
    assert_eq!(slot, 0);

    // SAFETY: same writable `u64` slot `ret`; the numeric codepoint is written in bounds.
    unsafe { RawPtrCodec::write_return_to_raw_ptr(&UnicharType, ret, &Ok(Value::Number(70.0))) };
    assert_eq!(slot, 70);

    // SAFETY: same writable `u64` slot `ret`; the error case writes the zero default in bounds.
    unsafe { RawPtrCodec::write_return_to_raw_ptr(&UnicharType, ret, &Err(())) };
    assert_eq!(slot, 0);

    slot = u64::MAX;
    // SAFETY: same writable `u64` slot `ret`; the rejected boolean falls back to the zero default,
    // written in bounds.
    unsafe { RawPtrCodec::write_return_to_raw_ptr(&UnicharType, ret, &Ok(Value::Boolean(true))) };
    assert_eq!(slot, 0);
}

mod helpers;

use std::ffi::c_void;

use libffi::middle;
use native::ffi;
use native::ffi::descriptor::{
    FfiDecoder, FfiEncoder, PointerWriter, ReadSource, UnicharDescriptor,
};
use native::ffi::value::Value;

extern "C" fn ret_codepoint() -> u32 {
    'Z' as u32
}

#[test]
fn encode_accepts_string_number_and_optional_null() {
    let from_string =
        FfiEncoder::encode(&UnicharDescriptor, &Value::String("Aaa".to_owned())).unwrap();
    assert!(matches!(from_string, ffi::StashedValue::U32(c) if c == 'A' as u32));

    let from_empty = FfiEncoder::encode(&UnicharDescriptor, &Value::String(String::new())).unwrap();
    assert!(matches!(from_empty, ffi::StashedValue::U32(0)));

    let from_number = FfiEncoder::encode(&UnicharDescriptor, &Value::Number(66.0)).unwrap();
    assert!(matches!(from_number, ffi::StashedValue::U32(66)));

    let optional_null = FfiEncoder::encode(&UnicharDescriptor, &Value::Null).unwrap();
    assert!(matches!(optional_null, ffi::StashedValue::U32(0)));

    let optional_undef = FfiEncoder::encode(&UnicharDescriptor, &Value::Undefined).unwrap();
    assert!(matches!(optional_undef, ffi::StashedValue::U32(0)));
}

#[test]
fn encode_rejects_wrong_value_and_encodes_null_as_zero() {
    assert!(FfiEncoder::encode(&UnicharDescriptor, &Value::Boolean(true)).is_err());
    assert!(matches!(
        FfiEncoder::encode(&UnicharDescriptor, &Value::Null).unwrap(),
        ffi::StashedValue::U32(0)
    ));
}

#[test]
fn libffi_type_is_u32() {
    assert_eq!(
        FfiEncoder::libffi_type(&UnicharDescriptor).as_raw_ptr(),
        middle::Type::u32().as_raw_ptr()
    );
}

#[test]
fn call_cif_invokes_native_function() {
    let cif = middle::Cif::new(Vec::new(), middle::Type::u32());
    let result = FfiEncoder::call_cif(
        &UnicharDescriptor,
        &cif,
        middle::CodePtr(ret_codepoint as *mut c_void),
        &[],
    )
    .unwrap();
    assert!(matches!(result, ffi::StashedValue::U32(c) if c == 'Z' as u32));
}

#[test]
fn decode_reads_codepoint_and_rejects_invalid() {
    let decoded =
        FfiDecoder::decode(&UnicharDescriptor, &ffi::StashedValue::U32('Q' as u32)).unwrap();
    assert!(matches!(decoded, Value::String(ref s) if s == "Q"));

    assert!(FfiDecoder::decode(&UnicharDescriptor, &ffi::StashedValue::Void).is_err());

    let invalid = FfiDecoder::decode(&UnicharDescriptor, &ffi::StashedValue::U32(0x0011_0000));
    assert!(invalid.is_err());
}

#[test]
fn ptr_to_value_decodes_codepoint_and_replaces_invalid() {
    let valid = unsafe {
        FfiDecoder::read(
            &UnicharDescriptor,
            ReadSource::Value('X' as usize as *mut c_void, "ctx"),
        )
    }
    .unwrap();
    assert!(matches!(valid, Value::String(ref s) if s == "X"));

    let invalid = unsafe {
        FfiDecoder::read(
            &UnicharDescriptor,
            ReadSource::Value(0x0011_0000 as *mut c_void, "ctx"),
        )
    }
    .unwrap();
    assert!(matches!(invalid, Value::String(ref s) if s == "\u{FFFD}"));
}

#[test]
fn read_from_pointer_decodes_codepoint_and_replaces_invalid() {
    let valid_slot: u32 = 'M' as u32;
    let valid_ptr = &valid_slot as *const u32 as *const c_void;
    let read = unsafe { FfiDecoder::read(&UnicharDescriptor, ReadSource::Slot(valid_ptr, "ctx")) }
        .unwrap();
    assert!(matches!(read, Value::String(ref s) if s == "M"));

    let invalid_slot: u32 = 0x0011_0000;
    let invalid_ptr = &invalid_slot as *const u32 as *const c_void;
    let read_invalid =
        unsafe { FfiDecoder::read(&UnicharDescriptor, ReadSource::Slot(invalid_ptr, "ctx")) }
            .unwrap();
    assert!(matches!(read_invalid, Value::String(ref s) if s == "\u{FFFD}"));
}

#[test]
fn write_return_to_pointer_writes_string_number_and_default() {
    let mut slot: u64 = 9;
    let ret = &mut slot as *mut u64 as *mut c_void;

    unsafe {
        PointerWriter::write_return_to_pointer(
            &UnicharDescriptor,
            ret,
            &Ok(Value::String("Kkk".to_owned())),
        );
    }
    assert_eq!(slot, u64::from('K' as u32));

    unsafe {
        PointerWriter::write_return_to_pointer(
            &UnicharDescriptor,
            ret,
            &Ok(Value::String(String::new())),
        );
    }
    assert_eq!(slot, 0);

    unsafe {
        PointerWriter::write_return_to_pointer(&UnicharDescriptor, ret, &Ok(Value::Number(70.0)));
    }
    assert_eq!(slot, 70);

    unsafe { PointerWriter::write_return_to_pointer(&UnicharDescriptor, ret, &Err(())) };
    assert_eq!(slot, 0);

    slot = u64::MAX;
    unsafe {
        PointerWriter::write_return_to_pointer(&UnicharDescriptor, ret, &Ok(Value::Boolean(true)));
    }
    assert_eq!(slot, 0);
}

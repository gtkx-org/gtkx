use std::ffi::c_void;

use libffi::middle;
use native::ffi;
use native::ffi::Slot;
use native::ffi::codec::{Decoder, Encoder, PtrWriter, ReadSource, UnicharCodec};
use native::ffi::value::Value;

extern "C" fn ret_codepoint() -> u32 {
    'Z' as u32
}

#[test]
fn encode_accepts_string_number_and_optional_null() {
    let from_string = Encoder::encode(&UnicharCodec, &Value::String("Aaa".to_owned())).unwrap();
    assert!(matches!(from_string, ffi::Stash::U32(c) if c == 'A' as u32));

    let from_empty = Encoder::encode(&UnicharCodec, &Value::String(String::new())).unwrap();
    assert!(matches!(from_empty, ffi::Stash::U32(0)));

    let from_number = Encoder::encode(&UnicharCodec, &Value::Number(66.0)).unwrap();
    assert!(matches!(from_number, ffi::Stash::U32(66)));

    let optional_null = Encoder::encode(&UnicharCodec, &Value::Null).unwrap();
    assert!(matches!(optional_null, ffi::Stash::U32(0)));

    let optional_undef = Encoder::encode(&UnicharCodec, &Value::Undefined).unwrap();
    assert!(matches!(optional_undef, ffi::Stash::U32(0)));

    assert!(Encoder::encode(&UnicharCodec, &Value::Boolean(true)).is_err());
}
#[test]
fn libffi_type_is_u32() {
    assert_eq!(
        Encoder::libffi_type(&UnicharCodec).as_raw_ptr(),
        middle::Type::u32().as_raw_ptr()
    );
}

#[test]
fn call_cif_invokes_native_function() {
    let cif = middle::Cif::new(Vec::new(), middle::Type::u32());
    let result = Encoder::call_cif(
        &UnicharCodec,
        &cif,
        middle::CodePtr(ret_codepoint as *mut c_void),
        &[],
    )
    .unwrap();
    assert!(matches!(result, ffi::Stash::U32(c) if c == 'Z' as u32));
}

#[test]
fn decode_reads_codepoint_and_rejects_invalid() {
    let decoded = Decoder::decode(&UnicharCodec, &ffi::Stash::U32('Q' as u32)).unwrap();
    assert!(matches!(decoded, Value::String(ref s) if s == "Q"));

    assert!(Decoder::decode(&UnicharCodec, &ffi::Stash::Void).is_err());

    let invalid = Decoder::decode(&UnicharCodec, &ffi::Stash::U32(0x0011_0000));
    assert!(invalid.is_err());
}

#[test]
fn ptr_to_value_decodes_codepoint_and_replaces_invalid() {
    let valid = unsafe {
        Decoder::read(
            &UnicharCodec,
            ReadSource::Value('X' as usize as *mut c_void, "ctx"),
        )
    }
    .unwrap();
    assert!(matches!(valid, Value::String(ref s) if s == "X"));

    let invalid = unsafe {
        Decoder::read(
            &UnicharCodec,
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
    let read = unsafe { Decoder::read(&UnicharCodec, ReadSource::Slot(valid_ptr, "ctx")) }.unwrap();
    assert!(matches!(read, Value::String(ref s) if s == "M"));

    let invalid_slot: u32 = 0x0011_0000;
    let invalid_ptr = &invalid_slot as *const u32 as *const c_void;
    let read_invalid =
        unsafe { Decoder::read(&UnicharCodec, ReadSource::Slot(invalid_ptr, "ctx")) }.unwrap();
    assert!(matches!(read_invalid, Value::String(ref s) if s == "\u{FFFD}"));
}

#[test]
fn write_return_to_pointer_writes_string_number_and_default() {
    let mut slot: u64 = 9;
    let ret = &mut slot as *mut u64 as *mut c_void;

    PtrWriter::write_return_to_ptr(
        &UnicharCodec,
        unsafe { Slot::new(ret) },
        &Ok(Value::String("Kkk".to_owned())),
    );
    assert_eq!(slot, u64::from('K' as u32));

    PtrWriter::write_return_to_ptr(
        &UnicharCodec,
        unsafe { Slot::new(ret) },
        &Ok(Value::String(String::new())),
    );
    assert_eq!(slot, 0);

    PtrWriter::write_return_to_ptr(
        &UnicharCodec,
        unsafe { Slot::new(ret) },
        &Ok(Value::Number(70.0)),
    );
    assert_eq!(slot, 70);

    PtrWriter::write_return_to_ptr(&UnicharCodec, unsafe { Slot::new(ret) }, &Err(()));
    assert_eq!(slot, 0);

    slot = u64::MAX;
    PtrWriter::write_return_to_ptr(
        &UnicharCodec,
        unsafe { Slot::new(ret) },
        &Ok(Value::Boolean(true)),
    );
    assert_eq!(slot, 0);
}

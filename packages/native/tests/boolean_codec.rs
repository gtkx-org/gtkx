use std::ffi::c_void;

use libffi::middle;
use native::ffi;
use native::ffi::Slot;
use native::ffi::codec::{BooleanCodec, Decoder, Encoder, PtrWriter, ReadSource};
use native::ffi::value::Value;

extern "C" fn ret_true() -> i32 {
    1
}

extern "C" fn ret_false() -> i32 {
    0
}

#[test]
fn encode_accepts_boolean_and_rejects_other() {
    let encoded = Encoder::encode(&BooleanCodec, &Value::Boolean(true)).unwrap();
    assert!(matches!(encoded, ffi::Stash::I32(1)));

    let encoded_false = Encoder::encode(&BooleanCodec, &Value::Boolean(false)).unwrap();
    assert!(matches!(encoded_false, ffi::Stash::I32(0)));

    let err = Encoder::encode(&BooleanCodec, &Value::Number(1.0));
    assert!(err.is_err());
}

#[test]
fn libffi_type_is_i32() {
    assert_eq!(
        Encoder::libffi_type(&BooleanCodec).as_raw_ptr(),
        middle::Type::i32().as_raw_ptr()
    );
}

#[test]
fn call_cif_invokes_native_function() {
    let cif = middle::Cif::new(Vec::new(), middle::Type::i32());

    let truthy = Encoder::call_cif(
        &BooleanCodec,
        &cif,
        middle::CodePtr(ret_true as *mut c_void),
        &[],
    )
    .unwrap();
    assert!(matches!(truthy, ffi::Stash::I32(1)));

    let falsy = Encoder::call_cif(
        &BooleanCodec,
        &cif,
        middle::CodePtr(ret_false as *mut c_void),
        &[],
    )
    .unwrap();
    assert!(matches!(falsy, ffi::Stash::I32(0)));
}

#[test]
fn decode_reads_i32_and_rejects_other() {
    let decoded = Decoder::decode(&BooleanCodec, &ffi::Stash::I32(1)).unwrap();
    assert!(matches!(decoded, Value::Boolean(true)));

    let decoded_zero = Decoder::decode(&BooleanCodec, &ffi::Stash::I32(0)).unwrap();
    assert!(matches!(decoded_zero, Value::Boolean(false)));

    assert!(Decoder::decode(&BooleanCodec, &ffi::Stash::Void).is_err());
}

#[test]
fn ptr_to_value_treats_nonzero_as_true() {
    let anchor: u8 = 0;
    let truthy = unsafe {
        Decoder::read(
            &BooleanCodec,
            ReadSource::Value(&anchor as *const u8 as *mut c_void, "ctx"),
        )
    }
    .unwrap();
    assert!(matches!(truthy, Value::Boolean(true)));

    let falsy = unsafe {
        Decoder::read(
            &BooleanCodec,
            ReadSource::Value(std::ptr::null_mut(), "ctx"),
        )
    }
    .unwrap();
    assert!(matches!(falsy, Value::Boolean(false)));
}

#[test]
fn read_from_pointer_reads_i32_slot() {
    let truthy_slot: i32 = 1;
    let truthy_ptr = &truthy_slot as *const i32 as *const c_void;
    let read =
        unsafe { Decoder::read(&BooleanCodec, ReadSource::Slot(truthy_ptr, "ctx")) }.unwrap();
    assert!(matches!(read, Value::Boolean(true)));

    let falsy_slot: i32 = 0;
    let falsy_ptr = &falsy_slot as *const i32 as *const c_void;
    let read_zero =
        unsafe { Decoder::read(&BooleanCodec, ReadSource::Slot(falsy_ptr, "ctx")) }.unwrap();
    assert!(matches!(read_zero, Value::Boolean(false)));
}

#[test]
fn write_return_to_pointer_writes_truthiness() {
    let mut slot: i64 = -1;
    let ret = &mut slot as *mut i64 as *mut c_void;

    PtrWriter::write_return_to_ptr(
        &BooleanCodec,
        unsafe { Slot::new(ret) },
        &Ok(Value::Boolean(true)),
    );
    assert_eq!(slot, 1);

    PtrWriter::write_return_to_ptr(
        &BooleanCodec,
        unsafe { Slot::new(ret) },
        &Ok(Value::Boolean(false)),
    );
    assert_eq!(slot, 0);

    PtrWriter::write_return_to_ptr(&BooleanCodec, unsafe { Slot::new(ret) }, &Err(()));
    assert_eq!(slot, 0);
}

#[test]
fn write_value_to_pointer_writes_boolean_and_rejects_other() {
    let mut slot: i32 = -1;
    let ptr = &mut slot as *mut i32 as *mut c_void;

    PtrWriter::write_value_to_ptr(
        &BooleanCodec,
        unsafe { Slot::new(ptr) },
        &Value::Boolean(true),
    )
    .unwrap();
    assert_eq!(slot, 1);

    PtrWriter::write_value_to_ptr(
        &BooleanCodec,
        unsafe { Slot::new(ptr) },
        &Value::Boolean(false),
    )
    .unwrap();
    assert_eq!(slot, 0);

    assert!(
        PtrWriter::write_value_to_ptr(
            &BooleanCodec,
            unsafe { Slot::new(ptr) },
            &Value::Number(1.0)
        )
        .is_err()
    );
}

use std::ffi::c_void;
use std::sync::atomic::{AtomicBool, Ordering};

use libffi::middle;
use native::ffi;
use native::types::{FfiDecoder, FfiEncoder, RawPtrCodec, ReadSource, VoidType};
use native::value::Value;

static CALLED: AtomicBool = AtomicBool::new(false);

extern "C" fn ret_void() {
    CALLED.store(true, Ordering::SeqCst);
}

#[test]
fn encode_always_yields_null_pointer() {
    let encoded = FfiEncoder::encode(&VoidType, &Value::Undefined).unwrap();
    assert!(matches!(encoded, ffi::FfiValue::Ptr(p) if p.is_null()));

    let encoded_other = FfiEncoder::encode(&VoidType, &Value::Number(1.0)).unwrap();
    assert!(matches!(encoded_other, ffi::FfiValue::Ptr(p) if p.is_null()));
}

#[test]
fn libffi_type_is_void() {
    assert_eq!(
        FfiEncoder::libffi_type(&VoidType).as_raw_ptr(),
        middle::Type::void().as_raw_ptr()
    );
}

#[test]
fn call_cif_invokes_native_function() {
    CALLED.store(false, Ordering::SeqCst);
    let cif = middle::Cif::new(Vec::new(), middle::Type::void());
    let result = FfiEncoder::call_cif(
        &VoidType,
        &cif,
        middle::CodePtr(ret_void as *mut c_void),
        &[],
    )
    .unwrap();
    assert!(matches!(result, ffi::FfiValue::Void));
    assert!(CALLED.load(Ordering::SeqCst));
}

#[test]
fn decode_yields_undefined() {
    let decoded = FfiDecoder::decode(&VoidType, &ffi::FfiValue::Void).unwrap();
    assert!(matches!(decoded, Value::Undefined));

    let decoded_other = FfiDecoder::decode(&VoidType, &ffi::FfiValue::I32(3)).unwrap();
    assert!(matches!(decoded_other, Value::Undefined));
}

#[test]
fn ptr_to_value_yields_undefined() {
    // SAFETY: `VoidType` ignores the `ReadSource::Value` pointer entirely and always yields
    // `Undefined`, so passing null never dereferences anything.
    let from_null =
        unsafe { FfiDecoder::read(&VoidType, ReadSource::Value(std::ptr::null_mut(), "ctx")) }
            .unwrap();
    assert!(matches!(from_null, Value::Undefined));

    // SAFETY: `VoidType` ignores the `ReadSource::Value` pointer, so the dangling sentinel `8` is
    // never dereferenced; the read is sound and yields `Undefined`.
    let from_ptr =
        unsafe { FfiDecoder::read(&VoidType, ReadSource::Value(8 as *mut c_void, "ctx")) }.unwrap();
    assert!(matches!(from_ptr, Value::Undefined));
}

#[test]
fn read_from_raw_ptr_yields_undefined() {
    let mut slot: usize = 42;
    let ptr = &mut slot as *mut usize as *const c_void;
    // SAFETY: `VoidType` ignores the `ReadSource::Slot` pointer and always yields `Undefined`;
    // `ptr` still references the live `slot` stack local and is never dereferenced.
    let read = unsafe { FfiDecoder::read(&VoidType, ReadSource::Slot(ptr, "ctx")) }.unwrap();
    assert!(matches!(read, Value::Undefined));
}

#[test]
fn write_return_to_raw_ptr_is_a_no_op() {
    let mut slot: usize = 99;
    let ret = &mut slot as *mut usize as *mut c_void;
    // SAFETY: `VoidType::write_return_to_raw_ptr` is a no-op that never touches `ret`; the live
    // `slot` pointer is passed only to satisfy the signature.
    unsafe { RawPtrCodec::write_return_to_raw_ptr(&VoidType, ret, &Ok(Value::Undefined)) };
    // SAFETY: same no-op write for the error case; `ret` is never dereferenced.
    unsafe { RawPtrCodec::write_return_to_raw_ptr(&VoidType, ret, &Err(())) };
    assert_eq!(slot, 99);
}

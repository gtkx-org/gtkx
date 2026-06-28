use std::ffi::c_void;
use std::sync::atomic::{AtomicBool, Ordering};

use libffi::middle;
use native::ffi;
use native::ffi::descriptor::{FfiDecoder, FfiEncoder, PointerWriter, ReadSource, VoidDescriptor};
use native::ffi::value::Value;

static CALLED: AtomicBool = AtomicBool::new(false);

extern "C" fn ret_void() {
    CALLED.store(true, Ordering::SeqCst);
}

#[test]
fn encode_always_yields_null_pointer() {
    let encoded = FfiEncoder::encode(&VoidDescriptor, &Value::Undefined).unwrap();
    assert!(matches!(encoded, ffi::StashedValue::Ptr(p) if p.is_null()));

    let encoded_other = FfiEncoder::encode(&VoidDescriptor, &Value::Number(1.0)).unwrap();
    assert!(matches!(encoded_other, ffi::StashedValue::Ptr(p) if p.is_null()));
}

#[test]
fn libffi_type_is_void() {
    assert_eq!(
        FfiEncoder::libffi_type(&VoidDescriptor).as_raw_ptr(),
        middle::Type::void().as_raw_ptr()
    );
}

#[test]
fn call_cif_invokes_native_function() {
    CALLED.store(false, Ordering::SeqCst);
    let cif = middle::Cif::new(Vec::new(), middle::Type::void());
    let result = FfiEncoder::call_cif(
        &VoidDescriptor,
        &cif,
        middle::CodePtr(ret_void as *mut c_void),
        &[],
    )
    .unwrap();
    assert!(matches!(result, ffi::StashedValue::Void));
    assert!(CALLED.load(Ordering::SeqCst));
}

#[test]
fn decode_yields_undefined() {
    let decoded = FfiDecoder::decode(&VoidDescriptor, &ffi::StashedValue::Void).unwrap();
    assert!(matches!(decoded, Value::Undefined));

    let decoded_other = FfiDecoder::decode(&VoidDescriptor, &ffi::StashedValue::I32(3)).unwrap();
    assert!(matches!(decoded_other, Value::Undefined));
}

#[test]
fn ptr_to_value_yields_undefined() {
    let from_null = unsafe {
        FfiDecoder::read(
            &VoidDescriptor,
            ReadSource::Value(std::ptr::null_mut(), "ctx"),
        )
    }
    .unwrap();
    assert!(matches!(from_null, Value::Undefined));

    let from_ptr =
        unsafe { FfiDecoder::read(&VoidDescriptor, ReadSource::Value(8 as *mut c_void, "ctx")) }
            .unwrap();
    assert!(matches!(from_ptr, Value::Undefined));
}

#[test]
fn read_from_pointer_yields_undefined() {
    let mut slot: usize = 42;
    let ptr = &mut slot as *mut usize as *const c_void;
    let read = unsafe { FfiDecoder::read(&VoidDescriptor, ReadSource::Slot(ptr, "ctx")) }.unwrap();
    assert!(matches!(read, Value::Undefined));
}

#[test]
fn write_return_to_pointer_is_a_no_op() {
    let mut slot: usize = 99;
    let ret = &mut slot as *mut usize as *mut c_void;
    unsafe { PointerWriter::write_return_to_pointer(&VoidDescriptor, ret, &Ok(Value::Undefined)) };
    unsafe { PointerWriter::write_return_to_pointer(&VoidDescriptor, ret, &Err(())) };
    assert_eq!(slot, 99);
}

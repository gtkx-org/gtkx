mod common;

use std::ffi::c_void;

use native::types::{FfiDecoder, Ownership, RawPtrCodec, ReadSource, StructType};
use native::value::Value;
use native::{NativeHandle, value};

fn struct_type() -> StructType {
    StructType {
        ownership: Ownership::Borrowed,
        size: None,
        caller_allocated: false,
    }
}

#[test]
fn null_guarded_short_circuits_null_pointer() {
    // SAFETY: a null `ReadSource::Value` is short-circuited by the codec's null guard before any
    // dereference, so reading from null is sound and yields `Value::Null`.
    let decoded = unsafe {
        FfiDecoder::read(
            &struct_type(),
            ReadSource::Value(std::ptr::null_mut(), "ctx"),
        )
    }
    .unwrap();
    assert!(matches!(decoded, Value::Null));
}

#[test]
fn null_guarded_runs_decode_for_non_null_pointer() {
    let source: u64 = 0xDEAD_BEEF;
    let ptr = &source as *const u64 as *mut c_void;
    // SAFETY: the borrowed, size-less `StructType` wraps the non-null `ptr` as an unowned handle
    // without dereferencing it; `ptr` points to the live `source` stack local, so this is sound.
    let decoded =
        unsafe { FfiDecoder::read(&struct_type(), ReadSource::Value(ptr, "ctx")) }.unwrap();
    assert!(matches!(decoded, Value::Object(_)));
}

#[test]
fn write_object_ptr_writes_object_pointer() {
    let target: u64 = 1;
    let handle = NativeHandle::borrowed(&target as *const u64 as *mut c_void);

    let mut slot: *mut c_void = std::ptr::null_mut();
    let slot_ptr = &mut slot as *mut *mut c_void as *mut c_void;

    // SAFETY: `slot_ptr` points to the live, writable pointer-sized stack local `slot`, exactly
    // the pointer slot `write_value_to_raw_ptr` stores the handle's object pointer into.
    unsafe {
        RawPtrCodec::write_value_to_raw_ptr(&struct_type(), slot_ptr, &Value::Object(handle))
    }
    .unwrap();
    assert_eq!(slot, &target as *const u64 as *mut c_void);
}

#[test]
fn write_object_ptr_writes_null_for_null_value() {
    let mut slot: *mut c_void = 7 as *mut c_void;
    let slot_ptr = &mut slot as *mut *mut c_void as *mut c_void;

    // SAFETY: `slot_ptr` points to the live, writable pointer-sized stack local `slot`; writing a
    // null object pointer into that slot is in bounds.
    unsafe { RawPtrCodec::write_value_to_raw_ptr(&struct_type(), slot_ptr, &Value::Null) }.unwrap();
    assert!(slot.is_null());
}

#[test]
fn write_return_object_ptr_writes_null_for_error() {
    let mut slot: *mut c_void = 9 as *mut c_void;
    let ret = &mut slot as *mut *mut c_void as *mut c_void;

    // SAFETY: `ret` points to the live, writable pointer-sized stack local `slot`; the error case
    // writes a null pointer into that in-bounds slot.
    unsafe { RawPtrCodec::write_return_to_raw_ptr(&struct_type(), ret, &Err(())) };
    assert!(slot.is_null());
}

#[test]
fn write_return_object_ptr_transfers_non_null_pointer() {
    let target: u64 = 2;
    let handle = NativeHandle::borrowed(&target as *const u64 as *mut c_void);

    let mut slot: *mut c_void = std::ptr::null_mut();
    let ret = &mut slot as *mut *mut c_void as *mut c_void;

    // SAFETY: `ret` points to the live, writable pointer-sized stack local `slot`; the borrowed
    // handle's object pointer is written into that in-bounds slot.
    unsafe {
        RawPtrCodec::write_return_to_raw_ptr(
            &struct_type(),
            ret,
            &Ok(value::Value::Object(handle)),
        );
    }
    assert_eq!(slot, &target as *const u64 as *mut c_void);
}

#[test]
fn write_return_object_ptr_writes_null_for_non_object_ok() {
    let mut slot: *mut c_void = 11 as *mut c_void;
    let ret = &mut slot as *mut *mut c_void as *mut c_void;

    // SAFETY: `ret` points to the live, writable pointer-sized stack local `slot`; a non-object
    // `Ok` value writes null into that in-bounds slot.
    unsafe { RawPtrCodec::write_return_to_raw_ptr(&struct_type(), ret, &Ok(Value::Number(3.0))) };
    assert!(slot.is_null());
}

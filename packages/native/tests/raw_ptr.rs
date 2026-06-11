//! Coverage for the shared raw-pointer primitives in `src/types/raw_ptr.rs`.
//!
//! The helpers are `pub(super)` to the `types` module, so they are exercised
//! here through the [`RawPtrCodec`] implementation of [`StructType`], which
//! routes its three pointer operations straight through them.

mod common;

use std::ffi::c_void;

use native::types::{Ownership, RawPtrCodec, StructType};
use native::value::Value;
use native::{NativeHandle, value};

fn struct_type() -> StructType {
    StructType {
        ownership: Ownership::Borrowed,
        size: None,
    }
}

#[test]
fn null_guarded_short_circuits_null_pointer() {
    // SAFETY: Null short-circuits before any read.
    let decoded =
        unsafe { RawPtrCodec::ptr_to_value(&struct_type(), std::ptr::null_mut(), "ctx") }.unwrap();
    assert!(matches!(decoded, Value::Null));
}

#[test]
fn null_guarded_runs_decode_for_non_null_pointer() {
    let source: u64 = 0xDEAD_BEEF;
    let ptr = &source as *const u64 as *mut c_void;
    // SAFETY: `ptr` addresses a live local u64.
    let decoded = unsafe { RawPtrCodec::ptr_to_value(&struct_type(), ptr, "ctx") }.unwrap();
    assert!(matches!(decoded, Value::Object(_)));
}

#[test]
fn write_object_ptr_writes_object_pointer() {
    let target: u64 = 1;
    let handle = NativeHandle::borrowed(&target as *const u64 as *mut c_void);

    let mut slot: *mut c_void = std::ptr::null_mut();
    let slot_ptr = &mut slot as *mut *mut c_void as *mut c_void;

    // SAFETY: `slot_ptr` addresses a writable local pointer-sized slot.
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

    // SAFETY: `slot_ptr` addresses a writable local pointer-sized slot.
    unsafe { RawPtrCodec::write_value_to_raw_ptr(&struct_type(), slot_ptr, &Value::Null) }.unwrap();
    assert!(slot.is_null());
}

#[test]
fn write_object_ptr_rejects_non_object_value() {
    let mut slot: *mut c_void = std::ptr::null_mut();
    let slot_ptr = &mut slot as *mut *mut c_void as *mut c_void;

    // SAFETY: `slot_ptr` addresses a writable local pointer-sized slot.
    let err = unsafe {
        RawPtrCodec::write_value_to_raw_ptr(&struct_type(), slot_ptr, &Value::Number(1.0))
    };
    assert!(err.is_err());
}

#[test]
fn write_return_object_ptr_writes_null_for_error() {
    let mut slot: *mut c_void = 9 as *mut c_void;
    let ret = &mut slot as *mut *mut c_void as *mut c_void;

    // SAFETY: `ret` addresses a writable local pointer-sized slot.
    unsafe { RawPtrCodec::write_return_to_raw_ptr(&struct_type(), ret, &Err(())) };
    assert!(slot.is_null());
}

#[test]
fn write_return_object_ptr_transfers_non_null_pointer() {
    let target: u64 = 2;
    let handle = NativeHandle::borrowed(&target as *const u64 as *mut c_void);

    let mut slot: *mut c_void = std::ptr::null_mut();
    let ret = &mut slot as *mut *mut c_void as *mut c_void;

    // SAFETY: `ret` addresses a writable local pointer-sized slot.
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

    // SAFETY: `ret` addresses a writable local pointer-sized slot.
    unsafe { RawPtrCodec::write_return_to_raw_ptr(&struct_type(), ret, &Ok(Value::Number(3.0))) };
    assert!(slot.is_null());
}

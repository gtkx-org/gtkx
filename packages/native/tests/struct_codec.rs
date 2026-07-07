use std::ffi::c_void;

use native::Handle;
use native::ffi::Slot;
use native::ffi::codec::{Decoder, Ownership, PtrWriter, ReadSource, StructCodec};
use native::ffi::value;
use native::ffi::value::Value;

fn struct_type() -> StructCodec {
    StructCodec {
        ownership: Ownership::Borrowed,
        size: None,
        caller_allocated: false,
    }
}

#[test]
fn null_guarded_short_circuits_null_pointer() {
    let decoded = unsafe {
        Decoder::read(
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
    let decoded = unsafe { Decoder::read(&struct_type(), ReadSource::Value(ptr, "ctx")) }.unwrap();
    assert!(matches!(decoded, Value::Object(_)));
}

#[test]
fn write_object_ptr_writes_object_pointer() {
    let target: u64 = 1;
    let handle = Handle::from_glib_borrow(&target as *const u64 as *mut c_void);

    let mut slot: *mut c_void = std::ptr::null_mut();
    let slot_ptr = &mut slot as *mut *mut c_void as *mut c_void;

    PtrWriter::write_value_to_ptr(
        &struct_type(),
        unsafe { Slot::new(slot_ptr) },
        &Value::Object(handle),
    )
    .unwrap();
    assert_eq!(slot, &target as *const u64 as *mut c_void);
}

#[test]
fn write_object_ptr_writes_null_for_null_value() {
    let mut slot: *mut c_void = 7 as *mut c_void;
    let slot_ptr = &mut slot as *mut *mut c_void as *mut c_void;

    PtrWriter::write_value_to_ptr(&struct_type(), unsafe { Slot::new(slot_ptr) }, &Value::Null)
        .unwrap();
    assert!(slot.is_null());
}

#[test]
fn write_return_object_ptr_writes_null_for_error() {
    let mut slot: *mut c_void = 9 as *mut c_void;
    let ret = &mut slot as *mut *mut c_void as *mut c_void;

    PtrWriter::write_return_to_ptr(&struct_type(), unsafe { Slot::new(ret) }, &Err(()));
    assert!(slot.is_null());
}

#[test]
fn write_return_object_ptr_transfers_non_null_pointer() {
    let target: u64 = 2;
    let handle = Handle::from_glib_borrow(&target as *const u64 as *mut c_void);

    let mut slot: *mut c_void = std::ptr::null_mut();
    let ret = &mut slot as *mut *mut c_void as *mut c_void;

    PtrWriter::write_return_to_ptr(
        &struct_type(),
        unsafe { Slot::new(ret) },
        &Ok(value::Value::Object(handle)),
    );
    assert_eq!(slot, &target as *const u64 as *mut c_void);
}

#[test]
fn write_return_object_ptr_writes_null_for_non_object_ok() {
    let mut slot: *mut c_void = 11 as *mut c_void;
    let ret = &mut slot as *mut *mut c_void as *mut c_void;

    PtrWriter::write_return_to_ptr(
        &struct_type(),
        unsafe { Slot::new(ret) },
        &Ok(Value::Number(3.0)),
    );
    assert!(slot.is_null());
}

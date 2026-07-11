use std::ffi::c_void;

use native::Handle;
use native::ffi::Slot;
use native::ffi::codec::{Decoder, Ownership, PtrWriter, ReadSource, StructCodec};

use napi::JsValue as _;
use napi::bindgen_prelude::{External, Unknown};

use test_support::napi_mock;

fn struct_type() -> StructCodec {
    StructCodec {
        ownership: Ownership::Borrowed,
        size: None,
        caller_allocated: false,
    }
}

#[test]
fn null_guarded_short_circuits_null_pointer() {
    test_support::run(|| {
        let env = test_support::fake_env();
        let decoded = unsafe {
            Decoder::read(
                &struct_type(),
                &env,
                ReadSource::Value(std::ptr::null_mut(), "ctx"),
            )
        }
        .unwrap();
        assert!(napi_mock::is_null(decoded.raw()));
    });
}

#[test]
fn null_guarded_runs_decode_for_non_null_pointer() {
    test_support::run(|| {
        let env = test_support::fake_env();
        let source: u64 = 0xDEAD_BEEF;
        let ptr = &source as *const u64 as *mut c_void;
        let decoded =
            unsafe { Decoder::read(&struct_type(), &env, ReadSource::Value(ptr, "ctx")) }.unwrap();
        assert!(napi_mock::read_external(decoded.raw()).is_some());
    });
}

#[test]
fn write_object_ptr_writes_object_pointer() {
    test_support::run(|| {
        let env = test_support::fake_env();
        let target: u64 = 1;
        let handle = Handle::from_glib_borrow(&target as *const u64 as *mut c_void);
        let value = External::new(handle).into_unknown(&env).unwrap();

        let mut slot: *mut c_void = std::ptr::null_mut();
        let slot_ptr = &mut slot as *mut *mut c_void as *mut c_void;

        PtrWriter::write_value_to_ptr(&struct_type(), &env, unsafe { Slot::new(slot_ptr) }, value)
            .unwrap();
        assert_eq!(slot, &target as *const u64 as *mut c_void);
    });
}

#[test]
fn write_object_ptr_writes_null_for_null_value() {
    test_support::run(|| {
        let env = test_support::fake_env();
        let mut slot: *mut c_void = 7 as *mut c_void;
        let slot_ptr = &mut slot as *mut *mut c_void as *mut c_void;

        PtrWriter::write_value_to_ptr(
            &struct_type(),
            &env,
            unsafe { Slot::new(slot_ptr) },
            napi_mock::to_unknown(&env, napi_mock::fake_null()),
        )
        .unwrap();
        assert!(slot.is_null());
    });
}

#[test]
fn write_return_object_ptr_writes_null_for_error() {
    test_support::run(|| {
        let env = test_support::fake_env();
        let mut slot: *mut c_void = 9 as *mut c_void;
        let ret = &mut slot as *mut *mut c_void as *mut c_void;

        PtrWriter::write_return_to_ptr(&struct_type(), &env, unsafe { Slot::new(ret) }, &Err(()));
        assert!(slot.is_null());
    });
}

#[test]
fn write_return_object_ptr_transfers_non_null_pointer() {
    test_support::run(|| {
        let env = test_support::fake_env();
        let target: u64 = 2;
        let handle = Handle::from_glib_borrow(&target as *const u64 as *mut c_void);
        let value: Result<Unknown, ()> = Ok(External::new(handle).into_unknown(&env).unwrap());

        let mut slot: *mut c_void = std::ptr::null_mut();
        let ret = &mut slot as *mut *mut c_void as *mut c_void;

        PtrWriter::write_return_to_ptr(&struct_type(), &env, unsafe { Slot::new(ret) }, &value);
        assert_eq!(slot, &target as *const u64 as *mut c_void);
    });
}

#[test]
fn write_return_object_ptr_writes_null_for_non_object_ok() {
    test_support::run(|| {
        let env = test_support::fake_env();
        let mut slot: *mut c_void = 11 as *mut c_void;
        let ret = &mut slot as *mut *mut c_void as *mut c_void;

        let value: Result<Unknown, ()> =
            Ok(napi_mock::to_unknown(&env, napi_mock::fake_double(3.0)));
        PtrWriter::write_return_to_ptr(&struct_type(), &env, unsafe { Slot::new(ret) }, &value);
        assert!(slot.is_null());
    });
}

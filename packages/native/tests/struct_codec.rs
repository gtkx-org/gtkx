use std::ffi::c_void;

use gtk4::glib;

use native::Handle;
use native::ffi;
use native::ffi::Slot;
use native::ffi::codec::{Decoder, Encoder, Ownership, PtrWriter, ReadSource, StructCodec};

use napi::Env;
use napi::JsValue as _;
use napi::bindgen_prelude::{External, Unknown};

use test_support::napi_mock;
use test_support::write_return_into_slot;

test_support::g_free_recorder!();

fn struct_type() -> StructCodec {
    StructCodec {
        ownership: Ownership::Borrowed,
        size: None,
        caller_allocated: false,
    }
}

fn struct_codec(ownership: Ownership, size: Option<usize>) -> StructCodec {
    StructCodec {
        ownership,
        size,
        caller_allocated: false,
    }
}

fn handle_value_of<'e>(env: &'e Env, ptr: *mut c_void) -> Unknown<'e> {
    External::new(Handle::from_glib_borrow(ptr))
        .into_unknown(env)
        .expect("external into unknown should succeed")
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

fn encode_full_sized_copy(env: &Env, original: *mut c_void) -> ffi::Stash {
    let encoded = struct_codec(Ownership::Full, Some(std::mem::size_of::<u64>()))
        .encode(env, handle_value_of(env, original))
        .expect("full encode should succeed");
    let copy = encoded
        .as_ptr("struct argument")
        .expect("encoded stash should carry a pointer");
    assert!(!copy.is_null());
    assert_ne!(copy, original);
    assert_eq!(unsafe { *(copy as *const u64) }, unsafe {
        *(original as *const u64)
    });
    encoded
}

#[test]
fn encode_full_sized_frees_copy_when_call_never_happens() {
    test_support::run(|| {
        let env = test_support::fake_env();
        let source: u64 = 0x5AFE_C0DE_5AFE_C0DE;
        let original = &source as *const u64 as *mut c_void;

        let encoded = encode_full_sized_copy(&env, original);
        let copy = encoded.as_ptr("struct argument").unwrap();

        drain_g_freed();
        drop(encoded);
        let frees_of_copy = drain_g_freed()
            .iter()
            .filter(|&&ptr| ptr == copy as usize)
            .count();
        assert_eq!(
            frees_of_copy, 1,
            "dropping an undisarmed stash must free the transfer copy exactly once"
        );
    });
}

#[test]
fn encode_full_sized_disarm_leaves_copy_for_callee() {
    test_support::run(|| {
        let env = test_support::fake_env();
        let source: u64 = 0xFEED_FACE_FEED_FACE;
        let original = &source as *const u64 as *mut c_void;

        let encoded = encode_full_sized_copy(&env, original);
        let copy = encoded.as_ptr("struct argument").unwrap();

        drain_g_freed();
        encoded.disarm_pending_transfer();
        drop(encoded);
        assert!(
            !drain_g_freed().contains(&(copy as usize)),
            "a disarmed stash must leave the callee-owned copy untouched"
        );
        assert_eq!(unsafe { *(copy as *const u64) }, 0xFEED_FACE_FEED_FACE);
        unsafe { glib::ffi::g_free(copy) };
    });
}

#[test]
fn write_return_full_with_size_writes_a_distinct_copy() {
    test_support::run(|| {
        let env = test_support::fake_env();
        let source: u64 = 0x1234_5678_9ABC_DEF0;
        let original = &source as *const u64 as *mut c_void;

        let slot = write_return_into_slot(
            &env,
            &struct_codec(Ownership::Full, Some(std::mem::size_of::<u64>())),
            &Ok(handle_value_of(&env, original)),
        );

        assert!(!slot.is_null());
        assert_ne!(slot, original);
        assert_eq!(unsafe { *(slot as *const u64) }, 0x1234_5678_9ABC_DEF0);
        assert_eq!(source, 0x1234_5678_9ABC_DEF0);
        assert!(napi_mock::fatal_exceptions().is_empty());

        unsafe { glib::ffi::g_free(slot) };
    });
}

#[test]
fn write_return_full_without_size_writes_null_and_reports() {
    test_support::run(|| {
        let env = test_support::fake_env();
        let target: u64 = 3;
        let original = &target as *const u64 as *mut c_void;

        let slot = write_return_into_slot(
            &env,
            &struct_codec(Ownership::Full, None),
            &Ok(handle_value_of(&env, original)),
        );

        assert!(
            slot.is_null(),
            "a transfer-full struct return without a known size must not alias ownership"
        );
        assert_eq!(napi_mock::fatal_exceptions().len(), 1);
    });
}

#[test]
fn write_return_borrowed_writes_same_pointer_without_reporting() {
    test_support::run(|| {
        let env = test_support::fake_env();
        let target: u64 = 6;
        let original = &target as *const u64 as *mut c_void;

        let slot = write_return_into_slot(
            &env,
            &struct_codec(Ownership::Borrowed, None),
            &Ok(handle_value_of(&env, original)),
        );

        assert_eq!(slot, original);
        assert!(napi_mock::fatal_exceptions().is_empty());
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

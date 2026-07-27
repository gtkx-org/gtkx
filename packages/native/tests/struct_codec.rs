use std::ffi::c_void;

use gtk4::glib;

use native::Handle;
use native::ffi;
use native::ffi::Slot;
use native::ffi::codec::{
    Decoder, Encoder, Ownership, PtrWriter, ReadSource, SlotInit, StructCodec,
};

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
        inline: false,
    }
}

fn struct_codec(ownership: Ownership, size: Option<usize>) -> StructCodec {
    StructCodec {
        ownership,
        size,
        caller_allocated: false,
        inline: false,
    }
}

fn handle_value_of(env: &Env, ptr: *mut c_void) -> Unknown<'_> {
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
        let ptr = &raw const source as *mut c_void;
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
        let handle = Handle::from_glib_borrow(&raw const target as *mut c_void);
        let value = External::new(handle).into_unknown(&env).unwrap();

        let slot =
            test_support::write_value_into_slot(&env, &struct_type(), std::ptr::null_mut(), value);
        assert_eq!(slot, &raw const target as *mut c_void);
    });
}

#[test]
fn write_object_ptr_writes_null_for_null_value() {
    test_support::run(|| {
        let env = test_support::fake_env();
        let slot = test_support::write_value_into_slot(
            &env,
            &struct_type(),
            7 as *mut c_void,
            napi_mock::to_unknown(&env, napi_mock::fake_null()),
        );
        assert!(slot.is_null());
    });
}

#[test]
fn write_return_object_ptr_writes_null_for_error() {
    test_support::run(|| {
        test_support::assert_write_return_err_writes_null(&struct_type());
    });
}

#[test]
fn write_return_object_ptr_transfers_non_null_pointer() {
    test_support::run(|| {
        let env = test_support::fake_env();
        let target: u64 = 2;
        let handle = Handle::from_glib_borrow(&raw const target as *mut c_void);
        let value: Result<Unknown<'_>, ()> = Ok(External::new(handle).into_unknown(&env).unwrap());

        let slot = write_return_into_slot(&env, &struct_type(), &value);
        assert_eq!(slot, &raw const target as *mut c_void);
    });
}

fn encode_full_sized_copy(env: &Env, original: *mut c_void) -> ffi::Stash {
    let encoded = struct_codec(Ownership::Full, Some(size_of::<u64>()))
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
        let original = &raw const source as *mut c_void;

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
        let original = &raw const source as *mut c_void;

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
        let original = &raw const source as *mut c_void;

        let slot = write_return_into_slot(
            &env,
            &struct_codec(Ownership::Full, Some(size_of::<u64>())),
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
        let original = &raw const target as *mut c_void;

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
        let original = &raw const target as *mut c_void;

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
        let value: Result<Unknown<'_>, ()> =
            Ok(napi_mock::to_unknown(&env, napi_mock::fake_double(3.0)));
        let slot = write_return_into_slot(&env, &struct_type(), &value);
        assert!(slot.is_null());
    });
}

#[repr(C)]
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
struct InlineRecord {
    left: i32,
    right: i32,
}

fn inline_struct_codec() -> StructCodec {
    StructCodec {
        ownership: Ownership::Borrowed,
        size: Some(size_of::<InlineRecord>()),
        caller_allocated: false,
        inline: true,
    }
}

#[test]
fn an_inline_field_is_read_at_its_own_address() {
    test_support::run(|| {
        let env = test_support::fake_env();
        let record = InlineRecord { left: 3, right: 12 };
        let field_ptr = (&raw const record).cast::<c_void>();
        let decoded = unsafe {
            Decoder::read(
                &inline_struct_codec(),
                &env,
                ReadSource::Slot(field_ptr, "field read"),
            )
        }
        .expect("an inline field decodes from its own address");
        let ptr = native::value::handle_ptr(decoded, "inline field").expect("a handle pointer");
        assert_eq!(unsafe { ptr.cast::<InlineRecord>().read() }, record);
    });
}

#[test]
fn an_inline_field_is_written_at_its_own_address() {
    test_support::run(|| {
        let env = test_support::fake_env();
        let source = InlineRecord { left: 7, right: 9 };
        let mut target = InlineRecord { left: 0, right: 0 };
        let value = handle_value_of(&env, (&raw const source).cast_mut().cast::<c_void>());

        PtrWriter::write_value_to_ptr(
            &inline_struct_codec(),
            &env,
            unsafe { Slot::new((&raw mut target).cast::<c_void>()) },
            value,
            SlotInit::Initialized,
        )
        .expect("an inline field writes in place");

        assert_eq!(target, source);
    });
}

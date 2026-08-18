use std::ffi::c_void;

use gtk4::glib;
use napi::bindgen_prelude::{External, Unknown};
use napi::{Env, JsValue as _};
use native::api::read::read;
use native::api::write::write;
use native::ffi::Slot;
use native::ffi::codec::{Decoder, Encoder, Ownership, PtrWriter, ReadCtx, SlotInit, StructCodec};
use native::ffi::descriptor::Descriptor;
use native::{Handle, ffi};
use test_support::{napi_mock, write_return_into_slot};

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
                ReadCtx::value(std::ptr::null_mut(), "ctx"),
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
            unsafe { Decoder::read(&struct_type(), &env, ReadCtx::value(ptr, "ctx")) }.unwrap();
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

fn assert_transfer_full_encode_is_refused(size: Option<usize>) {
    test_support::run(|| {
        let env = test_support::fake_env();
        let source: u64 = 0x5AFE_C0DE_5AFE_C0DE;
        let original = &raw const source as *mut c_void;

        assert!(
            struct_codec(Ownership::Full, size)
                .encode(&env, handle_value_of(&env, original))
                .is_err()
        );
        assert_eq!(source, 0x5AFE_C0DE_5AFE_C0DE);
    });
}

#[test]
fn encode_transfer_full_is_refused_for_a_sized_struct() {
    assert_transfer_full_encode_is_refused(Some(size_of::<u64>()));
}

#[test]
fn encode_transfer_full_is_refused_for_an_unsized_struct() {
    assert_transfer_full_encode_is_refused(None);
}

#[test]
fn encode_borrowed_lends_the_pointer_it_was_given() {
    test_support::run(|| {
        let env = test_support::fake_env();
        let source: u64 = 0xFEED_FACE_FEED_FACE;
        let original = &raw const source as *mut c_void;

        let encoded = struct_codec(Ownership::Borrowed, Some(size_of::<u64>()))
            .encode(&env, handle_value_of(&env, original))
            .expect("a transfer-none struct argument is lent as it stands");

        assert_eq!(
            encoded.as_ptr("struct argument").expect("a pointer"),
            original
        );

        drain_g_freed();
        drop(encoded);
        assert!(drain_g_freed().is_empty());
    });
}

#[test]
fn decode_transfer_full_return_is_refused() {
    test_support::run(|| {
        let env = test_support::fake_env();
        let source: u64 = 0x1234_5678_9ABC_DEF0;
        let original = &raw const source as *mut c_void;

        assert!(
            Decoder::decode(
                &struct_codec(Ownership::Full, Some(size_of::<u64>())),
                &env,
                &ffi::Stash::Ptr(original),
            )
            .is_err()
        );
    });
}

#[test]
fn decode_borrowed_return_copies_a_sized_struct() {
    test_support::run(|| {
        let env = test_support::fake_env();
        let source: u64 = 0x1234_5678_9ABC_DEF0;
        let original = &raw const source as *mut c_void;

        let decoded = Decoder::decode(
            &struct_codec(Ownership::Borrowed, Some(size_of::<u64>())),
            &env,
            &ffi::Stash::Ptr(original),
        )
        .expect("a transfer-none struct return decodes");
        let decoded_ptr = native::value::handle_ptr(decoded, "struct return").expect("a pointer");

        assert_ne!(decoded_ptr, original);
        assert_eq!(
            unsafe { *(decoded_ptr as *const u64) },
            0x1234_5678_9ABC_DEF0
        );
    });
}

#[test]
fn write_return_full_with_size_writes_null_and_reports() {
    test_support::run(|| {
        let env = test_support::fake_env();
        let source: u64 = 0x1234_5678_9ABC_DEF0;
        let original = &raw const source as *mut c_void;

        let slot = write_return_into_slot(
            &env,
            &struct_codec(Ownership::Full, Some(size_of::<u64>())),
            &Ok(handle_value_of(&env, original)),
        );

        assert!(slot.is_null());
        assert_eq!(napi_mock::fatal_exceptions().len(), 1);
    });
}

#[test]
fn write_value_transfer_full_into_an_uninitialized_slot_is_refused() {
    test_support::run(|| {
        let env = test_support::fake_env();
        let source: u64 = 7;
        let original = &raw const source as *mut c_void;
        let mut slot: *mut c_void = std::ptr::null_mut();

        assert!(
            PtrWriter::write_value_to_ptr(
                &struct_codec(Ownership::Full, Some(size_of::<u64>())),
                &env,
                unsafe { Slot::new((&raw mut slot).cast::<c_void>()) },
                handle_value_of(&env, original),
                SlotInit::Uninitialized,
            )
            .is_err()
        );
        assert!(slot.is_null());
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

#[test]
fn a_handed_over_struct_callback_argument_is_refused() {
    test_support::run(|| {
        let env = test_support::fake_env();
        let source: u64 = 9;
        let slot = (&raw const source).cast_mut().cast::<c_void>();

        assert!(
            unsafe {
                Decoder::read(
                    &struct_codec(Ownership::Full, Some(size_of::<u64>())),
                    &env,
                    ReadCtx::slot((&raw const slot).cast::<c_void>(), "callback arg")
                        .with_transfer(Ownership::Full),
                )
            }
            .is_err()
        );
    });
}

#[repr(C)]
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
struct InlineRecord {
    left: i32,
    right: i32,
}

#[repr(C)]
struct InlineOwner {
    head: i32,
    inner: InlineRecord,
}

#[repr(C)]
struct PointerRecord {
    target: *mut c_void,
}

const INLINE_FIELD_OFFSET: f64 = 4.0;

fn inline_struct_codec() -> StructCodec {
    StructCodec {
        ownership: Ownership::Borrowed,
        size: Some(size_of::<InlineRecord>()),
        caller_allocated: false,
        inline: true,
    }
}

fn struct_descriptor(is_inline: Option<bool>) -> Descriptor {
    Descriptor::Struct {
        ownership: Ownership::Borrowed,
        size: Some(8),
        is_caller_allocated: None,
        is_inline,
    }
}

fn inline_struct_descriptor() -> Descriptor {
    struct_descriptor(Some(true))
}

fn null_owner() -> External<Handle> {
    External::new(Handle::owned_struct(std::ptr::null_mut()))
}

fn read_inline_field(env: &Env, handle: &External<Handle>) -> *mut c_void {
    let decoded = read(env, handle, inline_struct_descriptor(), INLINE_FIELD_OFFSET)
        .expect("an inline field reads from its owner");

    native::value::handle_ptr(decoded, "inline field").expect("a handle pointer")
}

#[test]
fn an_inline_field_is_read_at_its_own_address() {
    test_support::run(|| {
        let env = test_support::fake_env();
        let mut owner = InlineOwner {
            head: 5,
            inner: InlineRecord { left: 3, right: 12 },
        };
        let owner_ptr = (&raw mut owner).cast::<c_void>();
        let field_ptr = (&raw mut owner.inner).cast::<c_void>();
        let handle = External::new(Handle::from_glib_borrow(owner_ptr));
        let ptr = read_inline_field(&env, &handle);

        assert_eq!(ptr, field_ptr);

        unsafe {
            ptr.cast::<InlineRecord>()
                .write(InlineRecord { left: 7, right: 9 });
        }

        assert_eq!(owner.inner, InlineRecord { left: 7, right: 9 });
        assert_eq!(owner.head, 5);
    });
}

#[test]
fn an_inline_field_keeps_its_owner_alive() {
    test_support::run(|| {
        let env = test_support::fake_env();
        let block = unsafe { glib::ffi::g_malloc0(size_of::<InlineOwner>()) };
        let handle = External::new(Handle::owned_struct(block));
        let ptr = read_inline_field(&env, &handle);

        drain_g_freed();
        drop(handle);

        assert!(!drain_g_freed().contains(&(block as usize)));

        unsafe {
            ptr.cast::<InlineRecord>()
                .write(InlineRecord { left: 7, right: 9 });
        }

        assert_eq!(
            unsafe { ptr.cast::<InlineRecord>().read() },
            InlineRecord { left: 7, right: 9 }
        );
    });
}

fn assert_null_owner_read_is_rejected(descriptor: Descriptor, expectation: &str) {
    test_support::run(|| {
        let env = test_support::fake_env();
        let Err(error) = read(&env, &null_owner(), descriptor, INLINE_FIELD_OFFSET) else {
            panic!("{expectation}")
        };

        assert!(error.reason.contains("points at nothing"), "{expectation}");
    });
}

#[test]
fn an_inline_field_of_a_null_handle_cannot_be_read() {
    assert_null_owner_read_is_rejected(
        inline_struct_descriptor(),
        "an inline field of a handle that points at nothing has no address to alias",
    );
}

#[test]
fn a_pointer_field_of_a_null_handle_cannot_be_read() {
    assert_null_owner_read_is_rejected(
        struct_descriptor(None),
        "a field of a handle that points at nothing must be refused, not read at the bare offset",
    );
}

#[test]
fn a_scalar_field_of_a_null_handle_cannot_be_read() {
    assert_null_owner_read_is_rejected(
        Descriptor::Int32,
        "a scalar field must be refused rather than decode to null, which its typing forbids",
    );
}

#[test]
fn a_field_of_a_null_handle_cannot_be_written() {
    test_support::run(|| {
        let env = test_support::fake_env();
        let source = InlineRecord { left: 7, right: 9 };
        let value = handle_value_of(&env, (&raw const source).cast_mut().cast::<c_void>());
        let Err(error) = write(
            &env,
            &null_owner(),
            inline_struct_descriptor(),
            INLINE_FIELD_OFFSET,
            value,
        ) else {
            panic!("writing a field of a handle that points at nothing must be rejected")
        };

        assert!(
            error.reason.contains("points at nothing"),
            "a write into a handle that points at nothing must say so instead of writing at the bare offset"
        );
    });
}

#[test]
fn a_field_read_through_a_borrow_that_has_ended_is_rejected() {
    test_support::run(|| {
        let env = test_support::fake_env();
        let block = unsafe { glib::ffi::g_malloc0(size_of::<InlineOwner>()) };
        let owner = External::new(Handle::from_glib_borrow(block));

        assert_eq!(
            read_inline_field(&env, &owner),
            block.wrapping_byte_add(size_of::<i32>())
        );

        owner.invalidate();
        unsafe { glib::ffi::g_free(block) };

        let Err(error) = read(
            &env,
            &owner,
            inline_struct_descriptor(),
            INLINE_FIELD_OFFSET,
        ) else {
            panic!("reading a field of a borrow that has ended must be rejected")
        };

        assert!(
            error.reason.contains("refers to nothing"),
            "a field of a borrow that has ended must be refused, not aliased into freed memory"
        );
    });
}

#[test]
fn an_inline_struct_cannot_be_read_from_a_pointer_slot() {
    test_support::run(|| {
        let env = test_support::fake_env();
        let decoy = unsafe { glib::ffi::g_malloc0(size_of::<PointerRecord>()) };
        let slot = PointerRecord { target: decoy };
        let codec = StructCodec {
            size: Some(size_of::<PointerRecord>()),
            ..inline_struct_codec()
        };
        let result = unsafe {
            Decoder::read(
                &codec,
                &env,
                ReadCtx::slot((&raw const slot).cast::<c_void>(), "inline slot"),
            )
        };
        let Err(error) = result else {
            panic!("an inline struct reached through a pointer slot must be rejected")
        };

        assert!(
            format!("{error:#}").contains("has no pointer slot to read"),
            "an inline struct has no owner to alias here, so it must fail loudly rather than copy"
        );

        unsafe { glib::ffi::g_free(decoy) };
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

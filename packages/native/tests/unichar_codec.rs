use std::ffi::c_void;

use libffi::middle;
use napi::JsValue as _;
use native::ffi;
use native::ffi::Slot;
use native::ffi::codec::{Decoder, Encoder, PtrWriter, ReadSource, UnicharCodec};
use test_support::napi_mock;

extern "C" fn ret_codepoint() -> u32 {
    'Z' as u32
}

#[test]
fn encode_accepts_string_number_and_optional_null() {
    test_support::run(|| {
        let env = test_support::fake_env();

        let from_string = Encoder::encode(
            &UnicharCodec,
            &env,
            napi_mock::to_unknown(&env, napi_mock::fake_string("A")),
        )
        .unwrap();
        assert!(matches!(from_string, ffi::Stash::U32(c) if c == 'A' as u32));

        let from_empty = Encoder::encode(
            &UnicharCodec,
            &env,
            napi_mock::to_unknown(&env, napi_mock::fake_string("")),
        )
        .unwrap();
        assert!(matches!(from_empty, ffi::Stash::U32(0)));

        let from_number = Encoder::encode(
            &UnicharCodec,
            &env,
            napi_mock::to_unknown(&env, napi_mock::fake_double(66.0)),
        )
        .unwrap();
        assert!(matches!(from_number, ffi::Stash::U32(66)));

        let optional_null = Encoder::encode(
            &UnicharCodec,
            &env,
            napi_mock::to_unknown(&env, napi_mock::fake_null()),
        )
        .unwrap();
        assert!(matches!(optional_null, ffi::Stash::U32(0)));

        let optional_undef = Encoder::encode(
            &UnicharCodec,
            &env,
            napi_mock::to_unknown(&env, napi_mock::fake_undefined()),
        )
        .unwrap();
        assert!(matches!(optional_undef, ffi::Stash::U32(0)));

        assert!(
            Encoder::encode(
                &UnicharCodec,
                &env,
                napi_mock::to_unknown(&env, napi_mock::fake_bool(true)),
            )
            .is_err()
        );
    });
}
#[test]
fn encode_rejects_multi_character_strings() {
    test_support::run(|| {
        let env = test_support::fake_env();
        let err = Encoder::encode(
            &UnicharCodec,
            &env,
            napi_mock::to_unknown(&env, napi_mock::fake_string("Aaa")),
        )
        .map(|_| ())
        .expect_err("a multi-character string must not silently truncate");
        assert!(err.to_string().contains("single-character"));
    });
}

#[test]
fn encode_rejects_invalid_codepoints() {
    test_support::run(|| {
        let env = test_support::fake_env();
        for invalid in [
            f64::from(0xD800u32),
            f64::from(0xDFFFu32),
            f64::from(0x0011_0000u32),
            -1.0,
            65.5,
        ] {
            let result = Encoder::encode(
                &UnicharCodec,
                &env,
                napi_mock::to_unknown(&env, napi_mock::fake_double(invalid)),
            );
            let err = match result {
                Ok(stash) => panic!("codepoint {invalid} must be rejected, got {stash:?}"),
                Err(err) => err,
            };
            assert!(err.to_string().contains("Invalid Unicode codepoint"));
        }
    });
}

#[test]
fn encode_accepts_boundary_codepoints() {
    test_support::run(|| {
        let env = test_support::fake_env();
        for (valid, expected) in [
            (0.0, 0u32),
            (f64::from(0xD7FFu32), 0xD7FF),
            (f64::from(0xE000u32), 0xE000),
            (f64::from(0x0010_FFFFu32), 0x0010_FFFF),
        ] {
            let encoded = Encoder::encode(
                &UnicharCodec,
                &env,
                napi_mock::to_unknown(&env, napi_mock::fake_double(valid)),
            )
            .expect("valid codepoint should encode");
            assert!(matches!(encoded, ffi::Stash::U32(c) if c == expected));
        }
    });
}

#[test]
fn libffi_type_is_u32() {
    assert_eq!(
        Encoder::libffi_type(&UnicharCodec).as_raw_ptr(),
        middle::Type::u32().as_raw_ptr()
    );
}

#[test]
fn call_cif_invokes_native_function() {
    let cif = middle::Cif::new(Vec::new(), middle::Type::u32());
    let result = Encoder::call_cif(
        &UnicharCodec,
        &cif,
        middle::CodePtr(ret_codepoint as *mut c_void),
        &[],
    )
    .unwrap();
    assert!(matches!(result, ffi::Stash::U32(c) if c == 'Z' as u32));
}

#[test]
fn decode_reads_codepoint_and_rejects_invalid() {
    test_support::run(|| {
        let env = test_support::fake_env();

        let decoded = Decoder::decode(&UnicharCodec, &env, &ffi::Stash::U32('Q' as u32)).unwrap();
        assert_eq!(napi_mock::read_string(decoded.raw()), Some("Q".to_owned()));

        assert!(Decoder::decode(&UnicharCodec, &env, &ffi::Stash::Void).is_err());

        let invalid = Decoder::decode(&UnicharCodec, &env, &ffi::Stash::U32(0x0011_0000));
        assert!(invalid.is_err());
    });
}

#[test]
fn ptr_to_value_decodes_codepoint_and_replaces_invalid() {
    test_support::run(|| {
        let env = test_support::fake_env();

        let valid = unsafe {
            Decoder::read(
                &UnicharCodec,
                &env,
                ReadSource::Value('X' as usize as *mut c_void, "ctx"),
            )
        }
        .unwrap();
        assert_eq!(napi_mock::read_string(valid.raw()), Some("X".to_owned()));

        let invalid = unsafe {
            Decoder::read(
                &UnicharCodec,
                &env,
                ReadSource::Value(0x0011_0000 as *mut c_void, "ctx"),
            )
        }
        .unwrap();
        assert_eq!(
            napi_mock::read_string(invalid.raw()),
            Some("\u{FFFD}".to_owned())
        );
    });
}

#[test]
fn read_from_pointer_decodes_codepoint_and_replaces_invalid() {
    test_support::run(|| {
        let env = test_support::fake_env();

        let valid_slot: u32 = 'M' as u32;
        let valid_ptr = (&raw const valid_slot).cast::<c_void>();
        let read =
            unsafe { Decoder::read(&UnicharCodec, &env, ReadSource::Slot(valid_ptr, "ctx")) }
                .unwrap();
        assert_eq!(napi_mock::read_string(read.raw()), Some("M".to_owned()));

        let invalid_slot: u32 = 0x0011_0000;
        let invalid_ptr = (&raw const invalid_slot).cast::<c_void>();
        let read_invalid =
            unsafe { Decoder::read(&UnicharCodec, &env, ReadSource::Slot(invalid_ptr, "ctx")) }
                .unwrap();
        assert_eq!(
            napi_mock::read_string(read_invalid.raw()),
            Some("\u{FFFD}".to_owned())
        );
    });
}

#[test]
fn write_return_to_pointer_writes_string_number_and_default() {
    test_support::run(|| {
        let env = test_support::fake_env();

        let mut slot: u64 = 9;
        let ret = (&raw mut slot).cast::<c_void>();

        PtrWriter::write_return_to_ptr(
            &UnicharCodec,
            &env,
            unsafe { Slot::new(ret) },
            &Ok(napi_mock::to_unknown(&env, napi_mock::fake_string("K"))),
        );
        assert_eq!(slot, u64::from('K' as u32));

        slot = 9;
        PtrWriter::write_return_to_ptr(
            &UnicharCodec,
            &env,
            unsafe { Slot::new(ret) },
            &Ok(napi_mock::to_unknown(&env, napi_mock::fake_string("Kkk"))),
        );
        assert_eq!(slot, 0);

        slot = 9;
        PtrWriter::write_return_to_ptr(
            &UnicharCodec,
            &env,
            unsafe { Slot::new(ret) },
            &Ok(napi_mock::to_unknown(
                &env,
                napi_mock::fake_double(f64::from(0xD800u32)),
            )),
        );
        assert_eq!(slot, 0);

        PtrWriter::write_return_to_ptr(
            &UnicharCodec,
            &env,
            unsafe { Slot::new(ret) },
            &Ok(napi_mock::to_unknown(&env, napi_mock::fake_string(""))),
        );
        assert_eq!(slot, 0);

        PtrWriter::write_return_to_ptr(
            &UnicharCodec,
            &env,
            unsafe { Slot::new(ret) },
            &Ok(napi_mock::to_unknown(&env, napi_mock::fake_double(70.0))),
        );
        assert_eq!(slot, 70);

        PtrWriter::write_return_to_ptr(&UnicharCodec, &env, unsafe { Slot::new(ret) }, &Err(()));
        assert_eq!(slot, 0);

        slot = u64::MAX;
        PtrWriter::write_return_to_ptr(
            &UnicharCodec,
            &env,
            unsafe { Slot::new(ret) },
            &Ok(napi_mock::to_unknown(&env, napi_mock::fake_bool(true))),
        );
        assert_eq!(slot, 0);
    });
}

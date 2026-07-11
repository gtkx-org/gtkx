use std::ffi::c_void;
use std::sync::atomic::{AtomicBool, Ordering};

use libffi::middle;
use napi::JsValue as _;
use native::ffi;
use native::ffi::Slot;
use native::ffi::codec::{Decoder, Encoder, PtrWriter, ReadSource, VoidCodec};
use test_support::napi_mock;

static CALLED: AtomicBool = AtomicBool::new(false);

extern "C" fn ret_void() {
    CALLED.store(true, Ordering::SeqCst);
}

#[test]
fn encode_always_yields_null_pointer() {
    test_support::run(|| {
        let env = test_support::fake_env();
        let encoded = Encoder::encode(
            &VoidCodec,
            &env,
            napi_mock::to_unknown(&env, napi_mock::fake_undefined()),
        )
        .unwrap();
        assert!(matches!(encoded, ffi::Stash::Ptr(p) if p.is_null()));

        let encoded_other = Encoder::encode(
            &VoidCodec,
            &env,
            napi_mock::to_unknown(&env, napi_mock::fake_double(1.0)),
        )
        .unwrap();
        assert!(matches!(encoded_other, ffi::Stash::Ptr(p) if p.is_null()));
    });
}

#[test]
fn libffi_type_is_void() {
    assert_eq!(
        Encoder::libffi_type(&VoidCodec).as_raw_ptr(),
        middle::Type::void().as_raw_ptr()
    );
}

#[test]
fn call_cif_invokes_native_function() {
    CALLED.store(false, Ordering::SeqCst);
    let cif = middle::Cif::new(Vec::new(), middle::Type::void());
    let result = Encoder::call_cif(
        &VoidCodec,
        &cif,
        middle::CodePtr(ret_void as *mut c_void),
        &[],
    )
    .unwrap();
    assert!(matches!(result, ffi::Stash::Void));
    assert!(CALLED.load(Ordering::SeqCst));
}

#[test]
fn decode_yields_undefined() {
    test_support::run(|| {
        let env = test_support::fake_env();
        let decoded = Decoder::decode(&VoidCodec, &env, &ffi::Stash::Void).unwrap();
        assert!(napi_mock::is_undefined(decoded.raw()));

        let decoded_other = Decoder::decode(&VoidCodec, &env, &ffi::Stash::I32(3)).unwrap();
        assert!(napi_mock::is_undefined(decoded_other.raw()));
    });
}

#[test]
fn ptr_to_value_yields_undefined() {
    test_support::run(|| {
        let env = test_support::fake_env();
        let from_null = unsafe {
            Decoder::read(
                &VoidCodec,
                &env,
                ReadSource::Value(std::ptr::null_mut(), "ctx"),
            )
        }
        .unwrap();
        assert!(napi_mock::is_undefined(from_null.raw()));

        let from_ptr =
            unsafe { Decoder::read(&VoidCodec, &env, ReadSource::Value(8 as *mut c_void, "ctx")) }
                .unwrap();
        assert!(napi_mock::is_undefined(from_ptr.raw()));
    });
}

#[test]
fn read_from_pointer_yields_undefined() {
    test_support::run(|| {
        let env = test_support::fake_env();
        let mut slot: usize = 42;
        let ptr = &mut slot as *mut usize as *const c_void;
        let read =
            unsafe { Decoder::read(&VoidCodec, &env, ReadSource::Slot(ptr, "ctx")) }.unwrap();
        assert!(napi_mock::is_undefined(read.raw()));
    });
}

#[test]
fn write_return_to_pointer_is_a_no_op() {
    test_support::run(|| {
        let env = test_support::fake_env();
        let mut slot: usize = 99;
        let ret = &mut slot as *mut usize as *mut c_void;
        PtrWriter::write_return_to_ptr(
            &VoidCodec,
            &env,
            unsafe { Slot::new(ret) },
            &Ok(napi_mock::to_unknown(&env, napi_mock::fake_undefined())),
        );
        PtrWriter::write_return_to_ptr(&VoidCodec, &env, unsafe { Slot::new(ret) }, &Err(()));
        assert_eq!(slot, 99);
    });
}

use std::ffi::c_void;

use libffi::middle;
use napi::Env;
use napi::bindgen_prelude::Unknown;
use native::ffi::Stash;
use native::ffi::codec::{BufferCodec, Decoder, Encoder as _};
use test_support::napi_mock;

fn encode(env: Env, value: Unknown<'_>) -> anyhow::Result<Stash> {
    BufferCodec.encode(&env, value)
}

fn encoded_address(env: Env, value: Unknown<'_>) -> usize {
    let encoded = encode(env, value).expect("buffer value should encode");
    let Stash::Ptr(ptr) = encoded else {
        panic!("expected a pointer, got {encoded:?}");
    };
    ptr as usize
}

fn number(env: &Env, value: f64) -> Unknown<'_> {
    napi_mock::to_unknown(env, napi_mock::fake_double(value))
}

#[test]
fn buffer_encodes_a_view_as_its_backing_pointer() {
    test_support::run(|| {
        let env = napi_mock::fake_env();
        let mut data = vec![0u8; 8];
        let ptr = data.as_mut_ptr().cast::<c_void>();
        let view = napi_mock::to_unknown(
            &env,
            napi_mock::fake_typed_array(napi::sys::TypedarrayType::uint8_array, ptr, 8, 0),
        );
        assert_eq!(encoded_address(env, view), ptr as usize);
    });
}

#[test]
fn buffer_encodes_a_number_as_an_address() {
    test_support::run(|| {
        let env = napi_mock::fake_env();
        assert_eq!(encoded_address(env, number(&env, 4096.0)), 4096);
        assert_eq!(encoded_address(env, number(&env, 0.0)), 0);
        assert_eq!(
            encoded_address(env, number(&env, 9_007_199_254_740_992.0)),
            9_007_199_254_740_992
        );
    });
}

#[test]
fn buffer_encodes_null_and_undefined_as_null() {
    test_support::run(|| {
        let env = napi_mock::fake_env();
        assert_eq!(
            encoded_address(env, napi_mock::to_unknown(&env, napi_mock::fake_null())),
            0
        );
        assert_eq!(
            encoded_address(
                env,
                napi_mock::to_unknown(&env, napi_mock::fake_undefined())
            ),
            0
        );
    });
}

#[test]
fn buffer_cannot_be_decoded() {
    test_support::run(|| {
        let env = napi_mock::fake_env();
        assert!(Decoder::decode(&BufferCodec, &env, &Stash::Void).is_err());
    });
}

extern "C" fn ret_unit() {}

#[test]
fn buffer_cannot_be_a_return_type() {
    let cif = middle::Cif::new(Vec::new(), middle::Type::void());
    let err = BufferCodec
        .call_cif(&cif, middle::CodePtr(ret_unit as *mut c_void), &[])
        .expect_err("a buffer return slot must fail");
    assert!(
        err.to_string()
            .contains("Buffer codecs cannot be return codecs")
    );
}

#[test]
fn buffer_encode_owned_copies_a_view_out_of_the_javascript_buffer() {
    test_support::run(|| {
        let env = napi_mock::fake_env();
        let mut data = vec![3u8, 5, 7, 9];
        let ptr = data.as_mut_ptr().cast::<c_void>();
        let view = napi_mock::to_unknown(
            &env,
            napi_mock::fake_typed_array(napi::sys::TypedarrayType::uint8_array, ptr, 4, 0),
        );
        let encoded = BufferCodec
            .encode_owned(&env, view)
            .expect("a view should encode into storage the stash owns");
        let Stash::Storage(storage) = encoded else {
            panic!("expected owned storage, got {encoded:?}");
        };
        assert_ne!(storage.ptr(), ptr);
        data.fill(0);
        assert_eq!(
            unsafe { std::slice::from_raw_parts(storage.ptr().cast::<u8>(), 4) },
            [3, 5, 7, 9]
        );
    });
}

#[test]
fn buffer_encode_owned_still_takes_a_numeric_address() {
    test_support::run(|| {
        let env = napi_mock::fake_env();
        let encoded = BufferCodec
            .encode_owned(&env, number(&env, 4096.0))
            .expect("an address should encode");
        assert!(matches!(encoded, Stash::Ptr(ptr) if ptr as usize == 4096));
    });
}

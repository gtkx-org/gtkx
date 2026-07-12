use std::ffi::c_void;

use libffi::middle;
use napi::Env;
use napi::bindgen_prelude::Unknown;
use native::ffi::Stash;
use native::ffi::codec::{BufferCodec, Decoder, Encoder as _};
use test_support::napi_mock;

fn encode<'e>(env: &'e Env, value: Unknown<'e>) -> anyhow::Result<Stash> {
    BufferCodec.encode(env, value)
}

fn encoded_address<'e>(env: &'e Env, value: Unknown<'e>) -> usize {
    let encoded = encode(env, value).expect("buffer value should encode");
    let Stash::Ptr(ptr) = encoded else {
        panic!("expected a pointer, got {encoded:?}");
    };
    ptr as usize
}

fn number<'e>(env: &'e Env, value: f64) -> Unknown<'e> {
    napi_mock::to_unknown(env, napi_mock::fake_double(value))
}

#[test]
fn buffer_encodes_a_view_as_its_backing_pointer() {
    test_support::run(|| {
        let env = napi_mock::fake_env();
        let mut data = vec![0u8; 8];
        let ptr = data.as_mut_ptr() as *mut c_void;
        let view = napi_mock::to_unknown(
            &env,
            napi_mock::fake_typed_array(napi::sys::TypedarrayType::uint8_array, ptr, 8, 0),
        );
        assert_eq!(encoded_address(&env, view), ptr as usize);
    });
}

#[test]
fn buffer_encodes_a_number_as_an_address() {
    test_support::run(|| {
        let env = napi_mock::fake_env();
        assert_eq!(encoded_address(&env, number(&env, 4096.0)), 4096);
        assert_eq!(encoded_address(&env, number(&env, 0.0)), 0);
        assert_eq!(
            encoded_address(&env, number(&env, 9_007_199_254_740_992.0)),
            9_007_199_254_740_992
        );
    });
}

#[test]
fn buffer_encodes_null_and_undefined_as_null() {
    test_support::run(|| {
        let env = napi_mock::fake_env();
        assert_eq!(
            encoded_address(&env, napi_mock::to_unknown(&env, napi_mock::fake_null())),
            0
        );
        assert_eq!(
            encoded_address(
                &env,
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

use test_support as helpers;
use test_support::napi_mock;

use std::ffi::c_void;

use libffi::middle;

use native::ffi::codec::{
    BigIntCodec, BoxedCodec, BufferCodec, CallbackCodec, CallbackScope, Codec, Decoder, Encoder,
    FundamentalCodec, IntegerCodec, Ownership, ReadSource, RefCodec, StructCodec, VoidCodec,
};
use native::ffi::{self, StashData, StashStorage};

fn callback_codec() -> CallbackCodec {
    CallbackCodec {
        arg_codecs: Vec::new(),
        return_codec: Box::new(Codec::Void(VoidCodec)),
        has_destroy: false,
        user_data_index: None,
        scope: CallbackScope::Call,
    }
}

fn boxed_codec() -> BoxedCodec {
    BoxedCodec {
        ownership: Ownership::Borrowed,
        type_name: "GdkRGBA".to_owned(),
        shared_library: None,
        get_type_fn_name: None,
        free_fn_name: None,
        caller_allocated: false,
    }
}

fn struct_codec() -> StructCodec {
    StructCodec {
        ownership: Ownership::Borrowed,
        size: None,
        caller_allocated: false,
    }
}

fn fundamental_codec() -> FundamentalCodec {
    FundamentalCodec {
        ownership: Ownership::Borrowed,
        shared_library: "libgobject-2.0.so.0".to_owned(),
        ref_fn_name: "g_param_spec_ref".to_owned(),
        unref_fn_name: "g_param_spec_unref".to_owned(),
    }
}

fn i32_ref_codec() -> RefCodec {
    RefCodec::new(Codec::Integer(IntegerCodec::I32)).expect("Integer is a valid Ref inner")
}

fn empty_cif() -> middle::Cif {
    middle::Cif::new(Vec::new(), middle::Type::void())
}

#[test]
fn new_rejects_callback_inner() {
    assert!(RefCodec::new(Codec::Callback(callback_codec())).is_err());
}

#[test]
fn new_rejects_void_inner() {
    assert!(RefCodec::new(Codec::Void(VoidCodec)).is_err());
}

#[test]
fn new_rejects_buffer_inner() {
    assert!(RefCodec::new(Codec::Buffer(BufferCodec)).is_err());
}

#[test]
fn new_rejects_ref_inner() {
    assert!(RefCodec::new(Codec::Ref(i32_ref_codec())).is_err());
}

#[test]
fn new_accepts_bigint_inner() {
    assert!(RefCodec::new(Codec::BigInt(BigIntCodec::I64)).is_ok());
}

#[test]
fn new_accepts_boxed_inner() {
    assert!(RefCodec::new(Codec::Boxed(boxed_codec())).is_ok());
}

#[test]
fn new_accepts_struct_inner() {
    assert!(RefCodec::new(Codec::Struct(struct_codec())).is_ok());
}

#[test]
fn new_accepts_fundamental_inner() {
    assert!(RefCodec::new(Codec::Fundamental(fundamental_codec())).is_ok());
}

#[test]
fn supports_inner_maps_each_variant() {
    assert!(RefCodec::supports_inner(&Codec::Integer(IntegerCodec::I32)));
    assert!(RefCodec::supports_inner(&Codec::BigInt(BigIntCodec::I64)));
    assert!(RefCodec::supports_inner(&Codec::Boxed(boxed_codec())));
    assert!(RefCodec::supports_inner(&Codec::Struct(struct_codec())));
    assert!(RefCodec::supports_inner(&Codec::Fundamental(
        fundamental_codec()
    )));
    assert!(!RefCodec::supports_inner(
        &Codec::Callback(callback_codec())
    ));
    assert!(!RefCodec::supports_inner(&Codec::Void(VoidCodec)));
    assert!(!RefCodec::supports_inner(&Codec::Buffer(BufferCodec)));
    assert!(!RefCodec::supports_inner(&Codec::Ref(i32_ref_codec())));
}

#[test]
fn ref_encode_null_yields_null_ptr() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let encoded = i32_ref_codec()
            .encode(&env, napi_mock::to_unknown(&env, napi_mock::fake_null()))
            .expect("null ref encode should succeed");
        assert!(matches!(encoded, ffi::Stash::Ptr(p) if p.is_null()));
    });
}

#[test]
fn ref_encode_undefined_yields_null_ptr() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let encoded = i32_ref_codec()
            .encode(
                &env,
                napi_mock::to_unknown(&env, napi_mock::fake_undefined()),
            )
            .expect("undefined ref encode should succeed");
        assert!(matches!(encoded, ffi::Stash::Ptr(p) if p.is_null()));
    });
}

#[test]
fn ref_encode_non_ref_value_errors() {
    helpers::run(|| {
        let env = helpers::fake_env();
        assert!(
            i32_ref_codec()
                .encode(
                    &env,
                    napi_mock::to_unknown(&env, napi_mock::fake_double(1.0))
                )
                .is_err()
        );
    });
}

#[test]
fn ref_call_cif_rejects_return_usage() {
    let cif = empty_cif();
    let result = i32_ref_codec().call_cif(&cif, middle::CodePtr(std::ptr::null_mut()), &[]);
    assert!(result.is_err());
}

#[test]
fn ref_read_from_value_source_errors() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let result =
            unsafe { i32_ref_codec().read(&env, ReadSource::Value(std::ptr::null_mut(), "ctx")) };
        assert!(result.is_err());
    });
}

#[test]
fn ref_decode_unsupported_inner_errors() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let ref_codec =
            RefCodec::new(Codec::BigInt(BigIntCodec::I64)).expect("BigInt is a valid Ref inner");
        let mut backing: u64 = 0;
        let ptr = &mut backing as *mut u64 as *mut c_void;
        let stash = ffi::Stash::Storage(StashStorage::new(ptr, StashData::Unit));
        assert!(ref_codec.decode(&env, &stash).is_err());
    });
}

#[test]
fn callback_call_cif_rejects_return_usage() {
    let cif = empty_cif();
    let result = callback_codec().call_cif(&cif, middle::CodePtr(std::ptr::null_mut()), &[]);
    assert!(result.is_err());
}

#[test]
fn callback_encode_non_callback_value_errors() {
    helpers::run(|| {
        let env = helpers::fake_env();
        assert!(
            callback_codec()
                .encode(
                    &env,
                    napi_mock::to_unknown(&env, napi_mock::fake_double(1.0))
                )
                .is_err()
        );
    });
}

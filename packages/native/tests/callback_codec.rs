use test_support as helpers;

use std::ffi::c_void;

use libffi::middle as libffi;

use native::ffi;
use native::ffi::codec::{CallbackCodec, CallbackScope, Codec, Encoder, VoidCodec};
use native::ffi::value::Value;

fn callback_type(has_destroy: bool) -> CallbackCodec {
    CallbackCodec {
        arg_codecs: Vec::new(),
        return_codec: Box::new(Codec::Void(VoidCodec)),
        has_destroy,
        user_data_index: None,
        scope: CallbackScope::Call,
    }
}

fn assert_null_callback(
    codec: &CallbackCodec,
    value: &Value,
    expected_destroy: Option<*mut c_void>,
) {
    let encoded = codec
        .encode(value)
        .expect("encode should build the null callback");
    let ffi::Stash::Callback(callback) = encoded else {
        panic!("expected Callback ffi value");
    };
    assert!(callback.fn_ptr().is_null());
    assert!(callback.state_ptr().is_null());
    assert_eq!(callback.destroy_ptr(), expected_destroy);
}

#[test]
fn scope_default_is_call() {
    assert_eq!(CallbackScope::default(), CallbackScope::Call);
}

#[test]
fn append_ffi_arg_types_without_destroy_pushes_two_pointers() {
    helpers::run(|| {
        let mut types: Vec<libffi::Type> = Vec::new();
        callback_type(false).append_ffi_arg_types(&mut types);
        assert_eq!(types.len(), 2);
    });
}

#[test]
fn append_ffi_arg_types_with_destroy_pushes_three_pointers() {
    helpers::run(|| {
        let mut types: Vec<libffi::Type> = Vec::new();
        callback_type(true).append_ffi_arg_types(&mut types);
        assert_eq!(types.len(), 3);
    });
}

#[test]
fn encode_null_without_destroy_builds_callback() {
    helpers::run(|| {
        assert_null_callback(&callback_type(false), &Value::Null, None);
    });
}

#[test]
fn encode_null_with_destroy_builds_callback_with_destroy_slot() {
    helpers::run(|| {
        assert_null_callback(
            &callback_type(true),
            &Value::Undefined,
            Some(std::ptr::null_mut()),
        );
    });
}

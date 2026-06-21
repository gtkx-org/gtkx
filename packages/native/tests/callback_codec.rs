mod common;

use std::ffi::c_void;

use libffi::middle as libffi;

use native::ffi;
use native::types::{CallbackScope, CallbackType, FfiEncoder, Type, VoidType};
use native::value::Value;

fn callback_type(has_destroy: bool) -> CallbackType {
    CallbackType {
        arg_types: Vec::new(),
        return_type: Box::new(Type::Void(VoidType)),
        has_destroy,
        user_data_index: None,
        scope: CallbackScope::Call,
    }
}

fn assert_null_callback(
    codec: &CallbackType,
    value: &Value,
    expected_destroy: Option<*mut c_void>,
) {
    let encoded = codec
        .encode(value)
        .expect("encode should build the null callback");
    let ffi::FfiValue::Callback(tv) = encoded else {
        panic!("expected Callback ffi value");
    };
    assert!(tv.fn_ptr().is_null());
    assert!(tv.state_ptr().is_null());
    assert_eq!(tv.destroy_ptr(), expected_destroy);
}

#[test]
fn scope_from_str_parses_known_values() {
    assert_eq!(
        "call".parse::<CallbackScope>().unwrap(),
        CallbackScope::Call
    );
    assert_eq!(
        "notified".parse::<CallbackScope>().unwrap(),
        CallbackScope::Notified
    );
    assert_eq!(
        "async".parse::<CallbackScope>().unwrap(),
        CallbackScope::Async
    );
    assert_eq!(
        "forever".parse::<CallbackScope>().unwrap(),
        CallbackScope::Forever
    );
}

#[test]
fn scope_default_is_call() {
    assert_eq!(CallbackScope::default(), CallbackScope::Call);
}

#[test]
fn append_ffi_arg_types_without_destroy_pushes_two_pointers() {
    common::run(|| {
        let mut types: Vec<libffi::Type> = Vec::new();
        callback_type(false).append_ffi_arg_types(&mut types);
        assert_eq!(types.len(), 2);
    });
}

#[test]
fn append_ffi_arg_types_with_destroy_pushes_three_pointers() {
    common::run(|| {
        let mut types: Vec<libffi::Type> = Vec::new();
        callback_type(true).append_ffi_arg_types(&mut types);
        assert_eq!(types.len(), 3);
    });
}

#[test]
fn encode_null_without_destroy_builds_callback() {
    common::run(|| {
        assert_null_callback(&callback_type(false), &Value::Null, None);
    });
}

#[test]
fn encode_null_with_destroy_builds_callback_with_destroy_slot() {
    common::run(|| {
        assert_null_callback(
            &callback_type(true),
            &Value::Undefined,
            Some(std::ptr::null_mut()),
        );
    });
}

#[test]
fn encode_null_builds_null_callback() {
    common::run(|| {
        assert_null_callback(&callback_type(false), &Value::Null, None);
    });
}

//! Coverage tests for the non-excluded parts of
//! [`native::types::TrampolineType`] and [`native::types::TrampolineScope`].
//!
//! `TrampolineType::encode` is excluded from coverage, but executing the
//! excluded `encode` with a null value still drives the non-excluded
//! `build_null_ffi_value`.

mod common;

use libffi::middle as libffi;

use native::ffi;
use native::types::{FfiEncoder, TrampolineScope, TrampolineType, Type, VoidType};
use native::value::Value;

fn trampoline_type(has_destroy: bool) -> TrampolineType {
    TrampolineType {
        arg_types: Vec::new(),
        return_type: Box::new(Type::Void(VoidType)),
        has_destroy,
        user_data_index: None,
        scope: TrampolineScope::Call,
    }
}

#[test]
fn scope_from_str_parses_known_values() {
    assert_eq!(
        "call".parse::<TrampolineScope>().unwrap(),
        TrampolineScope::Call
    );
    assert_eq!(
        "notified".parse::<TrampolineScope>().unwrap(),
        TrampolineScope::Notified
    );
    assert_eq!(
        "async".parse::<TrampolineScope>().unwrap(),
        TrampolineScope::Async
    );
    assert_eq!(
        "forever".parse::<TrampolineScope>().unwrap(),
        TrampolineScope::Forever
    );
}

#[test]
fn scope_default_is_call() {
    assert_eq!(TrampolineScope::default(), TrampolineScope::Call);
}

#[test]
fn append_ffi_arg_types_without_destroy_pushes_two_pointers() {
    common::run(|| {
        let mut types: Vec<libffi::Type> = Vec::new();
        trampoline_type(false).append_ffi_arg_types(&mut types);
        assert_eq!(types.len(), 2);
    });
}

#[test]
fn append_ffi_arg_types_with_destroy_pushes_three_pointers() {
    common::run(|| {
        let mut types: Vec<libffi::Type> = Vec::new();
        trampoline_type(true).append_ffi_arg_types(&mut types);
        assert_eq!(types.len(), 3);
    });
}

#[test]
fn encode_null_without_destroy_builds_trampoline() {
    common::run(|| {
        let encoded = trampoline_type(false)
            .encode(&Value::Null)
            .expect("null encode should build the null trampoline");
        let ffi::FfiValue::Trampoline(tv) = encoded else {
            panic!("expected Trampoline ffi value");
        };
        assert!(tv.fn_ptr().is_null());
        assert!(tv.state_ptr().is_null());
        assert!(tv.destroy_ptr().is_none());
    });
}

#[test]
fn encode_null_with_destroy_builds_trampoline_with_destroy_slot() {
    common::run(|| {
        let encoded = trampoline_type(true)
            .encode(&Value::Undefined)
            .expect("undefined encode should build the null trampoline");
        let ffi::FfiValue::Trampoline(tv) = encoded else {
            panic!("expected Trampoline ffi value");
        };
        assert!(tv.fn_ptr().is_null());
        assert!(tv.state_ptr().is_null());
        assert_eq!(tv.destroy_ptr(), Some(std::ptr::null_mut()));
    });
}

#[test]
fn encode_null_builds_null_trampoline() {
    common::run(|| {
        let encoded = trampoline_type(false)
            .encode(&Value::Null)
            .expect("null encode should build the null trampoline");
        let ffi::FfiValue::Trampoline(tv) = encoded else {
            panic!("expected Trampoline ffi value");
        };
        assert!(tv.fn_ptr().is_null());
        assert!(tv.state_ptr().is_null());
        assert!(tv.destroy_ptr().is_none());
    });
}

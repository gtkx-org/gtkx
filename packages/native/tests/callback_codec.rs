use std::cell::Cell;
use std::ffi::c_void;

use libffi::middle as libffi;
use napi::Env;
use napi::bindgen_prelude::Unknown;
use native::ffi;
use native::ffi::closure::ClosureState;
use native::ffi::codec::{
    CallbackCodec, CallbackScope, Codec, DestroyNotifyKind, Encoder, VoidCodec,
};
use test_support as helpers;
use test_support::napi_mock;

fn callback_codec(has_destroy: bool, scope: CallbackScope) -> CallbackCodec {
    CallbackCodec {
        arg_codecs: Vec::new(),
        return_codec: Box::new(Codec::Void(VoidCodec)),
        has_destroy,
        destroy_kind: DestroyNotifyKind::default(),
        has_user_data: true,
        user_data_index: Some(0),
        can_throw: false,
        scope,
    }
}

fn closure_notify_codec() -> CallbackCodec {
    CallbackCodec {
        destroy_kind: DestroyNotifyKind::ClosureNotify,
        ..callback_codec(true, CallbackScope::Notified)
    }
}

fn closureless_codec(has_destroy: bool, scope: CallbackScope) -> CallbackCodec {
    CallbackCodec {
        has_user_data: false,
        user_data_index: None,
        ..callback_codec(has_destroy, scope)
    }
}

fn opaque_user_data_codec(has_destroy: bool, scope: CallbackScope) -> CallbackCodec {
    CallbackCodec {
        user_data_index: None,
        ..callback_codec(has_destroy, scope)
    }
}

fn callback_type(has_destroy: bool) -> CallbackCodec {
    callback_codec(has_destroy, CallbackScope::Call)
}

type Recorded = (*mut c_void, Option<*mut c_void>, Option<*mut c_void>);

thread_local! {
    static RECORDED: Cell<Option<Recorded>> = const { Cell::new(None) };
}

extern "C" fn record_one(fn_ptr: *mut c_void) {
    RECORDED.set(Some((fn_ptr, None, None)));
}

extern "C" fn record_two(fn_ptr: *mut c_void, user_data: *mut c_void) {
    RECORDED.set(Some((fn_ptr, Some(user_data), None)));
}

extern "C" fn record_three(fn_ptr: *mut c_void, user_data: *mut c_void, destroy: *mut c_void) {
    RECORDED.set(Some((fn_ptr, Some(user_data), Some(destroy))));
}

extern "C" fn record_fn_and_destroy(fn_ptr: *mut c_void, destroy: *mut c_void) {
    RECORDED.set(Some((fn_ptr, None, Some(destroy))));
}

struct Invocation {
    arity: usize,
    user_data: Option<*mut c_void>,
    destroy: Option<*mut c_void>,
}

fn target_for(arity: usize, has_user_data: bool) -> *mut c_void {
    match (arity, has_user_data) {
        (1, false) => record_one as *mut c_void,
        (2, true) => record_two as *mut c_void,
        (2, false) => record_fn_and_destroy as *mut c_void,
        (3, true) => record_three as *mut c_void,
        (other, _) => panic!("unexpected callback arity {other}"),
    }
}

fn invoke_through_cif(codec: &CallbackCodec) -> Invocation {
    let env = helpers::fake_env();
    let js_fn = napi_mock::to_unknown(
        &env,
        napi_mock::fake_function(|_| napi_mock::fake_undefined()),
    );
    let encoded = codec.encode(&env, js_fn).expect("encode should succeed");
    let ffi::Stash::Callback(callback) = &encoded else {
        panic!("expected Callback ffi value");
    };

    let mut types: Vec<libffi::Type> = Vec::new();
    codec.append_ffi_arg_types(&mut types);
    let arity = types.len();

    let mut args: Vec<libffi::Arg<'_>> = Vec::new();
    encoded.append_libffi_args(&mut args);
    assert_eq!(args.len(), arity);

    let has_user_data = codec.has_user_data;
    let target = target_for(arity, has_user_data);

    RECORDED.set(None);
    let cif = libffi::Cif::new(types, libffi::Type::void());
    unsafe { cif.call::<()>(libffi::CodePtr(target), &args) };
    let (fn_ptr, user_data, destroy) = RECORDED.get().expect("the target function should run");

    assert_eq!(fn_ptr, callback.fn_ptr());
    assert!(!fn_ptr.is_null());
    if has_user_data {
        assert_eq!(user_data, Some(callback.state_ptr()));
    }

    Invocation {
        arity,
        user_data,
        destroy,
    }
}

fn assert_null_callback(
    env: &Env,
    codec: &CallbackCodec,
    value: Unknown<'_>,
    expected_destroy: Option<*mut c_void>,
) {
    let encoded = codec
        .encode(env, value)
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
fn append_ffi_arg_types_without_user_data_pushes_only_the_function_pointer() {
    helpers::run(|| {
        let mut types: Vec<libffi::Type> = Vec::new();
        closureless_codec(false, CallbackScope::Call).append_ffi_arg_types(&mut types);
        assert_eq!(types.len(), 1);
    });
}

#[test]
fn append_ffi_arg_types_without_user_data_still_pushes_a_destroy_slot() {
    helpers::run(|| {
        let mut types: Vec<libffi::Type> = Vec::new();
        closureless_codec(true, CallbackScope::Notified).append_ffi_arg_types(&mut types);
        assert_eq!(types.len(), 2);
    });
}

#[test]
fn a_closureless_callback_is_invoked_with_the_trampoline_alone() {
    helpers::run(|| {
        let invocation = invoke_through_cif(&closureless_codec(false, CallbackScope::Call));
        assert_eq!(invocation.arity, 1);
        assert_eq!(invocation.user_data, None);
        assert_eq!(invocation.destroy, None);
    });
}

#[test]
fn a_callee_taking_user_data_gets_its_slot_even_when_the_callback_declares_none() {
    helpers::run(|| {
        let invocation = invoke_through_cif(&opaque_user_data_codec(true, CallbackScope::Notified));
        assert_eq!(invocation.arity, 3);
        assert!(invocation.user_data.is_some());
        assert_eq!(
            invocation.destroy,
            Some(ClosureState::destroy as *mut c_void)
        );
    });
}

#[test]
fn notified_with_destroy_invokes_with_real_destroy_notify() {
    helpers::run(|| {
        let invocation = invoke_through_cif(&callback_codec(true, CallbackScope::Notified));
        assert_eq!(invocation.arity, 3);
        assert_eq!(
            invocation.destroy,
            Some(ClosureState::destroy as *mut c_void)
        );
    });
}

#[test]
fn the_default_destroy_kind_is_the_one_argument_destroy_notify() {
    assert_eq!(
        DestroyNotifyKind::default(),
        DestroyNotifyKind::DestroyNotify
    );
}

#[test]
fn a_closure_notify_destroy_kind_installs_the_two_argument_entry_point() {
    helpers::run(|| {
        let invocation = invoke_through_cif(&closure_notify_codec());
        assert_eq!(invocation.arity, 3);
        assert_eq!(
            invocation.destroy,
            Some(ClosureState::destroy_as_closure_notify as *mut c_void)
        );
        assert_ne!(
            invocation.destroy,
            Some(ClosureState::destroy as *mut c_void)
        );
    });
}

#[test]
fn a_closure_notify_destroy_kind_is_still_dropped_by_the_scope() {
    helpers::run(|| {
        let codec = CallbackCodec {
            scope: CallbackScope::Call,
            ..closure_notify_codec()
        };
        let invocation = invoke_through_cif(&codec);
        assert_eq!(invocation.destroy, Some(std::ptr::null_mut()));
    });
}

#[test]
fn notified_without_destroy_invokes_with_two_args() {
    helpers::run(|| {
        let invocation = invoke_through_cif(&callback_codec(false, CallbackScope::Notified));
        assert_eq!(invocation.arity, 2);
        assert_eq!(invocation.destroy, None);
    });
}

#[test]
fn call_with_destroy_invokes_with_null_destroy() {
    helpers::run(|| {
        let invocation = invoke_through_cif(&callback_codec(true, CallbackScope::Call));
        assert_eq!(invocation.arity, 3);
        assert_eq!(invocation.destroy, Some(std::ptr::null_mut()));
    });
}

#[test]
fn async_with_destroy_invokes_with_null_destroy() {
    helpers::run(|| {
        let invocation = invoke_through_cif(&callback_codec(true, CallbackScope::Async));
        assert_eq!(invocation.arity, 3);
        assert_eq!(invocation.destroy, Some(std::ptr::null_mut()));
    });
}

#[test]
fn forever_with_destroy_invokes_with_null_destroy() {
    helpers::run(|| {
        let invocation = invoke_through_cif(&callback_codec(true, CallbackScope::Forever));
        assert_eq!(invocation.arity, 3);
        assert_eq!(invocation.destroy, Some(std::ptr::null_mut()));
    });
}

#[test]
fn every_scope_and_destroy_combo_emits_args_matching_the_cif() {
    helpers::run(|| {
        for scope in [
            CallbackScope::Call,
            CallbackScope::Notified,
            CallbackScope::Async,
            CallbackScope::Forever,
        ] {
            for has_destroy in [false, true] {
                let invocation = invoke_through_cif(&callback_codec(has_destroy, scope.clone()));
                assert_eq!(invocation.arity, if has_destroy { 3 } else { 2 });
                assert_eq!(invocation.destroy.is_some(), has_destroy);
            }
        }
    });
}

#[test]
fn encode_null_without_destroy_builds_callback() {
    helpers::run(|| {
        let env = helpers::fake_env();
        assert_null_callback(
            &env,
            &callback_type(false),
            napi_mock::to_unknown(&env, napi_mock::fake_null()),
            None,
        );
    });
}

#[test]
fn encode_null_with_destroy_builds_callback_with_destroy_slot() {
    helpers::run(|| {
        let env = helpers::fake_env();
        assert_null_callback(
            &env,
            &callback_type(true),
            napi_mock::to_unknown(&env, napi_mock::fake_undefined()),
            Some(std::ptr::null_mut()),
        );
    });
}

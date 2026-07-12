use test_support as helpers;
use test_support::napi_mock;

use std::cell::Cell;
use std::ffi::c_void;

use libffi::middle as libffi;

use napi::Env;
use napi::bindgen_prelude::Unknown;

use native::ffi;
use native::ffi::closure::ClosureState;
use native::ffi::codec::{CallbackCodec, CallbackScope, Codec, Encoder, VoidCodec};

fn callback_codec(has_destroy: bool, scope: CallbackScope) -> CallbackCodec {
    CallbackCodec {
        arg_codecs: Vec::new(),
        return_codec: Box::new(Codec::Void(VoidCodec)),
        has_destroy,
        user_data_index: None,
        scope,
    }
}

fn callback_type(has_destroy: bool) -> CallbackCodec {
    callback_codec(has_destroy, CallbackScope::Call)
}

type Recorded = (*mut c_void, *mut c_void, Option<*mut c_void>);

thread_local! {
    static RECORDED: Cell<Option<Recorded>> = const { Cell::new(None) };
}

unsafe extern "C" fn record_two(fn_ptr: *mut c_void, user_data: *mut c_void) {
    RECORDED.set(Some((fn_ptr, user_data, None)));
}

unsafe extern "C" fn record_three(
    fn_ptr: *mut c_void,
    user_data: *mut c_void,
    destroy: *mut c_void,
) {
    RECORDED.set(Some((fn_ptr, user_data, Some(destroy))));
}

struct Invocation {
    arity: usize,
    destroy: Option<*mut c_void>,
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

    let mut args: Vec<libffi::Arg> = Vec::new();
    encoded.append_libffi_args(&mut args);
    assert_eq!(args.len(), arity);

    let target = match arity {
        2 => record_two as *mut c_void,
        3 => record_three as *mut c_void,
        other => panic!("unexpected callback arity {other}"),
    };

    RECORDED.set(None);
    let cif = libffi::Cif::new(types, libffi::Type::void());
    unsafe { cif.call::<()>(libffi::CodePtr(target), &args) };
    let (fn_ptr, user_data, destroy) = RECORDED.get().expect("the target function should run");

    assert_eq!(fn_ptr, callback.fn_ptr());
    assert_eq!(user_data, callback.state_ptr());
    assert!(!fn_ptr.is_null());

    Invocation { arity, destroy }
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
            helpers::napi_mock::to_unknown(&env, helpers::napi_mock::fake_null()),
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
            helpers::napi_mock::to_unknown(&env, helpers::napi_mock::fake_undefined()),
            Some(std::ptr::null_mut()),
        );
    });
}

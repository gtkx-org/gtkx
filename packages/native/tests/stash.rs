use std::ffi::c_void;

use napi::Env;
use native::ffi::closure::{ClosureData, ClosureState};
use native::ffi::codec::{Codec, VoidCodec};
use native::ffi::{CallbackValue, Stash, StashStorage};
use native::value::ClosureHandle;
use test_support::napi_mock;

fn callback_value(destroy: bool) -> CallbackValue {
    let destroy_ptr = if destroy {
        Some(std::ptr::without_provenance_mut::<c_void>(0xDEAD))
    } else {
        None
    };
    CallbackValue::new(
        std::ptr::without_provenance_mut::<c_void>(0xCAFE),
        std::ptr::without_provenance_mut::<c_void>(0xBEEF),
        true,
        destroy_ptr,
        None,
    )
}

fn js_func_ref(env: &Env) -> ClosureHandle {
    let func = napi_mock::to_unknown(
        env,
        napi_mock::fake_function(|_| napi_mock::fake_undefined()),
    );
    ClosureHandle::from_js_value(env, &func).expect("reference creation should succeed")
}

fn armed_callback_value(env: &Env, destroy_ptr: Option<*mut c_void>) -> CallbackValue {
    let js_fn = js_func_ref(env);
    let data = ClosureData::new(js_fn, Vec::new(), Codec::Void(VoidCodec), None, false);
    let state = Box::new(ClosureState::new(data));
    let fn_ptr = state.code_ptr;
    CallbackValue::new_pending_transfer(fn_ptr, true, destroy_ptr, state)
}

fn release_handed_over_state(state_ptr: *mut c_void) {
    assert_eq!(napi_mock::count("napi_delete_reference"), 0);
    unsafe { ClosureState::destroy(state_ptr) };
    assert_eq!(napi_mock::count("napi_delete_reference"), 1);
}

#[test]
fn new_armed_exposes_state_and_closure_pointers() {
    test_support::run(|| {
        let env = test_support::fake_env();
        let destroy_ptr = ClosureState::destroy as *mut c_void;
        let callback = armed_callback_value(&env, Some(destroy_ptr));
        assert!(!callback.fn_ptr().is_null());
        assert!(!callback.state_ptr().is_null());
        assert_eq!(callback.destroy_ptr(), Some(destroy_ptr));
        let state = unsafe { &*(callback.state_ptr() as *const ClosureState) };
        assert_eq!(state.code_ptr, callback.fn_ptr());
    });
}

#[test]
fn armed_state_drops_with_value_when_call_never_happens() {
    test_support::run(|| {
        let env = test_support::fake_env();
        let callback = armed_callback_value(&env, None);
        assert_eq!(napi_mock::count("napi_delete_reference"), 0);
        drop(callback);
        assert_eq!(napi_mock::count("napi_delete_reference"), 1);
    });
}

#[test]
fn disarm_pending_transfer_hands_state_over_and_is_idempotent() {
    test_support::run(|| {
        let env = test_support::fake_env();
        let callback = armed_callback_value(&env, Some(ClosureState::destroy as *mut c_void));
        let state_ptr = callback.state_ptr();
        callback.disarm_pending_transfer();
        callback.disarm_pending_transfer();
        drop(callback);
        release_handed_over_state(state_ptr);
    });
}

#[test]
fn stash_disarm_pending_transfer_routes_to_callback() {
    test_support::run(|| {
        let env = test_support::fake_env();
        let callback = armed_callback_value(&env, None);
        let state_ptr = callback.state_ptr();
        let value = Stash::Callback(callback);
        value.disarm_pending_transfer();
        drop(value);
        release_handed_over_state(state_ptr);
    });
}

#[test]
fn stash_disarm_pending_transfer_is_a_noop_for_scalars() {
    Stash::I32(7).disarm_pending_transfer();
    Stash::F64(1.5).disarm_pending_transfer();
}

#[test]
fn callback_value_accessors_expose_pointers() {
    let callback = callback_value(true);
    assert_eq!(
        callback.fn_ptr(),
        std::ptr::without_provenance_mut::<c_void>(0xCAFE)
    );
    assert_eq!(
        callback.state_ptr(),
        std::ptr::without_provenance_mut::<c_void>(0xBEEF)
    );
    assert_eq!(
        callback.destroy_ptr(),
        Some(std::ptr::without_provenance_mut::<c_void>(0xDEAD))
    );
}

#[test]
fn callback_value_without_destroy_has_none() {
    let callback = callback_value(false);
    assert_eq!(callback.destroy_ptr(), None);
}

#[test]
fn write_scalar_to_ptr_writes_every_numeric_variant() {
    macro_rules! write_scalar {
        ($variant:ident, $value:expr, $codec:ty) => {{
            let mut slot: u64 = 0;
            let slot_ptr = (&raw mut slot).cast::<c_void>();
            let v = Stash::$variant($value);
            unsafe { v.write_scalar_to_ptr(slot_ptr) }.expect("scalar write should succeed");
            unsafe { *slot_ptr.cast_const().cast::<$codec>() }
        }};
    }
    macro_rules! check {
        ($variant:ident, $value:expr, $codec:ty) => {
            assert_eq!(write_scalar!($variant, $value, $codec), $value)
        };
    }
    macro_rules! check_float {
        ($variant:ident, $value:expr, $codec:ty) => {
            assert!((write_scalar!($variant, $value, $codec) - $value).abs() < <$codec>::EPSILON)
        };
    }
    check!(U8, 12u8, u8);
    check!(I8, -5i8, i8);
    check!(U16, 1234u16, u16);
    check!(I16, -321i16, i16);
    check!(U32, 99999u32, u32);
    check!(I32, -42i32, i32);
    check!(U64, 7u64, u64);
    check!(I64, -7i64, i64);
    check_float!(F32, 1.5f32, f32);
    check_float!(F64, 2.5f64, f64);
}

#[test]
fn as_ptr_ptr_variant_returns_inner() {
    let inner = std::ptr::without_provenance_mut::<c_void>(0x42);
    let v = Stash::Ptr(inner);
    assert_eq!(v.as_ptr("test").unwrap(), inner);

    let null = Stash::Ptr(std::ptr::null_mut());
    assert!(null.as_ptr("test").unwrap().is_null());
}

#[test]
fn as_ptr_storage_returns_storage_ptr() {
    let storage: StashStorage = vec![9u8].into();
    let storage_ptr = storage.ptr();
    let v = Stash::Storage(storage);
    assert_eq!(v.as_ptr("test").unwrap(), storage_ptr);
}

#[test]
fn as_ptr_scalar_and_callback_and_void_fail() {
    assert!(Stash::U8(1).as_ptr("test").is_err());
    assert!(Stash::I8(1).as_ptr("test").is_err());
    assert!(Stash::U16(1).as_ptr("test").is_err());
    assert!(Stash::I16(1).as_ptr("test").is_err());
    assert!(Stash::U32(1).as_ptr("test").is_err());
    assert!(Stash::I32(1).as_ptr("test").is_err());
    assert!(Stash::U64(1).as_ptr("test").is_err());
    assert!(Stash::I64(1).as_ptr("test").is_err());
    assert!(Stash::F32(1.0).as_ptr("test").is_err());
    assert!(Stash::F64(1.0).as_ptr("test").is_err());
    assert!(
        Stash::Callback(callback_value(false))
            .as_ptr("test")
            .is_err()
    );
    assert!(Stash::Void.as_ptr("test").is_err());
}

#[test]
fn as_non_null_ptr_null_returns_none() {
    let v = Stash::Ptr(std::ptr::null_mut());
    assert_eq!(v.as_non_null_ptr("test").unwrap(), None);
}

#[test]
fn as_non_null_ptr_non_null_returns_some() {
    let inner = std::ptr::without_provenance_mut::<c_void>(0x55);
    let v = Stash::Ptr(inner);
    assert_eq!(v.as_non_null_ptr("test").unwrap(), Some(inner));
}

#[test]
fn as_non_null_ptr_propagates_error() {
    assert!(Stash::Void.as_non_null_ptr("test").is_err());
}

fn assert_number(value: &Stash, expected: f64) {
    let actual = value.to_number().expect("numeric variant should convert");
    assert!(
        (actual - expected).abs() < f64::EPSILON,
        "{actual} should equal {expected}"
    );
}

#[test]
fn to_number_handles_every_numeric_variant() {
    assert_number(&Stash::I8(-3), -3.0);
    assert_number(&Stash::U8(3), 3.0);
    assert_number(&Stash::I16(-300), -300.0);
    assert_number(&Stash::U16(300), 300.0);
    assert_number(&Stash::I32(-30000), -30000.0);
    assert_number(&Stash::U32(30000), 30000.0);
    assert_number(&Stash::I64(-7), -7.0);
    assert_number(&Stash::U64(7), 7.0);
    assert_number(&Stash::F32(1.25), 1.25);
    assert_number(&Stash::F64(2.5), 2.5);
}

#[test]
fn append_libffi_args_callback_without_destroy_pushes_two() {
    let v = Stash::Callback(callback_value(false));
    let mut args = Vec::new();
    v.append_libffi_args(&mut args);
    assert_eq!(args.len(), 2);
}

#[test]
fn append_libffi_args_callback_with_destroy_pushes_three() {
    let v = Stash::Callback(callback_value(true));
    let mut args = Vec::new();
    v.append_libffi_args(&mut args);
    assert_eq!(args.len(), 3);
}
fn scalar_value_samples() -> Vec<Stash> {
    let storage: StashStorage = vec![1u8].into();
    vec![
        Stash::U8(1),
        Stash::I8(1),
        Stash::U16(1),
        Stash::I16(1),
        Stash::U32(1),
        Stash::I32(1),
        Stash::U64(1),
        Stash::I64(1),
        Stash::F32(1.0),
        Stash::F64(1.0),
        Stash::Ptr(std::ptr::null_mut()),
        Stash::Storage(storage),
        Stash::Void,
    ]
}

#[test]
fn append_libffi_args_handles_every_scalar_variant() {
    for v in &scalar_value_samples() {
        let mut args = Vec::new();
        v.append_libffi_args(&mut args);
        assert_eq!(args.len(), 1);
    }
}

#[test]
fn libffi_arg_conversion_covers_every_scalar_variant() {
    for v in &scalar_value_samples() {
        let _arg: libffi::middle::Arg<'_> = v.into();
    }
}

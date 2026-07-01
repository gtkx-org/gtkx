use std::ffi::c_void;
use std::sync::Arc;

use napi::Env;
use napi::bindgen_prelude::{FromNapiValue, Unknown};
use native::ffi::callback::{CallbackData, CallbackState};
use native::ffi::codec::{Codec, VoidCodec};
use native::ffi::value::JsRef;
use native::ffi::{CallbackValue, Stash, StashedValue};

fn callback_value(destroy: bool) -> CallbackValue {
    let destroy_ptr = if destroy {
        Some(std::ptr::without_provenance_mut::<c_void>(0xDEAD))
    } else {
        None
    };
    CallbackValue::new(
        std::ptr::without_provenance_mut::<c_void>(0xCAFE),
        std::ptr::without_provenance_mut::<c_void>(0xBEEF),
        destroy_ptr,
        None,
    )
}

fn js_func_ref() -> Arc<JsRef> {
    let env = Env::from_raw(std::ptr::null_mut());
    let func = unsafe { Unknown::from_napi_value(std::ptr::null_mut(), std::ptr::null_mut()) }
        .expect("stubbed unknown creation should succeed");
    Arc::new(JsRef::from_js_value(&env, &func).expect("stubbed reference creation should succeed"))
}

fn armed_callback_value(destroy_ptr: Option<*mut c_void>) -> (CallbackValue, Arc<JsRef>) {
    let js_fn = js_func_ref();
    let data = CallbackData::new(
        Arc::clone(&js_fn),
        Vec::new(),
        Codec::Void(VoidCodec),
        None,
        false,
    );
    let state = Box::new(CallbackState::new(data));
    let fn_ptr = state.code_ptr;
    (
        CallbackValue::new_pending_transfer(fn_ptr, destroy_ptr, state),
        js_fn,
    )
}

fn release_handed_over_state(state_ptr: *mut c_void, js_fn: &Arc<JsRef>) {
    assert_eq!(Arc::strong_count(js_fn), 2);
    unsafe { CallbackState::destroy(state_ptr) };
    assert_eq!(Arc::strong_count(js_fn), 1);
}

#[test]
fn new_armed_exposes_state_and_closure_pointers() {
    let destroy_ptr = CallbackState::destroy as *mut c_void;
    let (tv, _js_func) = armed_callback_value(Some(destroy_ptr));
    assert!(!tv.fn_ptr().is_null());
    assert!(!tv.state_ptr().is_null());
    assert_eq!(tv.destroy_ptr(), Some(destroy_ptr));
    let state = unsafe { &*(tv.state_ptr() as *const CallbackState) };
    assert_eq!(state.code_ptr, tv.fn_ptr());
}

#[test]
fn armed_state_drops_with_value_when_call_never_happens() {
    let (tv, js_fn) = armed_callback_value(None);
    assert_eq!(Arc::strong_count(&js_fn), 2);
    drop(tv);
    assert_eq!(Arc::strong_count(&js_fn), 1);
}

#[test]
fn disarm_pending_transfer_hands_state_over_and_is_idempotent() {
    let (tv, js_fn) = armed_callback_value(Some(CallbackState::destroy as *mut c_void));
    let state_ptr = tv.state_ptr();
    tv.disarm_pending_transfer();
    tv.disarm_pending_transfer();
    drop(tv);
    release_handed_over_state(state_ptr, &js_fn);
}

#[test]
fn stashed_value_disarm_pending_transfer_routes_to_callback() {
    let (tv, js_fn) = armed_callback_value(None);
    let state_ptr = tv.state_ptr();
    let value = StashedValue::Callback(tv);
    value.disarm_pending_transfer();
    drop(value);
    release_handed_over_state(state_ptr, &js_fn);
}

#[test]
fn stashed_value_disarm_pending_transfer_is_a_noop_for_scalars() {
    StashedValue::I32(7).disarm_pending_transfer();
    StashedValue::F64(1.5).disarm_pending_transfer();
}

#[test]
fn callback_value_accessors_expose_pointers() {
    let tv = callback_value(true);
    assert_eq!(
        tv.fn_ptr(),
        std::ptr::without_provenance_mut::<c_void>(0xCAFE)
    );
    assert_eq!(
        tv.state_ptr(),
        std::ptr::without_provenance_mut::<c_void>(0xBEEF)
    );
    assert_eq!(
        tv.destroy_ptr(),
        Some(std::ptr::without_provenance_mut::<c_void>(0xDEAD))
    );
}

#[test]
fn callback_value_without_destroy_has_none() {
    let tv = callback_value(false);
    assert_eq!(tv.destroy_ptr(), None);
}

#[test]
fn write_scalar_to_ptr_writes_every_numeric_variant() {
    macro_rules! check {
        ($variant:ident, $value:expr, $codec:ty) => {{
            let mut slot: u64 = 0;
            let slot_ptr = &mut slot as *mut u64 as *mut c_void;
            let v = StashedValue::$variant($value);
            unsafe { v.write_scalar_to_ptr(slot_ptr) }.expect("scalar write should succeed");
            let read = unsafe { *(slot_ptr as *const $codec) };
            assert_eq!(read, $value);
        }};
    }
    check!(U8, 12u8, u8);
    check!(I8, -5i8, i8);
    check!(U16, 1234u16, u16);
    check!(I16, -321i16, i16);
    check!(U32, 99999u32, u32);
    check!(I32, -42i32, i32);
    check!(U64, 7u64, u64);
    check!(I64, -7i64, i64);
    check!(F32, 1.5f32, f32);
    check!(F64, 2.5f64, f64);
}

#[test]
fn as_ptr_ptr_variant_returns_inner() {
    let inner = std::ptr::without_provenance_mut::<c_void>(0x42);
    let v = StashedValue::Ptr(inner);
    assert_eq!(v.as_ptr("test").unwrap(), inner);

    let null = StashedValue::Ptr(std::ptr::null_mut());
    assert!(null.as_ptr("test").unwrap().is_null());
}

#[test]
fn as_ptr_storage_returns_storage_ptr() {
    let storage: Stash = vec![9u8].into();
    let storage_ptr = storage.ptr();
    let v = StashedValue::Stashed(storage);
    assert_eq!(v.as_ptr("test").unwrap(), storage_ptr);
}

#[test]
fn as_ptr_scalar_and_callback_and_void_fail() {
    assert!(StashedValue::U8(1).as_ptr("test").is_err());
    assert!(StashedValue::I8(1).as_ptr("test").is_err());
    assert!(StashedValue::U16(1).as_ptr("test").is_err());
    assert!(StashedValue::I16(1).as_ptr("test").is_err());
    assert!(StashedValue::U32(1).as_ptr("test").is_err());
    assert!(StashedValue::I32(1).as_ptr("test").is_err());
    assert!(StashedValue::U64(1).as_ptr("test").is_err());
    assert!(StashedValue::I64(1).as_ptr("test").is_err());
    assert!(StashedValue::F32(1.0).as_ptr("test").is_err());
    assert!(StashedValue::F64(1.0).as_ptr("test").is_err());
    assert!(
        StashedValue::Callback(callback_value(false))
            .as_ptr("test")
            .is_err()
    );
    assert!(StashedValue::Void.as_ptr("test").is_err());
}

#[test]
fn as_non_null_ptr_null_returns_none() {
    let v = StashedValue::Ptr(std::ptr::null_mut());
    assert_eq!(v.as_non_null_ptr("test").unwrap(), None);
}

#[test]
fn as_non_null_ptr_non_null_returns_some() {
    let inner = std::ptr::without_provenance_mut::<c_void>(0x55);
    let v = StashedValue::Ptr(inner);
    assert_eq!(v.as_non_null_ptr("test").unwrap(), Some(inner));
}

#[test]
fn as_non_null_ptr_propagates_error() {
    assert!(StashedValue::Void.as_non_null_ptr("test").is_err());
}

#[test]
fn to_number_handles_every_numeric_variant() {
    assert_eq!(StashedValue::I8(-3).to_number().unwrap(), -3.0);
    assert_eq!(StashedValue::U8(3).to_number().unwrap(), 3.0);
    assert_eq!(StashedValue::I16(-300).to_number().unwrap(), -300.0);
    assert_eq!(StashedValue::U16(300).to_number().unwrap(), 300.0);
    assert_eq!(StashedValue::I32(-30000).to_number().unwrap(), -30000.0);
    assert_eq!(StashedValue::U32(30000).to_number().unwrap(), 30000.0);
    assert_eq!(StashedValue::I64(-7).to_number().unwrap(), -7.0);
    assert_eq!(StashedValue::U64(7).to_number().unwrap(), 7.0);
    assert!((StashedValue::F32(1.25).to_number().unwrap() - 1.25).abs() < 1e-6);
    assert_eq!(StashedValue::F64(2.5).to_number().unwrap(), 2.5);
}

#[test]
fn append_libffi_args_callback_without_destroy_pushes_two() {
    let v = StashedValue::Callback(callback_value(false));
    let mut args = Vec::new();
    v.append_libffi_args(&mut args);
    assert_eq!(args.len(), 2);
}

#[test]
fn append_libffi_args_callback_with_destroy_pushes_three() {
    let v = StashedValue::Callback(callback_value(true));
    let mut args = Vec::new();
    v.append_libffi_args(&mut args);
    assert_eq!(args.len(), 3);
}
fn scalar_value_samples() -> Vec<StashedValue> {
    let storage: Stash = vec![1u8].into();
    vec![
        StashedValue::U8(1),
        StashedValue::I8(1),
        StashedValue::U16(1),
        StashedValue::I16(1),
        StashedValue::U32(1),
        StashedValue::I32(1),
        StashedValue::U64(1),
        StashedValue::I64(1),
        StashedValue::F32(1.0),
        StashedValue::F64(1.0),
        StashedValue::Ptr(std::ptr::null_mut()),
        StashedValue::Stashed(storage),
        StashedValue::Void,
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
        let _arg: libffi::middle::Arg = v.into();
    }
}

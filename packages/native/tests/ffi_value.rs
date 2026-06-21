#![allow(deprecated)]

mod common;

use std::ffi::c_void;
use std::sync::Arc;

use napi::{Env, JsFunction, NapiValue as _};
use native::ffi::{CallbackValue, FfiStorage, FfiValue};
use native::trampoline::{TrampolineData, TrampolineState};
use native::types::{Type, VoidType};
use native::value::JsRef;

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

fn js_func_ref() -> Arc<JsRef<JsFunction>> {
    let env = Env::from_raw(std::ptr::null_mut());
    // SAFETY: this stubs a `JsFunction` from null env/value handles purely to exercise the
    // wrapper bookkeeping; `from_raw_unchecked` only stores the raw handles and `JsRef` records
    // them without dereferencing, so no napi call touches the null pointers.
    let func =
        unsafe { JsFunction::from_raw_unchecked(std::ptr::null_mut(), std::ptr::null_mut()) };
    Arc::new(JsRef::from_js_value(&env, &func).expect("stubbed reference creation should succeed"))
}

fn armed_callback_value(
    destroy_ptr: Option<*mut c_void>,
) -> (CallbackValue, Arc<JsRef<JsFunction>>) {
    let js_func = js_func_ref();
    let data = TrampolineData::new(
        Arc::clone(&js_func),
        Vec::new(),
        Type::Void(VoidType),
        None,
        false,
    );
    let state = Box::new(TrampolineState::create(data));
    let fn_ptr = state.code_ptr;
    (
        CallbackValue::new_armed(fn_ptr, destroy_ptr, state),
        js_func,
    )
}

fn release_handed_over_state(state_ptr: *mut c_void, js_func: &Arc<JsRef<JsFunction>>) {
    assert_eq!(Arc::strong_count(js_func), 2);
    // SAFETY: `state_ptr` is the leaked `TrampolineState` raw pointer handed over by the armed
    // `CallbackValue`; `destroy` reclaims and drops it exactly once, releasing its `Arc` clone.
    unsafe { TrampolineState::destroy(state_ptr) };
    assert_eq!(Arc::strong_count(js_func), 1);
}

#[test]
fn new_armed_exposes_state_and_closure_pointers() {
    let destroy_ptr = TrampolineState::destroy as *mut c_void;
    let (tv, _js_func) = armed_callback_value(Some(destroy_ptr));
    assert!(!tv.fn_ptr().is_null());
    assert!(!tv.state_ptr().is_null());
    assert_eq!(tv.destroy_ptr(), Some(destroy_ptr));
    // SAFETY: the armed `CallbackValue` still owns the boxed `TrampolineState`, so `state_ptr()`
    // is a live, correctly-typed pointer; borrowing it to read `code_ptr` is sound.
    let state = unsafe { &*(tv.state_ptr() as *const TrampolineState) };
    assert_eq!(state.code_ptr, tv.fn_ptr());
}

#[test]
fn armed_state_drops_with_value_when_call_never_happens() {
    let (tv, js_func) = armed_callback_value(None);
    assert_eq!(Arc::strong_count(&js_func), 2);
    drop(tv);
    assert_eq!(Arc::strong_count(&js_func), 1);
}

#[test]
fn disarm_pending_transfer_hands_state_over_and_is_idempotent() {
    let (tv, js_func) = armed_callback_value(Some(TrampolineState::destroy as *mut c_void));
    let state_ptr = tv.state_ptr();
    tv.disarm_pending_transfer();
    tv.disarm_pending_transfer();
    drop(tv);
    release_handed_over_state(state_ptr, &js_func);
}

#[test]
fn ffi_value_disarm_pending_transfer_routes_to_callback() {
    let (tv, js_func) = armed_callback_value(None);
    let state_ptr = tv.state_ptr();
    let value = FfiValue::Callback(tv);
    value.disarm_pending_transfer();
    drop(value);
    release_handed_over_state(state_ptr, &js_func);
}

#[test]
fn ffi_value_disarm_pending_transfer_is_a_noop_for_scalars() {
    FfiValue::I32(7).disarm_pending_transfer();
    FfiValue::F64(1.5).disarm_pending_transfer();
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
fn write_scalar_to_writes_every_numeric_variant() {
    macro_rules! check {
        ($variant:ident, $value:expr, $ty:ty) => {{
            let mut slot: u64 = 0;
            let slot_ptr = &mut slot as *mut u64 as *mut c_void;
            let v = FfiValue::$variant($value);
            // SAFETY: `slot_ptr` points to the live, writable `u64` stack local `slot`, at least
            // as wide as any scalar variant `write_scalar_to` stores, so the write is in bounds.
            unsafe { v.write_scalar_to(slot_ptr) }.expect("scalar write should succeed");
            // SAFETY: the matching `$ty` was just written into `slot`, so reading it back through a
            // correctly-typed pointer is an in-bounds, well-typed read.
            let read = unsafe { *(slot_ptr as *const $ty) };
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
    let v = FfiValue::Ptr(inner);
    assert_eq!(v.as_ptr("test").unwrap(), inner);
}

#[test]
fn as_ptr_storage_returns_storage_ptr() {
    let storage: FfiStorage = vec![9u8].into();
    let storage_ptr = storage.ptr();
    let v = FfiValue::Storage(storage);
    assert_eq!(v.as_ptr("test").unwrap(), storage_ptr);
}

#[test]
fn as_ptr_scalar_and_callback_and_void_fail() {
    assert!(FfiValue::U8(1).as_ptr("test").is_err());
    assert!(FfiValue::I8(1).as_ptr("test").is_err());
    assert!(FfiValue::U16(1).as_ptr("test").is_err());
    assert!(FfiValue::I16(1).as_ptr("test").is_err());
    assert!(FfiValue::U32(1).as_ptr("test").is_err());
    assert!(FfiValue::I32(1).as_ptr("test").is_err());
    assert!(FfiValue::U64(1).as_ptr("test").is_err());
    assert!(FfiValue::I64(1).as_ptr("test").is_err());
    assert!(FfiValue::F32(1.0).as_ptr("test").is_err());
    assert!(FfiValue::F64(1.0).as_ptr("test").is_err());
    assert!(
        FfiValue::Callback(callback_value(false))
            .as_ptr("test")
            .is_err()
    );
    assert!(FfiValue::Void.as_ptr("test").is_err());
}

#[test]
fn as_non_null_ptr_null_returns_none() {
    let v = FfiValue::Ptr(std::ptr::null_mut());
    assert_eq!(v.as_non_null_ptr("test").unwrap(), None);
}

#[test]
fn as_non_null_ptr_non_null_returns_some() {
    let inner = std::ptr::without_provenance_mut::<c_void>(0x55);
    let v = FfiValue::Ptr(inner);
    assert_eq!(v.as_non_null_ptr("test").unwrap(), Some(inner));
}

#[test]
fn as_non_null_ptr_propagates_error() {
    assert!(FfiValue::Void.as_non_null_ptr("test").is_err());
}

#[test]
fn to_number_handles_every_numeric_variant() {
    assert_eq!(FfiValue::I8(-3).to_number().unwrap(), -3.0);
    assert_eq!(FfiValue::U8(3).to_number().unwrap(), 3.0);
    assert_eq!(FfiValue::I16(-300).to_number().unwrap(), -300.0);
    assert_eq!(FfiValue::U16(300).to_number().unwrap(), 300.0);
    assert_eq!(FfiValue::I32(-30000).to_number().unwrap(), -30000.0);
    assert_eq!(FfiValue::U32(30000).to_number().unwrap(), 30000.0);
    assert_eq!(FfiValue::I64(-7).to_number().unwrap(), -7.0);
    assert_eq!(FfiValue::U64(7).to_number().unwrap(), 7.0);
    assert!((FfiValue::F32(1.25).to_number().unwrap() - 1.25).abs() < 1e-6);
    assert_eq!(FfiValue::F64(2.5).to_number().unwrap(), 2.5);
}

#[test]
fn append_libffi_args_callback_without_destroy_pushes_two() {
    let v = FfiValue::Callback(callback_value(false));
    let mut args = Vec::new();
    v.append_libffi_args(&mut args);
    assert_eq!(args.len(), 2);
}

#[test]
fn append_libffi_args_callback_with_destroy_pushes_three() {
    let v = FfiValue::Callback(callback_value(true));
    let mut args = Vec::new();
    v.append_libffi_args(&mut args);
    assert_eq!(args.len(), 3);
}

#[test]
fn append_libffi_args_scalar_pushes_one() {
    let v = FfiValue::I32(99);
    let mut args = Vec::new();
    v.append_libffi_args(&mut args);
    assert_eq!(args.len(), 1);
}

fn scalar_value_samples() -> Vec<FfiValue> {
    let storage: FfiStorage = vec![1u8].into();
    vec![
        FfiValue::U8(1),
        FfiValue::I8(1),
        FfiValue::U16(1),
        FfiValue::I16(1),
        FfiValue::U32(1),
        FfiValue::I32(1),
        FfiValue::U64(1),
        FfiValue::I64(1),
        FfiValue::F32(1.0),
        FfiValue::F64(1.0),
        FfiValue::Ptr(std::ptr::null_mut()),
        FfiValue::Storage(storage),
        FfiValue::Void,
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

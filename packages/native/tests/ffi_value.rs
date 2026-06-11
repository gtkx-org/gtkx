mod common;

use std::ffi::c_void;

use native::ffi::{FfiStorage, FfiValue, TrampolineValue};

fn trampoline_value(destroy: bool) -> TrampolineValue {
    let destroy_ptr = if destroy {
        Some(std::ptr::without_provenance_mut::<c_void>(0xDEAD))
    } else {
        None
    };
    TrampolineValue::new(
        std::ptr::without_provenance_mut::<c_void>(0xCAFE),
        std::ptr::without_provenance_mut::<c_void>(0xBEEF),
        destroy_ptr,
        None,
    )
}

#[test]
fn trampoline_value_accessors_expose_pointers() {
    let tv = trampoline_value(true);
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
fn trampoline_value_without_destroy_has_none() {
    let tv = trampoline_value(false);
    assert_eq!(tv.destroy_ptr(), None);
}

#[test]
fn trampoline_value_debug_renders_fields() {
    let tv = trampoline_value(true);
    let rendered = format!("{tv:?}");
    assert!(rendered.contains("TrampolineValue"));
    assert!(rendered.contains("fn_ptr"));
    assert!(rendered.contains("state_ptr"));
    assert!(rendered.contains("destroy_ptr"));
}

#[test]
fn ffi_value_debug_renders_variant() {
    let rendered = format!("{:?}", FfiValue::I32(7));
    assert!(rendered.contains("I32"));
    let tv = FfiValue::Trampoline(trampoline_value(false));
    assert!(format!("{tv:?}").contains("Trampoline"));
}

#[test]
fn write_scalar_to_writes_every_numeric_variant() {
    macro_rules! check {
        ($variant:ident, $value:expr, $ty:ty) => {{
            let mut slot: u64 = 0;
            let slot_ptr = &mut slot as *mut u64 as *mut c_void;
            let v = FfiValue::$variant($value);
            // SAFETY: `slot_ptr` addresses a writable local 8-byte slot.
            unsafe { v.write_scalar_to(slot_ptr) }.expect("scalar write should succeed");
            // SAFETY: The slot is a live local just written.
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
fn write_scalar_to_rejects_pointer_shaped_variants() {
    let mut slot: u64 = 0;
    let slot_ptr = &mut slot as *mut u64 as *mut c_void;

    let storage: FfiStorage = vec![1u8].into();
    let rejected = [
        FfiValue::Ptr(std::ptr::null_mut()),
        FfiValue::Storage(storage),
        FfiValue::Trampoline(trampoline_value(false)),
        FfiValue::Void,
    ];
    for v in &rejected {
        // SAFETY: Pointer-shaped variants bail before any write.
        let err = unsafe { v.write_scalar_to(slot_ptr) }
            .expect_err("pointer-shaped variants have no scalar payload");
        assert!(err.to_string().contains("no scalar payload"));
    }
    assert_eq!(slot, 0);
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
fn as_ptr_scalar_and_trampoline_and_void_fail() {
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
        FfiValue::Trampoline(trampoline_value(false))
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
fn to_number_rejects_non_numeric_variants() {
    assert!(FfiValue::Ptr(std::ptr::null_mut()).to_number().is_err());
    let storage: FfiStorage = vec![1u8].into();
    assert!(FfiValue::Storage(storage).to_number().is_err());
    assert!(
        FfiValue::Trampoline(trampoline_value(false))
            .to_number()
            .is_err()
    );
    assert!(FfiValue::Void.to_number().is_err());
}

#[test]
fn append_libffi_args_trampoline_without_destroy_pushes_two() {
    let v = FfiValue::Trampoline(trampoline_value(false));
    let mut args = Vec::new();
    v.append_libffi_args(&mut args);
    assert_eq!(args.len(), 2);
}

#[test]
fn append_libffi_args_trampoline_with_destroy_pushes_three() {
    let v = FfiValue::Trampoline(trampoline_value(true));
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

#[test]
#[should_panic(expected = "Trampoline requires append_libffi_args")]
fn libffi_arg_conversion_trampoline_panics() {
    let v = FfiValue::Trampoline(trampoline_value(false));
    let _arg: libffi::middle::Arg = (&v).into();
}

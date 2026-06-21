mod common;

use std::ffi::c_void;

use libffi::middle;
use native::types::{
    BlobType, BooleanType, CallbackType, FfiDecoder, FfiEncoder, GObjectType, IntegerKind,
    Ownership, RawPtrCodec, ReadSource, RefType, StructType, Type, VoidType,
};
use native::value::Value;
use native::{ffi, value};

fn assert_ownership_predicates_mutually_exclusive() {
    assert!(Ownership::Full.is_full());
    assert!(!Ownership::Full.is_borrowed());
    assert!(Ownership::Borrowed.is_borrowed());
    assert!(!Ownership::Borrowed.is_full());
}

#[test]
fn ownership_is_full_and_is_borrowed() {
    assert_ownership_predicates_mutually_exclusive();
}

#[test]
fn ownership_default_is_borrowed() {
    assert!(Ownership::default().is_borrowed());
}

#[test]
fn transfer_release_matches_codec_ownership() {
    common::run(|| {
        use native::ffi::PendingRelease;
        use native::types::{BoxedType, FfiEncoder as _, GObjectType, StructType};

        let full_object = GObjectType {
            ownership: Ownership::Full,
        };
        assert!(matches!(
            full_object.transfer_release(),
            Some(PendingRelease::ObjectUnref)
        ));
        let borrowed_object = GObjectType {
            ownership: Ownership::Borrowed,
        };
        assert!(borrowed_object.transfer_release().is_none());

        let full_boxed = BoxedType {
            ownership: Ownership::Full,
            type_name: "GdkRGBA".to_string(),
            library: None,
            get_type_fn: None,
            free_fn: None,
            caller_allocated: false,
        };
        assert!(matches!(
            full_boxed.transfer_release(),
            Some(PendingRelease::BoxedFree(_))
        ));
        let borrowed_boxed = BoxedType {
            ownership: Ownership::Borrowed,
            ..full_boxed
        };
        assert!(borrowed_boxed.transfer_release().is_none());

        let plain_struct = StructType {
            ownership: Ownership::Full,
            size: None,
            caller_allocated: false,
        };
        assert!(plain_struct.transfer_release().is_none());
    });
}

#[test]
fn ownership_predicates_are_mutually_exclusive() {
    assert_ownership_predicates_mutually_exclusive();
}

fn gobject_type() -> GObjectType {
    GObjectType {
        ownership: Ownership::Borrowed,
    }
}

fn struct_type() -> StructType {
    StructType {
        ownership: Ownership::Borrowed,
        size: Some(8),
        caller_allocated: false,
    }
}

#[allow(clippy::default_trait_access)]
fn callback_type() -> CallbackType {
    CallbackType {
        arg_types: vec![Type::Integer(IntegerKind::I32)],
        return_type: Box::new(Type::Void(VoidType)),
        has_destroy: false,
        user_data_index: None,
        scope: Default::default(),
    }
}

#[test]
fn can_be_return_type_accepts_value_shapes_and_rejects_argument_shapes() {
    assert!(Type::Integer(IntegerKind::I32).can_be_return_type());
    assert!(Type::Void(VoidType).can_be_return_type());
    assert!(Type::GObject(gobject_type()).can_be_return_type());
    assert!(Type::Tagged(common::enum_tagged()).can_be_return_type());

    assert!(!Type::Callback(callback_type()).can_be_return_type());
    assert!(!Type::Blob(BlobType).can_be_return_type());
    let ref_type = RefType::new(Type::Integer(IntegerKind::I32));
    assert!(!Type::Ref(ref_type).can_be_return_type());
}

#[test]
fn ffi_decoder_decode_default_bails() {
    assert!(FfiDecoder::decode(&callback_type(), &ffi::FfiValue::Void).is_err());
}

#[test]
fn ffi_decoder_decode_with_context_default_delegates_to_decode() {
    let result = FfiDecoder::decode_with_context(&callback_type(), &ffi::FfiValue::Void, &[], &[]);
    assert!(result.is_err());
}

#[test]
fn raw_ptr_codec_ptr_to_value_default_bails() {
    assert!(
        // SAFETY: the default `read_value` for a callback type bails without dereferencing, so the
        // dangling sentinel `8` is never read; the call is sound and returns an error.
        unsafe { FfiDecoder::read(&callback_type(), ReadSource::Value(8 as *mut c_void, "ctx"),) }
            .is_err()
    );
}

#[test]
fn raw_ptr_codec_read_from_raw_ptr_default_dereferences_then_bails() {
    let mut inner: *mut c_void = 8 as *mut c_void;
    let ptr = &mut inner as *mut *mut c_void as *const c_void;
    // SAFETY: `ptr` points to the live pointer-sized stack local `inner`; the default
    // `read_pointer_slot` reads that one in-bounds pointer, then bails on the inner sentinel
    // without dereferencing it.
    assert!(unsafe { FfiDecoder::read(&callback_type(), ReadSource::Slot(ptr, "ctx")) }.is_err());
}

#[test]
fn raw_ptr_codec_write_return_to_raw_ptr_default_writes_null() {
    let mut slot: *mut c_void = 9 as *mut c_void;
    let ret = &mut slot as *mut *mut c_void as *mut c_void;
    // SAFETY: `ret` points to the live, writable pointer-sized stack local `slot`; the default
    // `write_return_to_raw_ptr` writes null into that in-bounds slot.
    unsafe {
        RawPtrCodec::write_return_to_raw_ptr(&callback_type(), ret, &Ok(Value::Number(1.0)));
    }
    assert!(slot.is_null());

    slot = 9 as *mut c_void;
    // SAFETY: same writable pointer-sized slot `ret`; the error case also writes null in bounds.
    unsafe { RawPtrCodec::write_return_to_raw_ptr(&callback_type(), ret, &Err(())) };
    assert!(slot.is_null());
}

#[test]
fn raw_ptr_codec_write_value_to_raw_ptr_default_bails() {
    let mut slot: *mut c_void = std::ptr::null_mut();
    let ptr = &mut slot as *mut *mut c_void as *mut c_void;
    assert!(
        // SAFETY: the default `write_value_to_raw_ptr` for a callback type bails before touching
        // `ptr`, which nonetheless points to the live pointer-sized stack local `slot`.
        unsafe { RawPtrCodec::write_value_to_raw_ptr(&callback_type(), ptr, &Value::Number(1.0)) }
            .is_err()
    );
}

extern "C" fn ret_ptr() -> *mut c_void {
    std::ptr::null_mut()
}

#[test]
fn ffi_encoder_defaults_cover_pointer_typed_codec() {
    let st = struct_type();

    assert_eq!(
        FfiEncoder::libffi_type(&st).as_raw_ptr(),
        middle::Type::pointer().as_raw_ptr()
    );

    let mut arg_types: Vec<middle::Type> = Vec::new();
    FfiEncoder::append_ffi_arg_types(&st, &mut arg_types);
    assert_eq!(arg_types.len(), 1);

    // SAFETY: the default `ref_for_transfer` returns its pointer argument unchanged without
    // dereferencing it, so the sentinel `16` is never read; the call is sound.
    let transferred = unsafe { FfiEncoder::ref_for_transfer(&st, 16 as *mut c_void) }.unwrap();
    assert_eq!(transferred, 16 as *mut c_void);

    let cif = middle::Cif::new(Vec::new(), middle::Type::pointer());
    let result =
        FfiEncoder::call_cif(&st, &cif, middle::CodePtr(ret_ptr as *mut c_void), &[]).unwrap();
    assert!(matches!(result, ffi::FfiValue::Ptr(p) if p.is_null()));
}

#[test]
fn type_enum_dispatch_routes_codec_traits() {
    let ty = Type::Boolean(BooleanType);
    let encoded = FfiEncoder::encode(&ty, &value::Value::Boolean(true)).unwrap();
    assert!(matches!(encoded, ffi::FfiValue::I32(1)));
    let decoded = FfiDecoder::decode(&ty, &ffi::FfiValue::I32(0)).unwrap();
    assert!(matches!(decoded, value::Value::Boolean(false)));
}

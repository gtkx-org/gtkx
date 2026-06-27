mod helpers;

use std::ffi::c_void;

use libffi::middle;
use native::ffi::descriptor::{
    BooleanDescriptor, BufferDescriptor, CallbackDescriptor, Descriptor, FfiDecoder, FfiEncoder,
    IntegerKind, ObjectDescriptor, Ownership, PointerWriter, ReadSource, RefDescriptor,
    StructDescriptor, VoidDescriptor,
};
use native::ffi::value::Value;
use native::ffi::{self, value};

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
    helpers::run(|| {
        use native::ffi::PendingRelease;
        use native::ffi::descriptor::{
            BoxedDescriptor, FfiEncoder as _, ObjectDescriptor, StructDescriptor,
        };

        let full_object = ObjectDescriptor {
            ownership: Ownership::Full,
        };
        assert!(matches!(
            full_object.transfer_release(),
            Some(PendingRelease::ObjectUnref)
        ));
        let borrowed_object = ObjectDescriptor {
            ownership: Ownership::Borrowed,
        };
        assert!(borrowed_object.transfer_release().is_none());

        let full_boxed = BoxedDescriptor {
            ownership: Ownership::Full,
            type_name: "GdkRGBA".to_string(),
            shared_library: None,
            get_type_fn: None,
            free_fn: None,
            caller_allocated: false,
        };
        assert!(matches!(
            full_boxed.transfer_release(),
            Some(PendingRelease::BoxedFree(_))
        ));
        let borrowed_boxed = BoxedDescriptor {
            ownership: Ownership::Borrowed,
            ..full_boxed
        };
        assert!(borrowed_boxed.transfer_release().is_none());

        let plain_struct = StructDescriptor {
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

fn object_descriptor() -> ObjectDescriptor {
    ObjectDescriptor {
        ownership: Ownership::Borrowed,
    }
}

fn struct_descriptor() -> StructDescriptor {
    StructDescriptor {
        ownership: Ownership::Borrowed,
        size: Some(8),
        caller_allocated: false,
    }
}

#[allow(clippy::default_trait_access)]
fn callback_descriptor() -> CallbackDescriptor {
    CallbackDescriptor {
        arg_descriptors: vec![Descriptor::Integer(IntegerKind::I32)],
        return_descriptor: Box::new(Descriptor::Void(VoidDescriptor)),
        has_destroy: false,
        user_data_index: None,
        scope: Default::default(),
    }
}

#[test]
fn can_be_return_accepts_value_shapes_and_rejects_argument_shapes() {
    assert!(Descriptor::Integer(IntegerKind::I32).can_be_return());
    assert!(Descriptor::Void(VoidDescriptor).can_be_return());
    assert!(Descriptor::Object(object_descriptor()).can_be_return());
    assert!(Descriptor::EnumFlags(helpers::enum_descriptor()).can_be_return());

    assert!(!Descriptor::Callback(callback_descriptor()).can_be_return());
    assert!(!Descriptor::Buffer(BufferDescriptor).can_be_return());
    let ref_descriptor =
        RefDescriptor::new(Descriptor::Integer(IntegerKind::I32)).expect("valid Ref inner");
    assert!(!Descriptor::Ref(ref_descriptor).can_be_return());
}

#[test]
fn ffi_decoder_decode_default_bails() {
    assert!(FfiDecoder::decode(&callback_descriptor(), &ffi::StashedValue::Void).is_err());
}

#[test]
fn ffi_decoder_decode_with_context_default_delegates_to_decode() {
    let result =
        FfiDecoder::decode_with_context(&callback_descriptor(), &ffi::StashedValue::Void, &[], &[]);
    assert!(result.is_err());
}

#[test]
fn pointer_codec_ptr_to_value_default_bails() {
    assert!(
        // SAFETY: the default `read_value` for a callback type bails without dereferencing, so the
        // dangling sentinel `8` is never read; the call is sound and returns an error.
        unsafe {
            FfiDecoder::read(
                &callback_descriptor(),
                ReadSource::Value(8 as *mut c_void, "ctx"),
            )
        }
        .is_err()
    );
}

#[test]
fn pointer_codec_read_from_pointer_default_dereferences_then_bails() {
    let mut inner: *mut c_void = 8 as *mut c_void;
    let ptr = &mut inner as *mut *mut c_void as *const c_void;
    // SAFETY: `ptr` points to the live pointer-sized stack local `inner`; the default
    // `read_pointer_slot` reads that one in-bounds pointer, then bails on the inner sentinel
    // without dereferencing it.
    let result = unsafe { FfiDecoder::read(&callback_descriptor(), ReadSource::Slot(ptr, "ctx")) };
    assert!(result.is_err());
}

#[test]
fn pointer_codec_write_return_to_pointer_default_writes_null() {
    let mut slot: *mut c_void = 9 as *mut c_void;
    let ret = &mut slot as *mut *mut c_void as *mut c_void;
    // SAFETY: `ret` points to the live, writable pointer-sized stack local `slot`; the default
    // `write_return_to_pointer` writes null into that in-bounds slot.
    unsafe {
        PointerWriter::write_return_to_pointer(
            &callback_descriptor(),
            ret,
            &Ok(Value::Number(1.0)),
        );
    }
    assert!(slot.is_null());

    slot = 9 as *mut c_void;
    // SAFETY: same writable pointer-sized slot `ret`; the error case also writes null in bounds.
    unsafe { PointerWriter::write_return_to_pointer(&callback_descriptor(), ret, &Err(())) };
    assert!(slot.is_null());
}

#[test]
fn pointer_codec_write_value_to_pointer_default_bails() {
    let mut slot: *mut c_void = std::ptr::null_mut();
    let ptr = &mut slot as *mut *mut c_void as *mut c_void;
    assert!(
        // SAFETY: the default `write_value_to_pointer` for a callback type bails before touching
        // `ptr`, which nonetheless points to the live pointer-sized stack local `slot`.
        unsafe {
            PointerWriter::write_value_to_pointer(&callback_descriptor(), ptr, &Value::Number(1.0))
        }
        .is_err()
    );
}

extern "C" fn ret_ptr() -> *mut c_void {
    std::ptr::null_mut()
}

#[test]
fn ffi_encoder_defaults_cover_pointer_typed_codec() {
    let st = struct_descriptor();

    assert_eq!(
        FfiEncoder::libffi_type(&st).as_raw_ptr(),
        middle::Type::pointer().as_raw_ptr()
    );

    let mut arg_descriptors: Vec<middle::Type> = Vec::new();
    FfiEncoder::append_ffi_arg_types(&st, &mut arg_descriptors);
    assert_eq!(arg_descriptors.len(), 1);

    // SAFETY: the default `ref_for_transfer` returns its pointer argument unchanged without
    // dereferencing it, so the sentinel `16` is never read; the call is sound.
    let transferred = unsafe { FfiEncoder::ref_for_transfer(&st, 16 as *mut c_void) }.unwrap();
    assert_eq!(transferred, 16 as *mut c_void);

    let cif = middle::Cif::new(Vec::new(), middle::Type::pointer());
    let result =
        FfiEncoder::call_cif(&st, &cif, middle::CodePtr(ret_ptr as *mut c_void), &[]).unwrap();
    assert!(matches!(result, ffi::StashedValue::Ptr(p) if p.is_null()));
}

#[test]
fn descriptor_enum_dispatch_routes_codec_traits() {
    let descriptor = Descriptor::Boolean(BooleanDescriptor);
    let encoded = FfiEncoder::encode(&descriptor, &value::Value::Boolean(true)).unwrap();
    assert!(matches!(encoded, ffi::StashedValue::I32(1)));
    let decoded = FfiDecoder::decode(&descriptor, &ffi::StashedValue::I32(0)).unwrap();
    assert!(matches!(decoded, value::Value::Boolean(false)));
}

use std::ffi::c_void;

use libffi::middle;
use napi::JsValue as _;
use napi::bindgen_prelude::FromNapiValue as _;
use native::ffi;
use native::ffi::Slot;
use native::ffi::codec::{
    BooleanCodec, CallbackCodec, CallbackScope, Codec, Decoder, DestroyNotifyKind, Encoder,
    IntegerCodec, Ownership, PtrWriter, ReadCtx, SlotInit, StructCodec, VoidCodec,
};
use native::ffi::descriptor::Descriptor;
use test_support as helpers;
use test_support::napi_mock;

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
        use native::ffi::ReleaseKind;
        use native::ffi::codec::{BoxedCodec, Encoder as _, ObjectCodec, StructCodec};

        let full_object = ObjectCodec {
            ownership: Ownership::Full,
            is_call_scoped: false,
        };
        assert!(matches!(
            full_object.transfer_release(),
            Some(ReleaseKind::ObjectUnref)
        ));
        let borrowed_object = ObjectCodec {
            ownership: Ownership::Borrowed,
            is_call_scoped: false,
        };
        assert!(borrowed_object.transfer_release().is_none());

        let full_boxed = BoxedCodec {
            ownership: Ownership::Full,
            type_name: "GdkRGBA".to_string(),
            shared_library: None,
            get_type_fn_name: None,
            free_fn_name: None,
            caller_allocated: false,
            size: None,
            inline: false,
        };
        assert!(matches!(
            full_boxed.transfer_release(),
            Some(ReleaseKind::BoxedFree(_))
        ));
        let borrowed_boxed = BoxedCodec {
            ownership: Ownership::Borrowed,
            ..full_boxed
        };
        assert!(borrowed_boxed.transfer_release().is_none());

        let plain_struct = StructCodec {
            ownership: Ownership::Full,
            size: None,
            caller_allocated: false,
            inline: false,
        };
        assert!(plain_struct.transfer_release().is_none());
    });
}

fn struct_codec() -> StructCodec {
    StructCodec {
        ownership: Ownership::Borrowed,
        size: Some(8),
        caller_allocated: false,
        inline: false,
    }
}

fn callback_codec() -> CallbackCodec {
    CallbackCodec {
        arg_codecs: vec![Codec::Integer(IntegerCodec::I32)],
        return_codec: Box::new(Codec::Void(VoidCodec)),
        has_destroy: false,
        destroy_kind: DestroyNotifyKind::default(),
        has_user_data: false,
        user_data_index: None,
        can_throw: false,
        scope: CallbackScope::default(),
    }
}

#[test]
fn ffi_decoder_decode_default_bails() {
    let env = helpers::fake_env();
    assert!(Decoder::decode(&callback_codec(), &env, &ffi::Stash::Void).is_err());
}

#[test]
fn ffi_decoder_decode_with_context_default_delegates_to_decode() {
    let env = helpers::fake_env();
    let result = Decoder::decode_with_context(&callback_codec(), &env, &ffi::Stash::Void, &[], &[]);
    assert!(result.is_err());
}

#[test]
fn pointer_codec_ptr_to_value_default_bails() {
    let env = helpers::fake_env();
    assert!(
        unsafe {
            Decoder::read(
                &callback_codec(),
                &env,
                ReadCtx::value(8 as *mut c_void, "ctx"),
            )
        }
        .is_err()
    );
}

#[test]
fn pointer_codec_read_from_pointer_default_dereferences_then_bails() {
    let env = helpers::fake_env();
    let mut inner: *mut c_void = 8 as *mut c_void;
    let ptr = (&raw mut inner).cast_const().cast::<c_void>();
    let result = unsafe { Decoder::read(&callback_codec(), &env, ReadCtx::slot(ptr, "ctx")) };
    assert!(result.is_err());
}

#[test]
fn pointer_codec_write_return_to_pointer_default_writes_null() {
    let env = helpers::fake_env();
    let mut slot: *mut c_void = 9 as *mut c_void;
    let ret = (&raw mut slot).cast::<c_void>();
    PtrWriter::write_return_to_ptr(
        &callback_codec(),
        &env,
        unsafe { Slot::new(ret) },
        &Ok(napi_mock::to_unknown(&env, napi_mock::fake_double(1.0))),
    );
    assert!(slot.is_null());

    slot = 9 as *mut c_void;
    PtrWriter::write_return_to_ptr(&callback_codec(), &env, unsafe { Slot::new(ret) }, &Err(()));
    assert!(slot.is_null());
}

#[test]
fn pointer_codec_write_value_to_pointer_default_bails() {
    let env = helpers::fake_env();
    let mut slot: *mut c_void = std::ptr::null_mut();
    let ptr = (&raw mut slot).cast::<c_void>();
    assert!(
        PtrWriter::write_value_to_ptr(
            &callback_codec(),
            &env,
            unsafe { Slot::new(ptr) },
            napi_mock::to_unknown(&env, napi_mock::fake_double(1.0)),
            SlotInit::Initialized,
        )
        .is_err()
    );
}

extern "C" fn ret_ptr() -> *mut c_void {
    std::ptr::null_mut()
}

#[test]
fn ffi_encoder_defaults_cover_pointer_typed_codec() {
    let st = struct_codec();

    assert_eq!(
        Encoder::libffi_type(&st).as_raw_ptr(),
        middle::Type::pointer().as_raw_ptr()
    );

    let mut arg_codecs: Vec<middle::Type> = Vec::new();
    Encoder::append_ffi_arg_types(&st, &mut arg_codecs);
    assert_eq!(arg_codecs.len(), 1);

    let transferred = unsafe { Encoder::ref_for_transfer(&st, 16 as *mut c_void) }.unwrap();
    assert_eq!(transferred, 16 as *mut c_void);

    let cif = middle::Cif::new(Vec::new(), middle::Type::pointer());
    let result =
        Encoder::call_cif(&st, &cif, middle::CodePtr(ret_ptr as *mut c_void), &[]).unwrap();
    assert!(matches!(result, ffi::Stash::Ptr(p) if p.is_null()));
}

#[test]
fn descriptor_enum_dispatch_routes_codec_traits() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let descriptor = Codec::Boolean(BooleanCodec);
        let encoded = Encoder::encode(
            &descriptor,
            &env,
            napi_mock::to_unknown(&env, napi_mock::fake_bool(true)),
        )
        .unwrap();
        assert!(matches!(encoded, ffi::Stash::I32(1)));
        let decoded = Decoder::decode(&descriptor, &env, &ffi::Stash::I32(0)).unwrap();
        assert_eq!(napi_mock::read_bool(decoded.raw()), Some(false));
    });
}

#[test]
fn descriptor_nesting_is_bounded() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let mut value = napi_mock::fake_object(&[("kind", napi_mock::fake_string("int32"))]);

        for _ in 0..64 {
            value = napi_mock::fake_object(&[
                ("kind", napi_mock::fake_string("ref")),
                ("innerDescriptor", value),
            ]);
        }

        let Err(error) = (unsafe { Descriptor::from_napi_value(env.raw(), value) }) else {
            panic!("a descriptor this deep must be refused");
        };
        assert!(error.reason.contains("maximum depth"));
    });
}

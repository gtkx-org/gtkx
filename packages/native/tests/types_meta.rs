//! Coverage for the type-system metadata in `src/types.rs`: the [`Ownership`]
//! enum, [`Type`]'s `Display`, [`Type::can_be_return_type`], and the default
//! bodies of the four codec traits.

mod common;

use std::ffi::c_void;
use std::str::FromStr as _;

use libffi::middle;
use native::types::{
    ArrayKind, ArrayType, BigIntKind, BlobType, BooleanType, BoxedType, FfiDecoder, FfiEncoder,
    FloatKind, FundamentalType, GObjectType, HashTableType, IntegerKind, Ownership, RawPtrCodec,
    RefType, StringType, StructType, TrampolineType, Type, UnicharType, VoidType,
};
use native::value::Value;
use native::{ffi, value};

#[test]
fn ownership_is_full_and_is_borrowed() {
    assert!(Ownership::Full.is_full());
    assert!(!Ownership::Full.is_borrowed());
    assert!(Ownership::Borrowed.is_borrowed());
    assert!(!Ownership::Borrowed.is_full());
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
        };
        assert!(plain_struct.transfer_release().is_none());
    });
}

#[test]
fn ownership_display_renders_all_variants() {
    assert_eq!(Ownership::Full.to_string(), "full");
    assert_eq!(Ownership::Borrowed.to_string(), "borrowed");
}

#[test]
fn ownership_from_str_parses_known_and_rejects_unknown() {
    assert!(matches!(
        Ownership::from_str("full").unwrap(),
        Ownership::Full
    ));
    assert!(matches!(
        Ownership::from_str("borrowed").unwrap(),
        Ownership::Borrowed
    ));

    let err = Ownership::from_str("shared").expect_err("unknown ownership must fail");
    assert!(err.contains("'full' or 'borrowed'"));
    assert!(err.contains("shared"));
}

#[test]
fn ownership_predicates_are_mutually_exclusive() {
    assert!(Ownership::Full.is_full());
    assert!(!Ownership::Full.is_borrowed());

    assert!(Ownership::Borrowed.is_borrowed());
    assert!(!Ownership::Borrowed.is_full());
}

fn string_type() -> StringType {
    StringType {
        ownership: Ownership::Borrowed,
        length: None,
    }
}

fn gobject_type() -> GObjectType {
    GObjectType {
        ownership: Ownership::Borrowed,
    }
}

fn boxed_type() -> BoxedType {
    BoxedType {
        ownership: Ownership::Borrowed,
        type_name: "GdkRGBA".to_owned(),
        library: None,
        get_type_fn: None,
        free_fn: None,
    }
}

fn struct_type() -> StructType {
    StructType {
        ownership: Ownership::Borrowed,
        size: Some(8),
    }
}

fn fundamental_type() -> FundamentalType {
    FundamentalType {
        ownership: Ownership::Borrowed,
        library: "libgtk-4.so.1".to_owned(),
        ref_func: "g_object_ref".to_owned(),
        unref_func: "g_object_unref".to_owned(),
        type_name: None,
    }
}

fn array_type() -> ArrayType {
    ArrayType {
        item_type: Box::new(Type::Integer(IntegerKind::I32)),
        kind: ArrayKind::Array,
        ownership: Ownership::Borrowed,
        element_size: Some(4),
    }
}

fn hashtable_type() -> HashTableType {
    HashTableType {
        key_type: Box::new(Type::String(string_type())),
        value_type: Box::new(Type::String(string_type())),
        ownership: Ownership::Borrowed,
    }
}

/// Builds a [`TrampolineType`] without naming the unexported `TrampolineScope`
/// enum: the `scope` field is filled by `Default::default()`, whose target
/// type the compiler infers from the field declaration.
#[allow(clippy::default_trait_access)]
fn trampoline_type() -> TrampolineType {
    TrampolineType {
        arg_types: vec![Type::Integer(IntegerKind::I32)],
        return_type: Box::new(Type::Void(VoidType)),
        has_destroy: false,
        user_data_index: None,
        scope: Default::default(),
    }
}

#[test]
fn type_display_renders_every_variant() {
    assert_eq!(Type::Integer(IntegerKind::I32).to_string(), "Integer(I32)");
    assert_eq!(Type::BigInt(BigIntKind::I64).to_string(), "BigInt(I64)");
    assert_eq!(Type::Float(FloatKind::F64).to_string(), "Float(F64)");
    assert_eq!(
        Type::Tagged(common::enum_tagged()).to_string(),
        "Enum(gtk_orientation_get_type)"
    );
    assert_eq!(
        Type::Tagged(common::flags_tagged()).to_string(),
        "Flags(gtk_state_flags_get_type)"
    );
    assert_eq!(Type::String(string_type()).to_string(), "String");
    assert_eq!(Type::Void(VoidType).to_string(), "Void");
    assert_eq!(Type::Boolean(BooleanType).to_string(), "Boolean");
    assert_eq!(Type::GObject(gobject_type()).to_string(), "GObject");
    assert_eq!(Type::Boxed(boxed_type()).to_string(), "Boxed(GdkRGBA)");
    assert_eq!(Type::Struct(struct_type()).to_string(), "Struct(borrowed)");
    assert_eq!(
        Type::Fundamental(fundamental_type()).to_string(),
        "Fundamental(g_object_unref)"
    );
    assert_eq!(Type::Array(array_type()).to_string(), "Array");
    assert_eq!(Type::Blob(BlobType).to_string(), "Blob");
    assert_eq!(Type::HashTable(hashtable_type()).to_string(), "HashTable");
    assert_eq!(
        Type::Trampoline(trampoline_type()).to_string(),
        "Trampoline"
    );
    assert_eq!(Type::Unichar(UnicharType).to_string(), "Unichar");

    let ref_type = RefType::new(Type::Integer(IntegerKind::I32));
    assert_eq!(Type::Ref(ref_type).to_string(), "Ref(Integer(I32))");
}

#[test]
fn can_be_return_type_accepts_value_shapes_and_rejects_argument_shapes() {
    assert!(Type::Integer(IntegerKind::I32).can_be_return_type());
    assert!(Type::Void(VoidType).can_be_return_type());
    assert!(Type::GObject(gobject_type()).can_be_return_type());
    assert!(Type::Tagged(common::enum_tagged()).can_be_return_type());

    assert!(!Type::Trampoline(trampoline_type()).can_be_return_type());
    assert!(!Type::Blob(BlobType).can_be_return_type());
    let ref_type = RefType::new(Type::Integer(IntegerKind::I32));
    assert!(!Type::Ref(ref_type).can_be_return_type());
}

#[test]
fn ffi_decoder_decode_default_bails() {
    assert!(FfiDecoder::decode(&trampoline_type(), &ffi::FfiValue::Void).is_err());
}

#[test]
fn ffi_decoder_decode_with_context_default_delegates_to_decode() {
    let result =
        FfiDecoder::decode_with_context(&trampoline_type(), &ffi::FfiValue::Void, &[], &[]);
    assert!(result.is_err());
}

#[test]
fn raw_ptr_codec_ptr_to_value_default_bails() {
    assert!(
        // SAFETY: The default implementation bails before any read.
        unsafe { RawPtrCodec::ptr_to_value(&trampoline_type(), 8 as *mut c_void, "ctx") }.is_err()
    );
}

#[test]
fn raw_ptr_codec_read_from_raw_ptr_default_dereferences_then_bails() {
    let mut inner: *mut c_void = 8 as *mut c_void;
    let ptr = &mut inner as *mut *mut c_void as *const c_void;
    // SAFETY: `ptr` addresses a live local pointer-sized slot.
    assert!(unsafe { RawPtrCodec::read_from_raw_ptr(&trampoline_type(), ptr, "ctx") }.is_err());
}

#[test]
fn raw_ptr_codec_write_return_to_raw_ptr_default_writes_null() {
    let mut slot: *mut c_void = 9 as *mut c_void;
    let ret = &mut slot as *mut *mut c_void as *mut c_void;
    // SAFETY: `ret` addresses a writable local pointer-sized slot.
    unsafe {
        RawPtrCodec::write_return_to_raw_ptr(&trampoline_type(), ret, &Ok(Value::Number(1.0)));
    }
    assert!(slot.is_null());

    slot = 9 as *mut c_void;
    // SAFETY: `ret` addresses a writable local pointer-sized slot.
    unsafe { RawPtrCodec::write_return_to_raw_ptr(&trampoline_type(), ret, &Err(())) };
    assert!(slot.is_null());
}

#[test]
fn raw_ptr_codec_write_value_to_raw_ptr_default_bails() {
    let mut slot: *mut c_void = std::ptr::null_mut();
    let ptr = &mut slot as *mut *mut c_void as *mut c_void;
    assert!(
        // SAFETY: The default implementation bails before any write.
        unsafe {
            RawPtrCodec::write_value_to_raw_ptr(&trampoline_type(), ptr, &Value::Number(1.0))
        }
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

    // SAFETY: The default implementation returns the pointer untouched.
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
    let encoded = FfiEncoder::encode(&ty, &value::Value::Boolean(true), false).unwrap();
    assert!(matches!(encoded, ffi::FfiValue::I32(1)));
    let decoded = FfiDecoder::decode(&ty, &ffi::FfiValue::I32(0)).unwrap();
    assert!(matches!(decoded, value::Value::Boolean(false)));
}

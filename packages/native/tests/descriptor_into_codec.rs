use native::ffi::codec::{
    ArrayKind, BigIntCodec, Codec, DestroyNotifyKind, FloatCodec, IntegerCodec, Ownership,
};
use native::ffi::descriptor::{Descriptor, Descriptors, NestedDescriptor};

fn nested(descriptor: Descriptor) -> NestedDescriptor {
    NestedDescriptor(Box::new(descriptor))
}

fn codec(descriptor: Descriptor) -> Codec {
    descriptor
        .into_codec()
        .expect("descriptor should convert into a codec")
}

#[test]
fn scalar_integer_descriptors_map_to_integer_codecs() {
    assert!(matches!(
        codec(Descriptor::Int8),
        Codec::Integer(IntegerCodec::I8)
    ));
    assert!(matches!(
        codec(Descriptor::Uint8),
        Codec::Integer(IntegerCodec::U8)
    ));
    assert!(matches!(
        codec(Descriptor::Int16),
        Codec::Integer(IntegerCodec::I16)
    ));
    assert!(matches!(
        codec(Descriptor::Uint16),
        Codec::Integer(IntegerCodec::U16)
    ));
    assert!(matches!(
        codec(Descriptor::Int32),
        Codec::Integer(IntegerCodec::I32)
    ));
    assert!(matches!(
        codec(Descriptor::Uint32),
        Codec::Integer(IntegerCodec::U32)
    ));
    assert!(matches!(
        codec(Descriptor::Int64),
        Codec::Integer(IntegerCodec::I64)
    ));
    assert!(matches!(
        codec(Descriptor::Uint64),
        Codec::Integer(IntegerCodec::U64)
    ));
}

#[test]
fn bigint_and_float_descriptors_map_to_their_codecs() {
    assert!(matches!(
        codec(Descriptor::Bigint64),
        Codec::BigInt(BigIntCodec::I64)
    ));
    assert!(matches!(
        codec(Descriptor::Biguint64),
        Codec::BigInt(BigIntCodec::U64)
    ));
    assert!(matches!(
        codec(Descriptor::Float32),
        Codec::Float(FloatCodec::F32)
    ));
    assert!(matches!(
        codec(Descriptor::Float64),
        Codec::Float(FloatCodec::F64)
    ));
}

#[test]
fn simple_unit_descriptors_map_to_their_codecs() {
    assert!(matches!(codec(Descriptor::Boolean), Codec::Boolean(_)));
    assert!(matches!(codec(Descriptor::Unichar), Codec::Unichar(_)));
    assert!(matches!(codec(Descriptor::Void), Codec::Void(_)));
    assert!(matches!(codec(Descriptor::Buffer), Codec::Buffer(_)));
}

#[test]
fn enum_and_flags_descriptors_pick_integer_storage_by_sign() {
    let signed_enum = Descriptor::Enum {
        shared_library: "libgtk-4.so.1".to_owned(),
        get_type_fn_name: "gtk_orientation_get_type".to_owned(),
        is_signed: true,
    };
    assert!(matches!(codec(signed_enum), Codec::EnumFlags(_)));

    let unsigned_flags = Descriptor::Flags {
        shared_library: "libgtk-4.so.1".to_owned(),
        get_type_fn_name: "gtk_state_flags_get_type".to_owned(),
        is_signed: false,
    };
    assert!(matches!(codec(unsigned_flags), Codec::EnumFlags(_)));
}

#[test]
fn string_object_boxed_struct_and_fundamental_descriptors_map_to_their_codecs() {
    let string = Descriptor::String {
        ownership: Ownership::Full,
        length: Some(4),
    };
    assert!(matches!(codec(string), Codec::String(_)));

    let object = Descriptor::Object {
        ownership: Ownership::Borrowed,
        is_call_scoped: None,
    };
    assert!(matches!(codec(object), Codec::Object(_)));

    let boxed = Descriptor::Boxed {
        ownership: Ownership::Full,
        type_name: "GdkRGBA".to_owned(),
        shared_library: None,
        get_type_fn_name: None,
        free_fn_name: None,
        is_caller_allocated: Some(true),
        size: Some(16),
        is_inline: None,
    };
    assert!(matches!(codec(boxed), Codec::Boxed(_)));

    let struct_ = Descriptor::Struct {
        ownership: Ownership::Borrowed,
        size: Some(8),
        is_caller_allocated: None,
        is_inline: None,
    };
    assert!(matches!(codec(struct_), Codec::Struct(_)));

    let fundamental = Descriptor::Fundamental {
        ownership: Ownership::Full,
        shared_library: "libgobject-2.0.so.0".to_owned(),
        ref_fn_name: "g_param_spec_ref".to_owned(),
        unref_fn_name: "g_param_spec_unref".to_owned(),
        is_inline: None,
        type_name: None,
    };
    assert!(matches!(codec(fundamental), Codec::Fundamental(_)));
}

#[test]
fn array_descriptor_recurses_into_its_item_codec() {
    let array = Descriptor::Array {
        item_descriptor: nested(Descriptor::Int32),
        array_kind: ArrayKind::Fixed,
        ownership: Ownership::Borrowed,
        base_param_index: None,
        size_param_index: None,
        fixed_size: Some(3),
        element_size: None,
        is_bytes: None,
    };
    assert!(matches!(codec(array), Codec::Array(_)));
}

#[test]
fn hashtable_descriptor_recurses_into_key_and_value_codecs() {
    let hashtable = Descriptor::Hashtable {
        key_descriptor: nested(Descriptor::String {
            ownership: Ownership::Full,
            length: None,
        }),
        value_descriptor: nested(Descriptor::Int32),
        ownership: Ownership::Borrowed,
    };
    assert!(matches!(codec(hashtable), Codec::HashTable(_)));
}

fn callback_descriptor(destroy_kind: Option<DestroyNotifyKind>) -> Descriptor {
    Descriptor::Callback {
        arg_descriptors: Descriptors(vec![Descriptor::Int32, Descriptor::Boolean]),
        return_descriptor: nested(Descriptor::Void),
        has_destroy: Some(true),
        destroy_kind,
        has_user_data: Some(true),
        user_data_index: Some(1),
        scope: None,
    }
}

fn destroy_kind_for(descriptor: Descriptor) -> DestroyNotifyKind {
    let Codec::Callback(callback) = codec(descriptor) else {
        panic!("a callback descriptor should convert into a callback codec");
    };

    callback.destroy_kind
}

#[test]
fn callback_descriptor_recurses_into_argument_and_return_codecs() {
    assert!(matches!(
        codec(callback_descriptor(None)),
        Codec::Callback(_)
    ));
}

#[test]
fn a_callback_descriptor_without_a_destroy_kind_asks_for_a_destroy_notify() {
    assert_eq!(
        destroy_kind_for(callback_descriptor(None)),
        DestroyNotifyKind::DestroyNotify
    );
}

#[test]
fn a_callback_descriptor_carries_its_destroy_kind_into_the_codec() {
    assert_eq!(
        destroy_kind_for(callback_descriptor(Some(DestroyNotifyKind::ClosureNotify))),
        DestroyNotifyKind::ClosureNotify
    );
    assert_eq!(
        destroy_kind_for(callback_descriptor(Some(DestroyNotifyKind::DestroyNotify))),
        DestroyNotifyKind::DestroyNotify
    );
}

#[test]
fn ref_descriptor_wraps_its_inner_codec() {
    let ref_ = Descriptor::Ref {
        inner_descriptor: nested(Descriptor::Int32),
        inout: Some(true),
    };
    assert!(matches!(codec(ref_), Codec::Ref(_)));
}

#[test]
fn array_descriptor_propagates_codec_construction_errors() {
    let invalid = Descriptor::Array {
        item_descriptor: nested(Descriptor::Int32),
        array_kind: ArrayKind::Fixed,
        ownership: Ownership::Borrowed,
        base_param_index: None,
        size_param_index: None,
        fixed_size: None,
        element_size: None,
        is_bytes: None,
    };
    assert!(invalid.into_codec().is_err());
}

#[test]
fn a_negative_string_length_is_rejected() {
    let descriptor = Descriptor::String {
        ownership: Ownership::Borrowed,
        length: Some(-1),
    };
    let error = descriptor
        .into_codec()
        .expect_err("a negative buffer length must not wrap around");
    assert!(error.reason.contains("must not be negative"));
}

//! Coverage for [`BufferView`]/[`BufferViewKind`] and the zero-copy
//! `ArrayBufferView` fast path in `ArrayType`'s encoder.

use std::ffi::c_void;

use napi::sys::TypedarrayType;
use native::ffi::FfiValue;
use native::types::{
    ArrayKind, ArrayType, BooleanType, FloatKind, IntegerKind, Ownership, StringType, StructType,
    TaggedKind, TaggedType, Type,
};
use native::value::{BufferView, BufferViewKind, Value};

fn array_of(item: Type, kind: ArrayKind, ownership: Ownership) -> ArrayType {
    ArrayType {
        item_type: Box::new(item),
        kind,
        ownership,
        element_size: None,
    }
}

fn view_over(data: &mut [u8], length: usize, kind: BufferViewKind) -> BufferView {
    BufferView::new(
        data.as_mut_ptr() as *mut c_void,
        data.len(),
        length,
        kind,
        false,
    )
}

fn encode_view(
    item: Type,
    kind: ArrayKind,
    ownership: Ownership,
    view: BufferView,
) -> anyhow::Result<FfiValue> {
    array_of(item, kind, ownership).encode(&Value::BufferView(view), false)
}

fn assert_passthrough(item: Type, view_kind: BufferViewKind) {
    let mut data = vec![0u8; 4 * view_kind.element_size()];
    let expected_ptr = data.as_mut_ptr() as *mut c_void;
    let view = view_over(&mut data, 4, view_kind);
    let encoded = encode_view(item, ArrayKind::Array, Ownership::Borrowed, view)
        .expect("matching view should encode");
    let FfiValue::Ptr(ptr) = encoded else {
        panic!("expected a pointer passthrough, got {encoded:?}");
    };
    assert_eq!(ptr, expected_ptr);
}

fn assert_rejected(item: Type, view_kind: BufferViewKind, expected_message: &str) {
    let mut data = vec![0u8; 4 * view_kind.element_size()];
    let view = view_over(&mut data, 4, view_kind);
    let err = encode_view(item, ArrayKind::Array, Ownership::Borrowed, view)
        .expect_err("mismatched view should fail to encode");
    assert!(
        err.to_string().contains(expected_message),
        "unexpected error: {err}"
    );
}

#[test]
fn buffer_view_kind_resolves_every_napi_tag() {
    let expectations = [
        (TypedarrayType::int8_array, BufferViewKind::Int8),
        (TypedarrayType::uint8_array, BufferViewKind::Uint8),
        (
            TypedarrayType::uint8_clamped_array,
            BufferViewKind::Uint8Clamped,
        ),
        (TypedarrayType::int16_array, BufferViewKind::Int16),
        (TypedarrayType::uint16_array, BufferViewKind::Uint16),
        (TypedarrayType::int32_array, BufferViewKind::Int32),
        (TypedarrayType::uint32_array, BufferViewKind::Uint32),
        (TypedarrayType::float32_array, BufferViewKind::Float32),
        (TypedarrayType::float64_array, BufferViewKind::Float64),
        (TypedarrayType::bigint64_array, BufferViewKind::BigInt64),
        (TypedarrayType::biguint64_array, BufferViewKind::BigUint64),
    ];
    for (tag, kind) in expectations {
        assert_eq!(
            BufferViewKind::from_napi_typedarray_type(tag).unwrap(),
            kind
        );
    }
}

#[test]
fn buffer_view_kind_rejects_unknown_napi_tags() {
    let err = BufferViewKind::from_napi_typedarray_type(99).expect_err("unknown tag must fail");
    assert!(err.reason.contains("99"));
}

#[test]
fn buffer_view_kind_element_sizes() {
    assert_eq!(BufferViewKind::Int8.element_size(), 1);
    assert_eq!(BufferViewKind::Uint8.element_size(), 1);
    assert_eq!(BufferViewKind::Uint8Clamped.element_size(), 1);
    assert_eq!(BufferViewKind::DataView.element_size(), 1);
    assert_eq!(BufferViewKind::Int16.element_size(), 2);
    assert_eq!(BufferViewKind::Uint16.element_size(), 2);
    assert_eq!(BufferViewKind::Int32.element_size(), 4);
    assert_eq!(BufferViewKind::Uint32.element_size(), 4);
    assert_eq!(BufferViewKind::Float32.element_size(), 4);
    assert_eq!(BufferViewKind::Float64.element_size(), 8);
    assert_eq!(BufferViewKind::BigInt64.element_size(), 8);
    assert_eq!(BufferViewKind::BigUint64.element_size(), 8);
}

#[test]
fn buffer_view_kind_displays_javascript_class_names() {
    assert_eq!(BufferViewKind::Int8.to_string(), "Int8Array");
    assert_eq!(BufferViewKind::Uint8.to_string(), "Uint8Array");
    assert_eq!(
        BufferViewKind::Uint8Clamped.to_string(),
        "Uint8ClampedArray"
    );
    assert_eq!(BufferViewKind::Int16.to_string(), "Int16Array");
    assert_eq!(BufferViewKind::Uint16.to_string(), "Uint16Array");
    assert_eq!(BufferViewKind::Int32.to_string(), "Int32Array");
    assert_eq!(BufferViewKind::Uint32.to_string(), "Uint32Array");
    assert_eq!(BufferViewKind::Float32.to_string(), "Float32Array");
    assert_eq!(BufferViewKind::Float64.to_string(), "Float64Array");
    assert_eq!(BufferViewKind::BigInt64.to_string(), "BigInt64Array");
    assert_eq!(BufferViewKind::BigUint64.to_string(), "BigUint64Array");
    assert_eq!(BufferViewKind::DataView.to_string(), "DataView");
}

#[test]
fn buffer_view_exposes_its_fields() {
    let mut data = vec![0u8; 8];
    let view = BufferView::new(
        data.as_mut_ptr() as *mut c_void,
        8,
        2,
        BufferViewKind::Float32,
        true,
    );
    assert_eq!(view.ptr(), data.as_mut_ptr() as *mut c_void);
    assert_eq!(view.byte_length(), 8);
    assert_eq!(view.length(), 2);
    assert_eq!(view.kind(), BufferViewKind::Float32);
    assert!(view.is_shared());
}

#[test]
fn value_buffer_view_is_not_an_object_or_number() {
    let mut data = vec![0u8; 4];
    let view = view_over(&mut data, 4, BufferViewKind::Uint8);
    assert!(Value::BufferView(view).object_ptr("GObject").is_err());
    assert_eq!(Value::BufferView(view).as_number(), None);
}

#[test]
fn array_encode_accepts_every_matching_view_kind() {
    assert_passthrough(Type::Integer(IntegerKind::I8), BufferViewKind::Int8);
    assert_passthrough(Type::Integer(IntegerKind::U8), BufferViewKind::Uint8);
    assert_passthrough(Type::Integer(IntegerKind::U8), BufferViewKind::Uint8Clamped);
    assert_passthrough(Type::Integer(IntegerKind::I16), BufferViewKind::Int16);
    assert_passthrough(Type::Integer(IntegerKind::U16), BufferViewKind::Uint16);
    assert_passthrough(Type::Integer(IntegerKind::I32), BufferViewKind::Int32);
    assert_passthrough(Type::Integer(IntegerKind::U32), BufferViewKind::Uint32);
    assert_passthrough(Type::Integer(IntegerKind::I64), BufferViewKind::BigInt64);
    assert_passthrough(Type::Integer(IntegerKind::U64), BufferViewKind::BigUint64);
    assert_passthrough(Type::Float(FloatKind::F32), BufferViewKind::Float32);
    assert_passthrough(Type::Float(FloatKind::F64), BufferViewKind::Float64);
}

#[test]
fn array_encode_accepts_views_for_tagged_storage() {
    let tagged = TaggedType {
        kind: TaggedKind::Enum,
        library: "libgtk-4.so.1".to_owned(),
        get_type_fn: "gtk_orientation_get_type".to_owned(),
        storage: IntegerKind::I32,
    };
    assert_passthrough(Type::Tagged(tagged), BufferViewKind::Int32);
}

#[test]
fn array_encode_rejects_mismatched_view_kinds() {
    assert_rejected(
        Type::Integer(IntegerKind::I32),
        BufferViewKind::Float32,
        "A Float32Array cannot supply Integer(I32) array elements",
    );
    assert_rejected(
        Type::Float(FloatKind::F32),
        BufferViewKind::Float64,
        "Float64Array",
    );
    assert_rejected(
        Type::Float(FloatKind::F64),
        BufferViewKind::Float32,
        "Float32Array",
    );
    assert_rejected(
        Type::Integer(IntegerKind::I32),
        BufferViewKind::DataView,
        "DataView",
    );
}

#[test]
fn array_encode_rejects_views_for_non_scalar_items() {
    assert_rejected(
        Type::Boolean(BooleanType),
        BufferViewKind::Int32,
        "cannot supply",
    );
    assert_rejected(
        Type::String(StringType {
            ownership: Ownership::Borrowed,
            length: None,
        }),
        BufferViewKind::Uint8,
        "cannot supply",
    );
    assert_rejected(
        Type::Struct(StructType {
            ownership: Ownership::Borrowed,
            size: Some(8),
        }),
        BufferViewKind::Uint8,
        "cannot supply",
    );
}

#[test]
fn array_encode_rejects_shared_views() {
    let mut data = vec![0u8; 4];
    let view = BufferView::new(
        data.as_mut_ptr() as *mut c_void,
        4,
        4,
        BufferViewKind::Uint8,
        true,
    );
    let err = encode_view(
        Type::Integer(IntegerKind::U8),
        ArrayKind::Array,
        Ownership::Borrowed,
        view,
    )
    .expect_err("shared views must fail to encode");
    assert!(err.to_string().contains("SharedArrayBuffer"));
}

#[test]
fn array_encode_rejects_views_for_transfer_full_arrays() {
    let mut data = vec![0u8; 4];
    let view = view_over(&mut data, 4, BufferViewKind::Uint8);
    let err = encode_view(
        Type::Integer(IntegerKind::U8),
        ArrayKind::Array,
        Ownership::Full,
        view,
    )
    .expect_err("transfer-full arrays must fail to encode");
    assert!(err.to_string().contains("transfer-full"));
}

#[test]
fn array_encode_rejects_views_for_glib_containers() {
    let container_kinds = [
        ArrayKind::GList,
        ArrayKind::GSList,
        ArrayKind::GPtrArray,
        ArrayKind::GArray,
        ArrayKind::GByteArray,
    ];
    for kind in container_kinds {
        let mut data = vec![0u8; 4];
        let view = view_over(&mut data, 4, BufferViewKind::Uint8);
        let err = encode_view(
            Type::Integer(IntegerKind::U8),
            kind,
            Ownership::Borrowed,
            view,
        )
        .expect_err("container kinds must fail to encode");
        assert!(
            err.to_string().contains("only contiguous arrays"),
            "unexpected error: {err}"
        );
    }
}

#[test]
fn array_encode_accepts_views_for_sized_arrays() {
    let mut data = vec![0u8; 16];
    let expected_ptr = data.as_mut_ptr() as *mut c_void;
    let view = view_over(&mut data, 4, BufferViewKind::Int32);
    let encoded = encode_view(
        Type::Integer(IntegerKind::I32),
        ArrayKind::Sized { size_index: 1 },
        Ownership::Borrowed,
        view,
    )
    .expect("sized arrays should accept views");
    assert!(matches!(encoded, FfiValue::Ptr(ptr) if ptr == expected_ptr));
}

#[test]
fn array_encode_checks_fixed_size_views_exactly() {
    let mut data = vec![0u8; 16];
    let expected_ptr = data.as_mut_ptr() as *mut c_void;
    let view = view_over(&mut data, 4, BufferViewKind::Int32);
    let encoded = encode_view(
        Type::Integer(IntegerKind::I32),
        ArrayKind::Fixed { size: 4 },
        Ownership::Borrowed,
        view,
    )
    .expect("a fixed-size match should encode");
    assert!(matches!(encoded, FfiValue::Ptr(ptr) if ptr == expected_ptr));

    let mut short = vec![0u8; 8];
    let short_view = view_over(&mut short, 2, BufferViewKind::Int32);
    let err = encode_view(
        Type::Integer(IntegerKind::I32),
        ArrayKind::Fixed { size: 4 },
        Ownership::Borrowed,
        short_view,
    )
    .expect_err("a fixed-size mismatch must fail");
    assert!(err.to_string().contains("exactly 4 elements"));
}

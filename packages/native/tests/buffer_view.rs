use std::ffi::c_void;

use napi::sys::TypedarrayType;
use native::ffi::Stash;
use native::ffi::codec::{
    ArrayCodec, ArrayKind, BigIntCodec, BooleanCodec, Codec, Encoder as _, EnumFlagsCodec,
    EnumFlagsKind, FloatCodec, IntegerCodec, Ownership,
};
use native::ffi::value::{BufferView, BufferViewKind, Value};

fn array_of(item: Codec, kind: ArrayKind, ownership: Ownership) -> ArrayCodec {
    ArrayCodec::new(Box::new(item), kind, ownership, None, None, None).expect("valid array codec")
}

fn sized_array_of(item: Codec, size_index: u32, ownership: Ownership) -> ArrayCodec {
    ArrayCodec::new(
        Box::new(item),
        ArrayKind::Sized,
        ownership,
        Some(size_index),
        None,
        None,
    )
    .expect("valid sized array codec")
}

fn fixed_array_of(item: Codec, size: u32, ownership: Ownership) -> ArrayCodec {
    ArrayCodec::new(
        Box::new(item),
        ArrayKind::Fixed,
        ownership,
        None,
        Some(size),
        None,
    )
    .expect("valid fixed array codec")
}

fn view_over(data: &mut [u8], length: usize, kind: BufferViewKind) -> BufferView {
    BufferView::new(data.as_mut_ptr() as *mut c_void, data.len(), length, kind)
}

fn encode_view(codec: ArrayCodec, view: BufferView) -> anyhow::Result<Stash> {
    codec.encode(&Value::BufferView(view))
}

fn assert_passthrough(item: Codec, view_kind: BufferViewKind) {
    let mut data = vec![0u8; 4 * view_kind.element_size()];
    let expected_ptr = data.as_mut_ptr() as *mut c_void;
    let view = view_over(&mut data, 4, view_kind);
    let encoded = encode_view(array_of(item, ArrayKind::Array, Ownership::Borrowed), view)
        .expect("matching view should encode");
    let Stash::Ptr(ptr) = encoded else {
        panic!("expected a pointer passthrough, got {encoded:?}");
    };
    assert_eq!(ptr, expected_ptr);
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
        assert_eq!(BufferViewKind::try_from(tag).unwrap(), kind);
    }
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
fn buffer_view_exposes_its_fields() {
    let mut data = vec![0u8; 8];
    let view = BufferView::new(
        data.as_mut_ptr() as *mut c_void,
        8,
        2,
        BufferViewKind::Float32,
    );
    assert_eq!(view.ptr(), data.as_mut_ptr() as *mut c_void);
    assert_eq!(view.byte_length(), 8);
    assert_eq!(view.length(), 2);
    assert_eq!(view.kind(), BufferViewKind::Float32);
}

#[test]
fn value_buffer_view_is_not_an_object() {
    let mut data = vec![0u8; 4];
    let view = view_over(&mut data, 4, BufferViewKind::Uint8);
    assert!(Value::BufferView(view).object_ptr("GObject").is_err());
}

#[test]
fn array_encode_accepts_every_matching_view_kind() {
    assert_passthrough(Codec::Integer(IntegerCodec::I8), BufferViewKind::Int8);
    assert_passthrough(Codec::Integer(IntegerCodec::U8), BufferViewKind::Uint8);
    assert_passthrough(
        Codec::Integer(IntegerCodec::U8),
        BufferViewKind::Uint8Clamped,
    );
    assert_passthrough(Codec::Integer(IntegerCodec::I16), BufferViewKind::Int16);
    assert_passthrough(Codec::Integer(IntegerCodec::U16), BufferViewKind::Uint16);
    assert_passthrough(Codec::Integer(IntegerCodec::I32), BufferViewKind::Int32);
    assert_passthrough(Codec::Integer(IntegerCodec::U32), BufferViewKind::Uint32);
    assert_passthrough(Codec::Integer(IntegerCodec::I64), BufferViewKind::BigInt64);
    assert_passthrough(Codec::Integer(IntegerCodec::U64), BufferViewKind::BigUint64);
    assert_passthrough(Codec::BigInt(BigIntCodec::I64), BufferViewKind::BigInt64);
    assert_passthrough(Codec::BigInt(BigIntCodec::U64), BufferViewKind::BigUint64);
    assert_passthrough(Codec::Float(FloatCodec::F32), BufferViewKind::Float32);
    assert_passthrough(Codec::Float(FloatCodec::F64), BufferViewKind::Float64);
}

fn assert_view_rejected(item: Codec, view_kind: BufferViewKind) {
    let mut data = vec![0u8; 4 * view_kind.element_size()];
    let view = view_over(&mut data, 4, view_kind);
    let err = encode_view(array_of(item, ArrayKind::Array, Ownership::Borrowed), view)
        .expect_err("a mismatched view must fail to supply array elements");
    assert!(err.to_string().contains("cannot supply"));
}

#[test]
fn array_encode_rejects_mismatched_bigint_view() {
    assert_view_rejected(Codec::BigInt(BigIntCodec::U64), BufferViewKind::BigInt64);
}

#[test]
fn array_encode_rejects_views_for_non_buffer_element_kinds() {
    assert_view_rejected(Codec::Boolean(BooleanCodec), BufferViewKind::Uint8);
}

#[test]
fn array_encode_accepts_views_for_enum_flags_storage() {
    let enum_flags = EnumFlagsCodec {
        kind: EnumFlagsKind::Enum,
        shared_library: "libgtk-4.so.1".to_owned(),
        get_type_fn_name: "gtk_orientation_get_type".to_owned(),
        storage: IntegerCodec::I32,
    };
    assert_passthrough(Codec::EnumFlags(enum_flags), BufferViewKind::Int32);
}

#[test]
fn array_encode_rejects_views_for_transfer_full_arrays() {
    let mut data = vec![0u8; 4];
    let view = view_over(&mut data, 4, BufferViewKind::Uint8);
    let err = encode_view(
        array_of(
            Codec::Integer(IntegerCodec::U8),
            ArrayKind::Array,
            Ownership::Full,
        ),
        view,
    )
    .expect_err("transfer-full arrays must fail to encode");
    assert!(err.to_string().contains("transfer-full"));
}

fn assert_int32_view_passes_through(codec: ArrayCodec, context: &str) {
    let mut data = vec![0u8; 16];
    let expected_ptr = data.as_mut_ptr() as *mut c_void;
    let view = view_over(&mut data, 4, BufferViewKind::Int32);
    let encoded = encode_view(codec, view).expect(context);
    assert!(matches!(encoded, Stash::Ptr(ptr) if ptr == expected_ptr));
}

#[test]
fn array_encode_accepts_views_for_sized_arrays() {
    assert_int32_view_passes_through(
        sized_array_of(Codec::Integer(IntegerCodec::I32), 1, Ownership::Borrowed),
        "sized arrays should accept views",
    );
}

#[test]
fn array_encode_checks_fixed_size_views_exactly() {
    assert_int32_view_passes_through(
        fixed_array_of(Codec::Integer(IntegerCodec::I32), 4, Ownership::Borrowed),
        "a fixed-size match should encode",
    );

    let mut short = vec![0u8; 8];
    let short_view = view_over(&mut short, 2, BufferViewKind::Int32);
    let err = encode_view(
        fixed_array_of(Codec::Integer(IntegerCodec::I32), 4, Ownership::Borrowed),
        short_view,
    )
    .expect_err("a fixed-size mismatch must fail");
    assert!(err.to_string().contains("exactly 4 elements"));
}

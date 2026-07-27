use std::ffi::c_void;

use napi::Env;
use napi::bindgen_prelude::Unknown;
use napi::sys::{TypedarrayType, napi_typedarray_type};
use native::ffi::Stash;
use native::ffi::codec::{
    ArrayCodec, ArrayKind, BigIntCodec, BooleanCodec, Codec, Encoder as _, EnumFlagsCodec,
    EnumFlagsKind, FloatCodec, IntegerCodec, Ownership,
};
use native::value::{TypedView, ViewKind};

use test_support as helpers;

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

fn napi_tag(kind: ViewKind) -> napi_typedarray_type {
    match kind {
        ViewKind::Int8 => TypedarrayType::int8_array,
        ViewKind::Uint8 => TypedarrayType::uint8_array,
        ViewKind::Uint8Clamped => TypedarrayType::uint8_clamped_array,
        ViewKind::Int16 => TypedarrayType::int16_array,
        ViewKind::Uint16 => TypedarrayType::uint16_array,
        ViewKind::Int32 => TypedarrayType::int32_array,
        ViewKind::Uint32 => TypedarrayType::uint32_array,
        ViewKind::Float32 => TypedarrayType::float32_array,
        ViewKind::Float64 => TypedarrayType::float64_array,
        ViewKind::BigInt64 => TypedarrayType::bigint64_array,
        ViewKind::BigUint64 => TypedarrayType::biguint64_array,
        ViewKind::DataView => unreachable!("DataView is not built as a typed array in these tests"),
    }
}

fn view_over<'e>(env: &'e Env, data: &mut [u8], length: usize, kind: ViewKind) -> Unknown<'e> {
    helpers::napi_mock::to_unknown(
        env,
        helpers::napi_mock::fake_typed_array(
            napi_tag(kind),
            data.as_mut_ptr().cast::<c_void>(),
            length,
            0,
        ),
    )
}

fn encode_view(codec: &ArrayCodec, env: Env, view: Unknown<'_>) -> anyhow::Result<Stash> {
    codec.encode(&env, view)
}

fn with_view<F>(bytes: usize, length: usize, kind: ViewKind, body: F)
where
    F: FnOnce(&Env, Unknown<'_>),
{
    helpers::run(|| {
        let env = helpers::fake_env();
        let mut data = vec![0u8; bytes];
        let view = view_over(&env, &mut data, length, kind);
        body(&env, view);
    });
}

fn assert_passthrough(item: Codec, view_kind: ViewKind) {
    helpers::run(|| {
        let env = helpers::fake_env();
        let mut data = vec![0u8; 4 * view_kind.element_size()];
        let expected_ptr = data.as_mut_ptr().cast::<c_void>();
        let view = view_over(&env, &mut data, 4, view_kind);
        let encoded = encode_view(
            &array_of(item, ArrayKind::Array, Ownership::Borrowed),
            env,
            view,
        )
        .expect("matching view should encode");
        let Stash::Ptr(ptr) = encoded else {
            panic!("expected a pointer passthrough, got {encoded:?}");
        };
        assert_eq!(ptr, expected_ptr);
    });
}

#[test]
fn buffer_view_kind_resolves_every_napi_tag() {
    let expectations = [
        (TypedarrayType::int8_array, ViewKind::Int8),
        (TypedarrayType::uint8_array, ViewKind::Uint8),
        (TypedarrayType::uint8_clamped_array, ViewKind::Uint8Clamped),
        (TypedarrayType::int16_array, ViewKind::Int16),
        (TypedarrayType::uint16_array, ViewKind::Uint16),
        (TypedarrayType::int32_array, ViewKind::Int32),
        (TypedarrayType::uint32_array, ViewKind::Uint32),
        (TypedarrayType::float32_array, ViewKind::Float32),
        (TypedarrayType::float64_array, ViewKind::Float64),
        (TypedarrayType::bigint64_array, ViewKind::BigInt64),
        (TypedarrayType::biguint64_array, ViewKind::BigUint64),
    ];
    for (tag, kind) in expectations {
        assert_eq!(ViewKind::try_from(tag).unwrap(), kind);
    }
}

#[test]
fn buffer_view_kind_element_sizes() {
    assert_eq!(ViewKind::Int8.element_size(), 1);
    assert_eq!(ViewKind::Uint8.element_size(), 1);
    assert_eq!(ViewKind::Uint8Clamped.element_size(), 1);
    assert_eq!(ViewKind::DataView.element_size(), 1);
    assert_eq!(ViewKind::Int16.element_size(), 2);
    assert_eq!(ViewKind::Uint16.element_size(), 2);
    assert_eq!(ViewKind::Int32.element_size(), 4);
    assert_eq!(ViewKind::Uint32.element_size(), 4);
    assert_eq!(ViewKind::Float32.element_size(), 4);
    assert_eq!(ViewKind::Float64.element_size(), 8);
    assert_eq!(ViewKind::BigInt64.element_size(), 8);
    assert_eq!(ViewKind::BigUint64.element_size(), 8);
}

#[test]
fn buffer_view_exposes_its_fields() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let mut data = vec![0u8; 8];
        let expected_ptr = data.as_mut_ptr().cast::<c_void>();
        let value = view_over(&env, &mut data, 2, ViewKind::Float32);
        let view = TypedView::from_unknown(&env, value)
            .expect("typed-array info should be readable")
            .expect("value should be recognized as a view");
        assert_eq!(view.ptr(), expected_ptr);
        assert_eq!(view.byte_length(), 8);
        assert_eq!(view.length(), 2);
        assert_eq!(view.kind(), ViewKind::Float32);
    });
}

#[test]
fn value_buffer_view_is_not_an_object() {
    with_view(4, 4, ViewKind::Uint8, |_env, view| {
        assert!(native::value::handle_ptr(view, "GObject").is_err());
    });
}

#[test]
fn array_encode_accepts_every_matching_view_kind() {
    assert_passthrough(Codec::Integer(IntegerCodec::I8), ViewKind::Int8);
    assert_passthrough(Codec::Integer(IntegerCodec::U8), ViewKind::Uint8);
    assert_passthrough(Codec::Integer(IntegerCodec::U8), ViewKind::Uint8Clamped);
    assert_passthrough(Codec::Integer(IntegerCodec::I16), ViewKind::Int16);
    assert_passthrough(Codec::Integer(IntegerCodec::U16), ViewKind::Uint16);
    assert_passthrough(Codec::Integer(IntegerCodec::I32), ViewKind::Int32);
    assert_passthrough(Codec::Integer(IntegerCodec::U32), ViewKind::Uint32);
    assert_passthrough(Codec::Integer(IntegerCodec::I64), ViewKind::BigInt64);
    assert_passthrough(Codec::Integer(IntegerCodec::U64), ViewKind::BigUint64);
    assert_passthrough(Codec::BigInt(BigIntCodec::I64), ViewKind::BigInt64);
    assert_passthrough(Codec::BigInt(BigIntCodec::U64), ViewKind::BigUint64);
    assert_passthrough(Codec::Float(FloatCodec::F32), ViewKind::Float32);
    assert_passthrough(Codec::Float(FloatCodec::F64), ViewKind::Float64);
}

fn assert_view_rejected(item: Codec, view_kind: ViewKind) {
    helpers::run(|| {
        let env = helpers::fake_env();
        let mut data = vec![0u8; 4 * view_kind.element_size()];
        let view = view_over(&env, &mut data, 4, view_kind);
        let err = encode_view(
            &array_of(item, ArrayKind::Array, Ownership::Borrowed),
            env,
            view,
        )
        .expect_err("a mismatched view must fail to supply array elements");
        assert!(err.to_string().contains("cannot supply"));
    });
}

#[test]
fn array_encode_rejects_mismatched_bigint_view() {
    assert_view_rejected(Codec::BigInt(BigIntCodec::U64), ViewKind::BigInt64);
}

#[test]
fn array_encode_rejects_views_for_non_buffer_element_kinds() {
    assert_view_rejected(Codec::Boolean(BooleanCodec), ViewKind::Uint8);
}

#[test]
fn array_encode_accepts_views_for_enum_flags_storage() {
    let enum_flags = EnumFlagsCodec {
        kind: EnumFlagsKind::Enum,
        shared_library: "libgtk-4.so.1".to_owned(),
        get_type_fn_name: "gtk_orientation_get_type".to_owned(),
        storage: IntegerCodec::I32,
    };
    assert_passthrough(Codec::EnumFlags(enum_flags), ViewKind::Int32);
}

#[test]
fn array_encode_rejects_views_for_transfer_full_arrays() {
    with_view(4, 4, ViewKind::Uint8, |env, view| {
        let err = encode_view(
            &array_of(
                Codec::Integer(IntegerCodec::U8),
                ArrayKind::Array,
                Ownership::Full,
            ),
            *env,
            view,
        )
        .expect_err("transfer-full arrays must fail to encode");
        assert!(err.to_string().contains("transfer-full"));
    });
}

fn assert_int32_view_passes_through(codec: &ArrayCodec, context: &str) {
    helpers::run(|| {
        let env = helpers::fake_env();
        let mut data = vec![0u8; 16];
        let expected_ptr = data.as_mut_ptr().cast::<c_void>();
        let view = view_over(&env, &mut data, 4, ViewKind::Int32);
        let encoded = encode_view(codec, env, view).expect(context);
        assert!(matches!(encoded, Stash::Ptr(ptr) if ptr == expected_ptr));
    });
}

#[test]
fn array_encode_accepts_views_for_sized_arrays() {
    assert_int32_view_passes_through(
        &sized_array_of(Codec::Integer(IntegerCodec::I32), 1, Ownership::Borrowed),
        "sized arrays should accept views",
    );
}

#[test]
fn array_encode_checks_fixed_size_views_exactly() {
    assert_int32_view_passes_through(
        &fixed_array_of(Codec::Integer(IntegerCodec::I32), 4, Ownership::Borrowed),
        "a fixed-size match should encode",
    );

    helpers::run(|| {
        let env = helpers::fake_env();
        let mut short = vec![0u8; 8];
        let short_view = view_over(&env, &mut short, 2, ViewKind::Int32);
        let err = encode_view(
            &fixed_array_of(Codec::Integer(IntegerCodec::I32), 4, Ownership::Borrowed),
            env,
            short_view,
        )
        .expect_err("a fixed-size mismatch must fail");
        assert!(err.to_string().contains("exactly 4 elements"));
    });
}

use std::ffi::{CString, c_char, c_void};

use gtk4::glib;
use gtk4::prelude::ObjectType as _;
use helpers::napi_mock;
use napi::bindgen_prelude::{Array, External, FromNapiValue as _};
use napi::{Env, JsValue as _};
use native::api::bind::bind;
use native::api::call::call;
use native::ffi::codec::{
    ArrayBounds, ArrayCodec, ArrayKind, BigIntCodec, BooleanCodec, Codec, Decoder, Encoder,
    EnumFlagsCodec, EnumFlagsKind, FloatCodec, HashTableCodec, IntegerCodec, ObjectCodec,
    Ownership, ReadCtx, RefCodec, StringCodec, UnicharCodec,
};
use native::ffi::descriptor::{Descriptor, NestedDescriptor};
use native::ffi::{self, StashData, StashStorage};
use native::handle::Handle;
use test_support as helpers;

const GLIB: &str = "libglib-2.0.so.0";

fn string_codec() -> StringCodec {
    StringCodec {
        ownership: Ownership::Borrowed,
        length: None,
    }
}

fn ptr_slot_stash(inner: *mut c_void) -> ffi::Stash {
    let mut slot: Vec<*mut c_void> = vec![inner];
    let raw = slot.as_mut_ptr().cast::<c_void>();
    ffi::Stash::Storage(StashStorage::new(raw, StashData::PtrSlot(slot, None)))
}

fn u8_array_ref_codec() -> RefCodec {
    RefCodec::new(
        Codec::Array(
            ArrayCodec::new(
                Box::new(Codec::Integer(IntegerCodec::U8)),
                ArrayKind::Array,
                Ownership::Borrowed,
                ArrayBounds::NONE,
                None,
                true,
            )
            .expect("valid array codec"),
        ),
        false,
    )
    .expect("Array is a valid Ref inner")
}

fn assert_array_decodes_empty(env: &Env, array_codec: ArrayCodec, stash: &ffi::Stash) {
    let ref_codec =
        RefCodec::new(Codec::Array(array_codec), false).expect("Array is a valid Ref inner");
    let decoded = ref_codec
        .decode_with_context(env, stash, &[], &[])
        .expect("array decode should succeed");
    let length = napi_mock::read_array(decoded.raw())
        .map(|items| items.len())
        .or_else(|| napi_mock::read_bytes(decoded.raw()).map(|bytes| bytes.len()))
        .expect("expected an array or typed array value");
    assert_eq!(length, 0);
}

fn with_i32_storage_ref(value: i32, f: impl FnOnce(&ffi::Stash, &RefCodec)) {
    let mut value = value;
    let slot = (&raw mut value).cast::<c_void>();
    let stash = ffi::Stash::Storage(StashStorage::new(slot, StashData::Unit));
    let ref_codec =
        RefCodec::new(Codec::Integer(IntegerCodec::I32), false).expect("valid Ref inner");
    f(&stash, &ref_codec);
}

fn with_bigint_storage_ref(
    codec: BigIntCodec,
    bytes: [u8; 8],
    f: impl FnOnce(&ffi::Stash, &RefCodec),
) {
    let mut bytes = bytes;
    let slot = bytes.as_mut_ptr().cast::<c_void>();
    let stash = ffi::Stash::Storage(StashStorage::new(slot, StashData::Unit));
    let ref_codec = RefCodec::new(Codec::BigInt(codec), false).expect("valid Ref inner");

    f(&stash, &ref_codec);
}

fn ptr_sized_malloc_stash() -> ffi::Stash {
    let inner = unsafe { glib::ffi::g_malloc0(size_of::<*mut c_void>()) };
    ptr_slot_stash(inner)
}

#[test]
fn decode_rejects_non_storage_non_null_ptr() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let ref_codec =
            RefCodec::new(Codec::Integer(IntegerCodec::I32), false).expect("valid Ref inner");
        let result = ref_codec.decode(&env, &ffi::Stash::I32(7));
        assert!(result.is_err());
    });
}

#[test]
fn decode_null_ptr_yields_null() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let ref_codec =
            RefCodec::new(Codec::Integer(IntegerCodec::I32), false).expect("valid Ref inner");
        let decoded = ref_codec
            .decode(&env, &ffi::Stash::Ptr(std::ptr::null_mut()))
            .expect("null ptr decode should succeed");
        assert!(napi_mock::is_null(decoded.raw()));
    });
}

#[test]
fn decode_integer_reads_number() {
    helpers::run(|| {
        let env = helpers::fake_env();
        with_i32_storage_ref(4321, |stash, ref_codec| {
            let decoded = ref_codec
                .decode(&env, stash)
                .expect("integer ref decode should succeed");
            assert_eq!(napi_mock::read_double(decoded.raw()), Some(4321.0));
        });
    });
}

#[test]
fn decode_enum_flags_reads_number() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let mut value: i32 = 9;
        let slot = (&raw mut value).cast::<c_void>();
        let stash = ffi::Stash::Storage(StashStorage::new(slot, StashData::Unit));

        let enum_flags = EnumFlagsCodec {
            kind: EnumFlagsKind::Enum,
            shared_library: "libgobject-2.0.so.0".to_owned(),
            get_type_fn_name: "g_unused_get_type".to_owned(),
            storage: IntegerCodec::I32,
        };
        let ref_codec =
            RefCodec::new(Codec::EnumFlags(enum_flags), false).expect("valid Ref inner");
        let decoded = ref_codec
            .decode(&env, &stash)
            .expect("enum/flags ref decode should succeed");
        assert_eq!(napi_mock::read_double(decoded.raw()), Some(9.0));
    });
}

#[test]
fn decode_float_reads_number() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let mut value: f64 = 2.5;
        let slot = (&raw mut value).cast::<c_void>();
        let stash = ffi::Stash::Storage(StashStorage::new(slot, StashData::Unit));

        let ref_codec =
            RefCodec::new(Codec::Float(FloatCodec::F64), false).expect("valid Ref inner");
        let decoded = ref_codec
            .decode(&env, &stash)
            .expect("float ref decode should succeed");
        assert_eq!(napi_mock::read_double(decoded.raw()), Some(2.5));
    });
}

#[test]
fn decode_bigint_i64_reads_bigint() {
    helpers::run(|| {
        let env = helpers::fake_env();
        with_bigint_storage_ref(
            BigIntCodec::I64,
            i64::MIN.to_ne_bytes(),
            |stash, ref_codec| {
                let decoded = ref_codec
                    .decode(&env, stash)
                    .expect("bigint64 ref decode should succeed");
                assert_eq!(
                    napi_mock::read_bigint_i128(decoded.raw()),
                    Some(i128::from(i64::MIN))
                );
            },
        );
    });
}

#[test]
fn decode_bigint_u64_reads_bigint() {
    helpers::run(|| {
        let env = helpers::fake_env();
        with_bigint_storage_ref(
            BigIntCodec::U64,
            u64::MAX.to_ne_bytes(),
            |stash, ref_codec| {
                let decoded = ref_codec
                    .decode(&env, stash)
                    .expect("biguint64 ref decode should succeed");
                assert_eq!(
                    napi_mock::read_bigint_i128(decoded.raw()),
                    Some(i128::from(u64::MAX))
                );
            },
        );
    });
}

#[test]
fn decode_bigint_inout_reads_back_the_encoded_seed() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let seed = i128::from(i64::MIN);
        let value = napi_mock::to_unknown(
            &env,
            napi_mock::fake_object(&[("value", napi_mock::fake_bigint_i128(seed))]),
        );
        let ref_codec =
            RefCodec::new(Codec::BigInt(BigIntCodec::I64), true).expect("valid Ref inner");
        let stash = ref_codec
            .encode(&env, value)
            .expect("encoding an inout bigint should succeed");

        let decoded = ref_codec
            .decode(&env, &stash)
            .expect("inout bigint ref decode should succeed");
        assert_eq!(napi_mock::read_bigint_i128(decoded.raw()), Some(seed));
    });
}

#[test]
fn decode_gobject_delegates_to_inner_decoder() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let obj = glib::Object::new::<glib::Object>();
        let obj_ptr = obj.as_ptr().cast::<c_void>();
        let stash = ptr_slot_stash(obj_ptr);

        let ref_codec = RefCodec::new(
            Codec::Object(ObjectCodec {
                ownership: Ownership::Borrowed,
                is_call_scoped: false,
            }),
            false,
        )
        .expect("GObject is a valid Ref inner");
        let decoded = ref_codec
            .decode(&env, &stash)
            .expect("gobject ref decode should succeed");
        let ptr = native::value::handle_ptr(decoded, "ctx")
            .expect("decoded value should carry a native handle");
        assert_eq!(ptr, obj_ptr);
        drop(obj);
    });
}

#[test]
fn decode_string_reads_via_decode_ref_string() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let cstring = CString::new("ref-string").unwrap();
        let stash = ptr_slot_stash(cstring.as_ptr() as *mut c_void);

        let ref_codec =
            RefCodec::new(Codec::String(string_codec()), false).expect("valid Ref inner");
        let decoded = ref_codec
            .decode(&env, &stash)
            .expect("string ref decode should succeed");
        assert_eq!(
            napi_mock::read_string(decoded.raw()),
            Some("ref-string".to_owned())
        );
    });
}

#[test]
fn decode_array_inner_bails_without_context() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let stash = ptr_slot_stash(std::ptr::null_mut());

        let ref_codec = u8_array_ref_codec();
        assert!(ref_codec.decode(&env, &stash).is_err());
    });
}

fn string_string_hashtable_ref_codec(ownership: Ownership) -> RefCodec {
    RefCodec::new(
        Codec::HashTable(HashTableCodec {
            key_codec: Box::new(Codec::String(string_codec())),
            value_codec: Box::new(Codec::String(string_codec())),
            ownership,
        }),
        false,
    )
    .expect("HashTable is a valid Ref inner")
}

#[test]
fn decode_hashtable_reads_pairs() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let table = unsafe {
            glib::ffi::g_hash_table_new_full(
                Some(glib::ffi::g_str_hash),
                Some(glib::ffi::g_str_equal),
                Some(glib::ffi::g_free),
                Some(glib::ffi::g_free),
            )
        };
        unsafe {
            glib::ffi::g_hash_table_insert(
                table,
                glib::ffi::g_strdup(c"filename".as_ptr()).cast::<c_void>(),
                glib::ffi::g_strdup(c"index.html".as_ptr()).cast::<c_void>(),
            );
        }
        let stash = ptr_slot_stash(table.cast::<c_void>());

        let ref_codec = string_string_hashtable_ref_codec(Ownership::Full);
        let decoded = ref_codec
            .decode(&env, &stash)
            .expect("hashtable ref decode should succeed");
        let pairs = napi_mock::read_array(decoded.raw()).expect("expected Array of pairs");
        assert_eq!(pairs.len(), 1);
        let pair = napi_mock::read_array(pairs[0]).expect("expected [key, value] tuple");
        assert_eq!(napi_mock::read_string(pair[0]), Some("filename".to_owned()));
        assert_eq!(
            napi_mock::read_string(pair[1]),
            Some("index.html".to_owned())
        );
    });
}

#[test]
fn decode_hashtable_null_inner_yields_empty_array() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let stash = ptr_slot_stash(std::ptr::null_mut());

        let ref_codec = string_string_hashtable_ref_codec(Ownership::Full);
        let decoded = ref_codec
            .decode(&env, &stash)
            .expect("null hashtable ref decode should succeed");
        let arr = napi_mock::read_array(decoded.raw()).expect("expected an array value");
        assert!(arr.is_empty());
    });
}

#[test]
fn decode_boolean_reads_bool() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let mut value: i32 = 1;
        let slot = (&raw mut value).cast::<c_void>();
        let stash = ffi::Stash::Storage(StashStorage::new(slot, StashData::Unit));

        let ref_codec =
            RefCodec::new(Codec::Boolean(BooleanCodec), false).expect("valid Ref inner");
        let decoded = ref_codec
            .decode(&env, &stash)
            .expect("boolean ref decode should succeed");
        assert_eq!(napi_mock::read_bool(decoded.raw()), Some(true));
    });
}

#[test]
fn decode_unichar_reads_string() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let mut value: u32 = 'é' as u32;
        let slot = (&raw mut value).cast::<c_void>();
        let stash = ffi::Stash::Storage(StashStorage::new(slot, StashData::Unit));

        let ref_codec =
            RefCodec::new(Codec::Unichar(UnicharCodec), false).expect("valid Ref inner");
        let decoded = ref_codec
            .decode(&env, &stash)
            .expect("unichar ref decode should succeed");
        assert_eq!(napi_mock::read_string(decoded.raw()), Some("é".to_owned()));
    });
}

#[test]
fn decode_ref_string_buffer_kind_reads_directly() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let mut buffer = b"buffered\0".to_vec();
        let ptr = buffer.as_mut_ptr().cast::<c_void>();
        let stash = ffi::Stash::Storage(StashStorage::new(ptr, StashData::Buffer(buffer)));

        let ref_codec =
            RefCodec::new(Codec::String(string_codec()), false).expect("valid Ref inner");
        let decoded = ref_codec
            .decode(&env, &stash)
            .expect("buffer string ref decode should succeed");
        assert_eq!(
            napi_mock::read_string(decoded.raw()),
            Some("buffered".to_owned())
        );
    });
}

#[test]
fn decode_ref_string_null_storage_pointer_yields_null() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let stash = ffi::Stash::Storage(StashStorage::new(std::ptr::null_mut(), StashData::Unit));
        let ref_codec =
            RefCodec::new(Codec::String(string_codec()), false).expect("valid Ref inner");
        let decoded = ref_codec
            .decode(&env, &stash)
            .expect("null stash string ref decode should succeed");
        assert!(napi_mock::is_null(decoded.raw()));
    });
}

#[test]
fn decode_ref_string_null_inner_pointer_yields_null() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let stash = ptr_slot_stash(std::ptr::null_mut());

        let ref_codec =
            RefCodec::new(Codec::String(string_codec()), false).expect("valid Ref inner");
        let decoded = ref_codec
            .decode(&env, &stash)
            .expect("null inner string ref decode should succeed");
        assert!(napi_mock::is_null(decoded.raw()));
    });
}

#[test]
fn decode_ref_string_full_ownership_frees_pointer() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let owned = unsafe { glib::ffi::g_strdup(c"owned-ref".as_ptr()) };
        let stash = ptr_slot_stash(owned.cast::<c_void>());

        let full_string = StringCodec {
            ownership: Ownership::Full,
            length: None,
        };
        let ref_codec = RefCodec::new(Codec::String(full_string), false).expect("valid Ref inner");
        let decoded = ref_codec
            .decode(&env, &stash)
            .expect("full string ref decode should succeed");
        assert_eq!(
            napi_mock::read_string(decoded.raw()),
            Some("owned-ref".to_owned())
        );
    });
}

#[test]
fn decode_with_context_non_array_delegates_to_decode() {
    helpers::run(|| {
        let env = helpers::fake_env();
        with_i32_storage_ref(11, |stash, ref_codec| {
            let decoded = ref_codec
                .decode_with_context(&env, stash, &[], &[])
                .expect("non-array decode_with_context should succeed");
            assert_eq!(napi_mock::read_double(decoded.raw()), Some(11.0));
        });
    });
}
#[test]
fn decode_with_context_array_null_ptr_yields_null() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let ref_codec = u8_array_ref_codec();
        let decoded = ref_codec
            .decode_with_context(&env, &ffi::Stash::Ptr(std::ptr::null_mut()), &[], &[])
            .expect("array null ptr decode_with_context should succeed");
        assert!(napi_mock::is_null(decoded.raw()));
    });
}

#[test]
fn decode_with_context_array_ptr_slot_stash_null_inner_yields_empty_array() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let stash = ptr_slot_stash(std::ptr::null_mut());

        let ref_codec = u8_array_ref_codec();
        let decoded = ref_codec
            .decode_with_context(&env, &stash, &[], &[])
            .expect("array ptr_slot_stash null inner decode should succeed");
        let arr = napi_mock::read_bytes(decoded.raw()).expect("expected a typed array");
        assert!(arr.is_empty());
    });
}

#[test]
fn decode_with_context_array_string_items_not_freed_by_ref() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let inner = unsafe { glib::ffi::g_malloc0(size_of::<*mut c_char>()) };
        let stash = ptr_slot_stash(inner);

        let array_codec = ArrayCodec::new(
            Box::new(Codec::String(string_codec())),
            ArrayKind::Array,
            Ownership::Full,
            ArrayBounds::NONE,
            None,
            false,
        )
        .expect("valid array codec");
        assert_array_decodes_empty(&env, array_codec, &stash);
    });
}

#[test]
fn decode_with_context_array_container_released_by_array_decoder() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let stash = ptr_sized_malloc_stash();

        let array_codec = ArrayCodec::new(
            Box::new(Codec::Object(ObjectCodec {
                ownership: Ownership::Borrowed,
                is_call_scoped: false,
            })),
            ArrayKind::Array,
            Ownership::Full,
            ArrayBounds::NONE,
            None,
            false,
        )
        .expect("valid array codec");
        assert_array_decodes_empty(&env, array_codec, &stash);
    });
}

#[test]
fn decode_with_context_garray_container_released_by_array_decoder() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let element_size = u32::try_from(size_of::<u8>()).expect("u8 size fits in guint");
        let g_array = unsafe { glib::ffi::g_array_sized_new(0, 0, element_size, 0) };
        let stash = ptr_slot_stash(g_array.cast::<c_void>());

        let array_codec = ArrayCodec::new(
            Box::new(Codec::Integer(IntegerCodec::U8)),
            ArrayKind::GArray,
            Ownership::Full,
            ArrayBounds::NONE,
            None,
            false,
        )
        .expect("valid garray codec");
        assert_array_decodes_empty(&env, array_codec, &stash);
    });
}

#[test]
fn decode_with_context_array_non_string_items_freed_by_ref() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let stash = ptr_sized_malloc_stash();

        let array_codec = ArrayCodec::new(
            Box::new(Codec::Integer(IntegerCodec::U8)),
            ArrayKind::Fixed,
            Ownership::Full,
            ArrayBounds::fixed(0),
            None,
            false,
        )
        .expect("valid fixed array codec");
        assert_array_decodes_empty(&env, array_codec, &stash);
    });
}

#[test]
fn decode_with_context_array_non_ptr_slot_stash_uses_storage_pointer() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let mut buffer: Vec<u8> = vec![0u8; size_of::<*mut c_void>()];
        let stash = ffi::Stash::Storage(StashStorage::new(
            buffer.as_mut_ptr().cast::<c_void>(),
            StashData::Buffer(buffer),
        ));

        let array_codec = ArrayCodec::new(
            Box::new(Codec::String(string_codec())),
            ArrayKind::Array,
            Ownership::Borrowed,
            ArrayBounds::NONE,
            None,
            false,
        )
        .expect("valid array codec");
        assert_array_decodes_empty(&env, array_codec, &stash);
    });
}

fn ref_descriptor(inner: Descriptor, inout: Option<bool>) -> Descriptor {
    Descriptor::Ref {
        inner_descriptor: NestedDescriptor(Box::new(inner)),
        inout,
    }
}

fn gerror_ref_descriptor() -> Descriptor {
    ref_descriptor(
        Descriptor::Boxed {
            ownership: Ownership::Full,
            type_name: "GError".to_owned(),
            shared_library: Some(GLIB.to_owned()),
            get_type_fn_name: Some("g_error_get_type".to_owned()),
            free_fn_name: None,
            is_caller_allocated: None,
            size: None,
            is_inline: None,
        },
        None,
    )
}

fn borrowed_string_descriptor() -> Descriptor {
    Descriptor::String {
        ownership: Ownership::Borrowed,
        length: None,
    }
}

fn value_array<'e>(env: &'e Env, items: &[napi::sys::napi_value]) -> Array<'e> {
    Array::from_unknown(napi_mock::to_unknown(env, napi_mock::fake_array(items)))
        .expect("fake array should convert to an Array")
}

fn out_ref_value() -> napi::sys::napi_value {
    napi_mock::fake_object(&[("value", napi_mock::fake_null())])
}

fn ref_value_bigint(value: napi::sys::napi_value) -> Option<i128> {
    napi_mock::read_object_property(value, "value").and_then(napi_mock::read_bigint_i128)
}

fn ascii_string_to_number_descriptors(width: fn() -> Descriptor) -> Vec<Descriptor> {
    vec![
        borrowed_string_descriptor(),
        Descriptor::Uint32,
        width(),
        width(),
        ref_descriptor(width(), None),
        gerror_ref_descriptor(),
    ]
}

#[test]
fn call_with_nullish_ref_arguments_passes_null_pointers_and_skips_writeback() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let descriptor = bind(
            GLIB.to_owned(),
            "g_direct_equal".to_owned(),
            vec![
                ref_descriptor(Descriptor::Int32, None),
                ref_descriptor(Descriptor::Int32, None),
            ],
            Descriptor::Boolean,
            None,
        )
        .expect("bind should succeed");

        let values = value_array(&env, &[napi_mock::fake_null(), napi_mock::fake_undefined()]);

        let result =
            call(&env, &descriptor, values).expect("call with nullish refs should succeed");

        assert_eq!(napi_mock::read_bool(result.raw()), Some(true));
        assert_eq!(napi_mock::count("napi_set_named_property"), 0);
    });
}

#[test]
fn call_writes_back_a_gint64_out_parameter_from_g_ascii_string_to_signed() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let descriptor = bind(
            GLIB.to_owned(),
            "g_ascii_string_to_signed".to_owned(),
            ascii_string_to_number_descriptors(|| Descriptor::Bigint64),
            Descriptor::Boolean,
            None,
        )
        .expect("bind should succeed");

        let out_num = out_ref_value();
        let values = value_array(
            &env,
            &[
                napi_mock::fake_string("-9223372036854775808"),
                napi_mock::fake_double(10.0),
                napi_mock::fake_bigint_i128(i128::from(i64::MIN)),
                napi_mock::fake_bigint_i128(0),
                out_num,
                napi_mock::fake_null(),
            ],
        );

        let result = call(&env, &descriptor, values).expect("the call should succeed");

        assert_eq!(napi_mock::read_bool(result.raw()), Some(true));
        assert_eq!(ref_value_bigint(out_num), Some(i128::from(i64::MIN)));
    });
}

#[test]
fn call_writes_back_a_guint64_out_parameter_from_g_ascii_string_to_unsigned() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let descriptor = bind(
            GLIB.to_owned(),
            "g_ascii_string_to_unsigned".to_owned(),
            ascii_string_to_number_descriptors(|| Descriptor::Biguint64),
            Descriptor::Boolean,
            None,
        )
        .expect("bind should succeed");

        let out_num = out_ref_value();
        let values = value_array(
            &env,
            &[
                napi_mock::fake_string("18446744073709551615"),
                napi_mock::fake_double(10.0),
                napi_mock::fake_bigint_i128(0),
                napi_mock::fake_bigint_i128(i128::from(u64::MAX)),
                out_num,
                napi_mock::fake_null(),
            ],
        );

        let result = call(&env, &descriptor, values).expect("the call should succeed");

        assert_eq!(napi_mock::read_bool(result.raw()), Some(true));
        assert_eq!(ref_value_bigint(out_num), Some(i128::from(u64::MAX)));
    });
}

#[test]
fn call_writes_back_a_gint64_inout_parameter_from_g_time_zone_adjust_time() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let descriptor = bind(
            GLIB.to_owned(),
            "g_time_zone_adjust_time".to_owned(),
            vec![
                Descriptor::Boxed {
                    ownership: Ownership::Borrowed,
                    type_name: "GTimeZone".to_owned(),
                    shared_library: Some(GLIB.to_owned()),
                    get_type_fn_name: Some("g_time_zone_get_type".to_owned()),
                    free_fn_name: None,
                    is_caller_allocated: None,
                    size: None,
                    is_inline: None,
                },
                Descriptor::Int32,
                ref_descriptor(Descriptor::Bigint64, Some(true)),
            ],
            Descriptor::Int32,
            None,
        )
        .expect("bind should succeed");

        let zone = unsafe { glib::ffi::g_time_zone_new_utc() };
        let zone_value = External::new(Handle::from_glib_borrow(zone.cast::<c_void>()))
            .into_unknown(&env)
            .expect("wrapping the time zone handle should succeed")
            .raw();
        let seed = i128::from(i64::from(i32::MAX)) * 1_000;
        let time = napi_mock::fake_object(&[("value", napi_mock::fake_bigint_i128(seed))]);
        let values = value_array(&env, &[zone_value, napi_mock::fake_double(0.0), time]);

        call(&env, &descriptor, values).expect("the call should succeed");

        assert_eq!(ref_value_bigint(time), Some(seed));
        unsafe { glib::ffi::g_time_zone_unref(zone) };
    });
}

#[test]
fn read_from_pointer_null_inner_yields_null() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let inner: *mut c_void = std::ptr::null_mut();
        let ref_codec =
            RefCodec::new(Codec::Integer(IntegerCodec::I32), false).expect("valid Ref inner");
        let value = unsafe {
            ref_codec.read(
                &env,
                ReadCtx::slot((&raw const inner).cast::<c_void>(), "ctx"),
            )
        }
        .expect("read_from_pointer should succeed");
        assert!(napi_mock::is_null(value.raw()));
    });
}

#[test]
fn read_from_pointer_string_inner_reads_value() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let cstring = CString::new("raw-ref").unwrap();
        let char_ptr = cstring.as_ptr() as *mut c_void;
        let inner_slot: *mut c_void = (&raw const char_ptr).cast_mut().cast();

        let ref_codec =
            RefCodec::new(Codec::String(string_codec()), false).expect("valid Ref inner");
        let value = unsafe {
            ref_codec.read(
                &env,
                ReadCtx::slot((&raw const inner_slot).cast::<c_void>(), "ctx"),
            )
        }
        .expect("read_from_pointer should succeed");
        assert_eq!(
            napi_mock::read_string(value.raw()),
            Some("raw-ref".to_owned())
        );
    });
}

#[test]
fn a_ref_string_buffer_length_beyond_addressable_memory_is_an_error() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let codec = RefCodec::new(
            Codec::String(StringCodec {
                ownership: Ownership::Borrowed,
                length: Some(usize::MAX),
            }),
            false,
        )
        .expect("String is a valid Ref inner");
        let value = napi_mock::to_unknown(
            &env,
            napi_mock::fake_object(&[("value", napi_mock::fake_null())]),
        );
        assert!(codec.encode(&env, value).is_err());
    });
}

fn strv_ref_codec() -> RefCodec {
    RefCodec::new(
        Codec::Array(
            ArrayCodec::new(
                Box::new(Codec::String(StringCodec {
                    ownership: Ownership::Full,
                    length: None,
                })),
                ArrayKind::Array,
                Ownership::Full,
                ArrayBounds::NONE,
                None,
                false,
            )
            .expect("valid array codec"),
        ),
        true,
    )
    .expect("Array is a valid Ref inner")
}

#[test]
fn encode_non_empty_array_yields_a_pointer_to_the_container() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let value = napi_mock::to_unknown(
            &env,
            napi_mock::fake_object(&[(
                "value",
                napi_mock::fake_array(&[
                    napi_mock::fake_string("probe"),
                    napi_mock::fake_string("--count=7"),
                ]),
            )]),
        );

        let stash = strv_ref_codec()
            .encode(&env, value)
            .expect("encoding an inout string array should succeed");

        let slot = stash.as_ptr("ref").expect("expected a pointer stash");
        let container = unsafe { *slot.cast::<*mut *mut c_char>() };
        assert!(!container.is_null());
        assert_ne!(container.cast::<c_void>(), slot);

        let first = unsafe { glib::GStr::from_ptr_lossy(*container) };
        assert_eq!(first.to_string(), "probe");

        stash.disarm_pending_transfer();
        unsafe { glib::ffi::g_strfreev(container) };
    });
}

#[test]
fn decode_with_context_reads_the_container_the_callee_left_in_the_slot() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let value = napi_mock::to_unknown(
            &env,
            napi_mock::fake_object(&[(
                "value",
                napi_mock::fake_array(&[napi_mock::fake_string("before")]),
            )]),
        );
        let ref_codec = strv_ref_codec();
        let stash = ref_codec
            .encode(&env, value)
            .expect("encoding an inout string array should succeed");

        let slot = stash.as_ptr("ref").expect("expected a pointer stash");
        let replaced = glib::StrV::from(vec!["after"]).into_raw();
        let discarded = unsafe { *slot.cast::<*mut *mut c_char>() };
        unsafe { glib::ffi::g_strfreev(discarded) };
        unsafe { *slot.cast::<*mut *mut c_char>() = replaced };
        stash.disarm_pending_transfer();

        let decoded = ref_codec
            .decode_with_context(&env, &stash, &[], &[])
            .expect("decoding the replaced container should succeed");
        let items = napi_mock::read_array(decoded.raw()).expect("expected an array value");
        assert_eq!(items.len(), 1);
        assert_eq!(napi_mock::read_string(items[0]), Some("after".to_owned()));
    });
}

#[test]
fn encode_length_bounded_array_passes_the_caller_allocated_buffer_itself() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let ref_codec = RefCodec::new(
            Codec::Array(
                ArrayCodec::new(
                    Box::new(Codec::Integer(IntegerCodec::U32)),
                    ArrayKind::Sized,
                    Ownership::Borrowed,
                    ArrayBounds::sized(0),
                    None,
                    false,
                )
                .expect("valid sized array codec"),
            ),
            false,
        )
        .expect("Array is a valid Ref inner");

        let value = napi_mock::to_unknown(
            &env,
            napi_mock::fake_object(&[(
                "value",
                napi_mock::fake_array(&[napi_mock::fake_double(0.0), napi_mock::fake_double(0.0)]),
            )]),
        );

        let stash = ref_codec
            .encode(&env, value)
            .expect("encoding a caller-allocated out buffer should succeed");
        let ffi::Stash::Storage(storage) = &stash else {
            panic!("expected a Storage stash");
        };

        assert!(!matches!(storage.data(), StashData::PtrSlot(_, _)));
        assert_eq!(storage.ptr(), stash.as_ptr("ref").expect("a pointer stash"));
    });
}

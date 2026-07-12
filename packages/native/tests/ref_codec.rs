use test_support as helpers;

use std::ffi::{CString, c_char, c_void};

use gtk4::glib;
use gtk4::prelude::ObjectType as _;

use napi::Env;
use napi::JsValue as _;
use napi::bindgen_prelude::{Array, FromNapiValue as _};

use native::ffi::codec::{
    ArrayCodec, ArrayKind, BooleanCodec, Codec, Decoder, EnumFlagsCodec, EnumFlagsKind, FloatCodec,
    HashTableCodec, IntegerCodec, ObjectCodec, Ownership, ReadSource, RefCodec, StringCodec,
    UnicharCodec,
};
use native::ffi::descriptor::{Descriptor, NestedDescriptor};
use native::ffi::{self, StashData, StashStorage};
use native::request::{bind::bind, call::call};

use helpers::napi_mock;

fn string_codec() -> StringCodec {
    StringCodec {
        ownership: Ownership::Borrowed,
        length: None,
    }
}

fn ptr_slot_stash(inner: *mut c_void) -> ffi::Stash {
    let mut slot: Vec<*mut c_void> = vec![inner];
    let raw = slot.as_mut_ptr() as *mut c_void;
    ffi::Stash::Storage(StashStorage::new(raw, StashData::PtrSlot(slot)))
}

fn u8_array_ref_codec() -> RefCodec {
    RefCodec::new(Codec::Array(
        ArrayCodec::new(
            Box::new(Codec::Integer(IntegerCodec::U8)),
            ArrayKind::Array,
            Ownership::Borrowed,
            None,
            None,
            None,
        )
        .expect("valid array codec"),
    ))
    .expect("Array is a valid Ref inner")
}

fn assert_array_decodes_empty(env: &Env, array_codec: ArrayCodec, stash: &ffi::Stash) {
    let ref_codec = RefCodec::new(Codec::Array(array_codec)).expect("Array is a valid Ref inner");
    let decoded = ref_codec
        .decode_with_context(env, stash, &[], &[])
        .expect("array decode should succeed");
    let arr = napi_mock::read_array(decoded.raw()).expect("expected an array value");
    assert!(arr.is_empty());
}

fn with_i32_storage_ref(value: i32, f: impl FnOnce(&ffi::Stash, &RefCodec)) {
    let mut value = value;
    let slot = &mut value as *mut i32 as *mut c_void;
    let stash = ffi::Stash::Storage(StashStorage::new(slot, StashData::Unit));
    let ref_codec = RefCodec::new(Codec::Integer(IntegerCodec::I32)).expect("valid Ref inner");
    f(&stash, &ref_codec);
}

fn ptr_sized_malloc_stash() -> ffi::Stash {
    let inner = unsafe { glib::ffi::g_malloc0(std::mem::size_of::<*mut c_void>()) };
    ptr_slot_stash(inner)
}

#[test]
fn decode_rejects_non_storage_non_null_ptr() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let ref_codec = RefCodec::new(Codec::Integer(IntegerCodec::I32)).expect("valid Ref inner");
        let result = ref_codec.decode(&env, &ffi::Stash::I32(7));
        assert!(result.is_err());
    });
}

#[test]
fn decode_null_ptr_yields_null() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let ref_codec = RefCodec::new(Codec::Integer(IntegerCodec::I32)).expect("valid Ref inner");
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
        let slot = &mut value as *mut i32 as *mut c_void;
        let stash = ffi::Stash::Storage(StashStorage::new(slot, StashData::Unit));

        let enum_flags = EnumFlagsCodec {
            kind: EnumFlagsKind::Enum,
            shared_library: "libgobject-2.0.so.0".to_owned(),
            get_type_fn_name: "g_unused_get_type".to_owned(),
            storage: IntegerCodec::I32,
        };
        let ref_codec = RefCodec::new(Codec::EnumFlags(enum_flags)).expect("valid Ref inner");
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
        let slot = &mut value as *mut f64 as *mut c_void;
        let stash = ffi::Stash::Storage(StashStorage::new(slot, StashData::Unit));

        let ref_codec = RefCodec::new(Codec::Float(FloatCodec::F64)).expect("valid Ref inner");
        let decoded = ref_codec
            .decode(&env, &stash)
            .expect("float ref decode should succeed");
        assert_eq!(napi_mock::read_double(decoded.raw()), Some(2.5));
    });
}

#[test]
fn decode_gobject_delegates_to_inner_decoder() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let obj = glib::Object::new::<glib::Object>();
        let obj_ptr = obj.as_ptr() as *mut c_void;
        let stash = ptr_slot_stash(obj_ptr);

        let ref_codec = RefCodec::new(Codec::Object(ObjectCodec {
            ownership: Ownership::Borrowed,
        }))
        .expect("GObject is a valid Ref inner");
        let decoded = ref_codec
            .decode(&env, &stash)
            .expect("gobject ref decode should succeed");
        let ptr = native::ffi::value::handle_ptr(&env, decoded, "ctx")
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

        let ref_codec = RefCodec::new(Codec::String(string_codec())).expect("valid Ref inner");
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
    RefCodec::new(Codec::HashTable(HashTableCodec {
        key_codec: Box::new(Codec::String(string_codec())),
        value_codec: Box::new(Codec::String(string_codec())),
        ownership,
    }))
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
                glib::ffi::g_strdup(c"filename".as_ptr()) as *mut c_void,
                glib::ffi::g_strdup(c"index.html".as_ptr()) as *mut c_void,
            );
        }
        let stash = ptr_slot_stash(table as *mut c_void);

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
        let slot = &mut value as *mut i32 as *mut c_void;
        let stash = ffi::Stash::Storage(StashStorage::new(slot, StashData::Unit));

        let ref_codec = RefCodec::new(Codec::Boolean(BooleanCodec)).expect("valid Ref inner");
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
        let slot = &mut value as *mut u32 as *mut c_void;
        let stash = ffi::Stash::Storage(StashStorage::new(slot, StashData::Unit));

        let ref_codec = RefCodec::new(Codec::Unichar(UnicharCodec)).expect("valid Ref inner");
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
        let ptr = buffer.as_mut_ptr() as *mut c_void;
        let stash = ffi::Stash::Storage(StashStorage::new(ptr, StashData::Buffer(buffer)));

        let ref_codec = RefCodec::new(Codec::String(string_codec())).expect("valid Ref inner");
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
        let ref_codec = RefCodec::new(Codec::String(string_codec())).expect("valid Ref inner");
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

        let ref_codec = RefCodec::new(Codec::String(string_codec())).expect("valid Ref inner");
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
        let stash = ptr_slot_stash(owned as *mut c_void);

        let full_string = StringCodec {
            ownership: Ownership::Full,
            length: None,
        };
        let ref_codec = RefCodec::new(Codec::String(full_string)).expect("valid Ref inner");
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
        let arr = napi_mock::read_array(decoded.raw()).expect("expected an array value");
        assert!(arr.is_empty());
    });
}

#[test]
fn decode_with_context_array_string_items_not_freed_by_ref() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let inner = unsafe { glib::ffi::g_malloc0(std::mem::size_of::<*mut c_char>()) };
        let stash = ptr_slot_stash(inner);

        let array_codec = ArrayCodec::new(
            Box::new(Codec::String(string_codec())),
            ArrayKind::Array,
            Ownership::Full,
            None,
            None,
            None,
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
            })),
            ArrayKind::Array,
            Ownership::Full,
            None,
            None,
            None,
        )
        .expect("valid array codec");
        assert_array_decodes_empty(&env, array_codec, &stash);
    });
}

#[test]
fn decode_with_context_garray_container_released_by_array_decoder() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let g_array =
            unsafe { glib::ffi::g_array_sized_new(0, 0, std::mem::size_of::<u8>() as u32, 0) };
        let stash = ptr_slot_stash(g_array as *mut c_void);

        let array_codec = ArrayCodec::new(
            Box::new(Codec::Integer(IntegerCodec::U8)),
            ArrayKind::GArray,
            Ownership::Full,
            None,
            None,
            None,
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
            None,
            Some(0),
            None,
        )
        .expect("valid fixed array codec");
        assert_array_decodes_empty(&env, array_codec, &stash);
    });
}

#[test]
fn decode_with_context_array_non_ptr_slot_stash_uses_storage_pointer() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let mut buffer: Vec<u8> = vec![0u8; std::mem::size_of::<*mut c_void>()];
        let stash = ffi::Stash::Storage(StashStorage::new(
            buffer.as_mut_ptr() as *mut c_void,
            StashData::Buffer(buffer),
        ));

        let array_codec = ArrayCodec::new(
            Box::new(Codec::String(string_codec())),
            ArrayKind::Array,
            Ownership::Borrowed,
            None,
            None,
            None,
        )
        .expect("valid array codec");
        assert_array_decodes_empty(&env, array_codec, &stash);
    });
}

fn i32_ref_descriptor() -> Descriptor {
    Descriptor::Ref {
        inner_descriptor: NestedDescriptor(Box::new(Descriptor::Int32)),
        inout: None,
    }
}

#[test]
fn call_with_nullish_ref_arguments_passes_null_pointers_and_skips_writeback() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let descriptor = bind(
            "libglib-2.0.so.0".to_owned(),
            "g_direct_equal".to_owned(),
            vec![i32_ref_descriptor(), i32_ref_descriptor()],
            Descriptor::Boolean,
        )
        .expect("bind should succeed");

        let raw_values =
            napi_mock::fake_array(&[napi_mock::fake_null(), napi_mock::fake_undefined()]);
        let values = Array::from_unknown(napi_mock::to_unknown(&env, raw_values))
            .expect("fake array should convert to an Array");

        let result =
            call(&env, &descriptor, values).expect("call with nullish refs should succeed");

        assert_eq!(napi_mock::read_bool(result.raw()), Some(true));
        assert_eq!(napi_mock::count("napi_set_named_property"), 0);
    });
}

#[test]
fn read_from_pointer_null_inner_yields_null() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let inner: *mut c_void = std::ptr::null_mut();
        let ref_codec = RefCodec::new(Codec::Integer(IntegerCodec::I32)).expect("valid Ref inner");
        let value = unsafe {
            ref_codec.read(
                &env,
                ReadSource::Slot(&inner as *const *mut c_void as *const c_void, "ctx"),
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
        let inner_slot: *mut c_void = &char_ptr as *const *mut c_void as *mut c_void;

        let ref_codec = RefCodec::new(Codec::String(string_codec())).expect("valid Ref inner");
        let value = unsafe {
            ref_codec.read(
                &env,
                ReadSource::Slot(&inner_slot as *const *mut c_void as *const c_void, "ctx"),
            )
        }
        .expect("read_from_pointer should succeed");
        assert_eq!(
            napi_mock::read_string(value.raw()),
            Some("raw-ref".to_owned())
        );
    });
}

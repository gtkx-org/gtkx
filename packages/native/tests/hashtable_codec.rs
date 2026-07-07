use test_support as helpers;

use std::ffi::c_void;

use gtk4::glib;

use native::Handle;
use native::ffi::Slot;
use native::ffi::Stash;
use native::ffi::codec::{
    ArrayCodec, ArrayKind, BooleanCodec, BoxedCodec, Codec, FloatCodec, FundamentalCodec,
    HashTableCodec, HashTableEntryCodec, IntegerCodec, ObjectCodec, Ownership, StringCodec,
    StructCodec,
};
use native::ffi::codec::{Decoder, Encoder, PtrWriter, ReadSource};
use native::ffi::value::Value;

use helpers::{
    boxed_handle, fresh_gobject as new_object_with_refcount,
    make_bool_param_spec as create_param_spec,
};

fn assert_hash_equal_and_free(encoder: HashTableEntryCodec, installs_free: bool) {
    let (hash, equal) = encoder.hash_and_equal();
    assert!(hash.is_some());
    assert!(equal.is_some());
    assert_eq!(encoder.free_func().unwrap().is_some(), installs_free);
}

fn struct_codec() -> Codec {
    Codec::Struct(StructCodec {
        ownership: Ownership::Borrowed,
        size: Some(size_of::<gtk4::gdk::ffi::GdkRGBA>()),
        caller_allocated: false,
    })
}

fn gptrarray_codec() -> Codec {
    Codec::Array(
        ArrayCodec::new(
            Box::new(struct_codec()),
            ArrayKind::GPtrArray,
            Ownership::Borrowed,
            None,
            None,
            None,
        )
        .expect("valid gptrarray codec"),
    )
}

fn full_boxed_codec() -> Codec {
    Codec::Boxed(BoxedCodec {
        ownership: Ownership::Full,
        type_name: "GdkRGBA".to_string(),
        shared_library: None,
        get_type_fn_name: None,
        free_fn_name: None,
        caller_allocated: false,
    })
}

fn borrowed_string_codec() -> Codec {
    Codec::String(StringCodec {
        ownership: Ownership::Borrowed,
        length: None,
    })
}

fn full_gobject_codec() -> Codec {
    Codec::Object(ObjectCodec {
        ownership: Ownership::Full,
    })
}

fn full_variant_fundamental_encoder(ref_fn_name: &str, unref_fn_name: &str) -> HashTableEntryCodec {
    HashTableEntryCodec::Handle(Box::new(Codec::Fundamental(FundamentalCodec {
        ownership: Ownership::Full,
        shared_library: "libglib-2.0.so.0".to_owned(),
        ref_fn_name: ref_fn_name.to_owned(),
        unref_fn_name: unref_fn_name.to_owned(),
    })))
}

fn param_spec_fundamental_codec() -> Codec {
    Codec::Fundamental(FundamentalCodec {
        ownership: Ownership::Full,
        shared_library: "libgobject-2.0.so.0".to_owned(),
        ref_fn_name: "g_param_spec_ref".to_owned(),
        unref_fn_name: "g_param_spec_unref".to_owned(),
    })
}

fn ht_codec(key: Codec, value: Codec, ownership: Ownership) -> HashTableCodec {
    HashTableCodec {
        key_codec: Box::new(key),
        value_codec: Box::new(value),
        ownership,
    }
}

fn roundtrip(ht: &HashTableCodec, input: &Value) -> Value {
    let encoded = ht.encode(input).expect("encoding should succeed");
    let Stash::Storage(storage) = &encoded else {
        panic!("hash table encode must produce a Storage stash");
    };
    let ptr = storage.ptr();
    if ht.ownership.is_full() {
        unsafe { glib::ffi::g_hash_table_ref(ptr as *mut glib::ffi::GHashTable) };
    }
    ht.decode(&Stash::Ptr(ptr))
        .expect("decoding should succeed")
}

fn assert_encoded_float(encoder: &HashTableEntryCodec, value: &Value, expected: f64) {
    let ptr = encoder.encode(value).expect("encoding should succeed");

    let stored_value = unsafe {
        *ptr.cast::<f64>()
            .as_ref()
            .expect("encoded float pointer should be non-null")
    };
    assert!((stored_value - expected).abs() < f64::EPSILON);

    unsafe { glib::ffi::g_free(ptr) };
}

fn assert_boolean_ptr_reads_true(ptr: *mut c_void) {
    let codec = Codec::Boolean(BooleanCodec);

    let value =
        unsafe { codec.read(ReadSource::Value(ptr, "test")) }.expect("decoding should succeed");

    match value {
        Value::Boolean(true) => (),
        other => panic!("Expected Boolean(true), got {other:?}"),
    }
}

fn boolean_boolean_ht() -> HashTableCodec {
    ht_codec(
        Codec::Boolean(BooleanCodec),
        Codec::Boolean(BooleanCodec),
        Ownership::Full,
    )
}

fn gobject_key_boolean_ht() -> HashTableCodec {
    ht_codec(
        full_gobject_codec(),
        Codec::Boolean(BooleanCodec),
        Ownership::Full,
    )
}

fn assert_kv_pairs<F>(decoded: Value, expected_len: usize, check_kv: F)
where
    F: Fn(&Value, &Value),
{
    let Value::Array(decoded_pairs) = decoded else {
        panic!("Expected array")
    };
    assert_eq!(decoded_pairs.len(), expected_len);
    for pair in decoded_pairs {
        let Value::Array(kv) = pair else {
            panic!("Expected array pair")
        };
        assert_eq!(kv.len(), 2);
        check_kv(&kv[0], &kv[1]);
    }
}

#[test]
fn encoder_from_type_boolean() {
    let codec = Codec::Boolean(BooleanCodec);
    let encoder = HashTableEntryCodec::from_codec(&codec);
    assert!(matches!(encoder, Some(HashTableEntryCodec::Boolean)));
}

#[test]
fn encoder_from_type_float() {
    let codec = Codec::Float(FloatCodec::F64);
    let encoder = HashTableEntryCodec::from_codec(&codec);
    assert!(matches!(encoder, Some(HashTableEntryCodec::Float)));
}

#[test]
fn encoder_from_type_integer() {
    let codec = Codec::Integer(IntegerCodec::I32);
    let encoder = HashTableEntryCodec::from_codec(&codec);
    assert!(matches!(encoder, Some(HashTableEntryCodec::Integer)));
}

#[test]
fn encoder_from_type_string() {
    let codec = Codec::String(StringCodec {
        ownership: Ownership::Borrowed,
        length: None,
    });
    let encoder = HashTableEntryCodec::from_codec(&codec);
    assert!(matches!(encoder, Some(HashTableEntryCodec::String)));
}

#[test]
fn boolean_encoder_uses_direct_hash_and_equal() {
    assert_hash_equal_and_free(HashTableEntryCodec::Boolean, false);
}

#[test]
fn float_encoder_uses_double_hash_and_equal() {
    assert_hash_equal_and_free(HashTableEntryCodec::Float, true);
}

#[test]
fn encode_boolean_true() {
    let encoder = HashTableEntryCodec::Boolean;
    let value = Value::Boolean(true);

    let ptr = encoder.encode(&value).expect("encoding should succeed");

    assert_eq!(ptr as isize, 1);
}

#[test]
fn encode_boolean_false() {
    let encoder = HashTableEntryCodec::Boolean;
    let value = Value::Boolean(false);

    let ptr = encoder.encode(&value).expect("encoding should succeed");

    assert_eq!(ptr as isize, 0);
}

#[test]
fn encode_float_value() {
    let encoder = HashTableEntryCodec::Float;

    assert_encoded_float(
        &encoder,
        &Value::Number(std::f64::consts::PI),
        std::f64::consts::PI,
    );
    assert_encoded_float(&encoder, &Value::Number(-123.456), -123.456);
}

#[test]
fn ptr_to_value_boolean_false() {
    let codec = Codec::Boolean(BooleanCodec);
    let ptr = std::ptr::null_mut::<c_void>();

    let value =
        unsafe { codec.read(ReadSource::Value(ptr, "test")) }.expect("decoding should succeed");

    match value {
        Value::Boolean(false) => (),
        other => panic!("Expected Boolean(false), got {other:?}"),
    }
}

#[test]
fn ptr_to_value_boolean_nonzero_is_true() {
    assert_boolean_ptr_reads_true(42isize as *mut c_void);
}

#[test]
fn ptr_to_value_float() {
    let codec = Codec::Float(FloatCodec::F64);
    let float_val: f64 = std::f64::consts::E;
    let ptr = unsafe {
        let mem = glib::ffi::g_malloc(std::mem::size_of::<f64>()) as *mut f64;
        *mem = float_val;
        mem as *mut c_void
    };

    let value =
        unsafe { codec.read(ReadSource::Value(ptr, "test")) }.expect("decoding should succeed");

    match value {
        Value::Number(n) => assert!((n - std::f64::consts::E).abs() < f64::EPSILON),
        other => panic!("Expected Number, got {other:?}"),
    }

    unsafe { glib::ffi::g_free(ptr) };
}

#[test]
fn ptr_to_value_struct_null() {
    let codec = Codec::Struct(StructCodec {
        ownership: Ownership::Borrowed,
        size: Some(16),
        caller_allocated: false,
    });

    let value = unsafe { codec.read(ReadSource::Value(std::ptr::null_mut(), "test")) }
        .expect("decoding should succeed");

    match value {
        Value::Null => (),
        other => panic!("Expected Null, got {other:?}"),
    }
}

#[test]
fn ptr_to_value_struct_non_null() {
    helpers::run(|| {
        let codec = Codec::Struct(StructCodec {
            ownership: Ownership::Borrowed,
            size: Some(16),
            caller_allocated: false,
        });

        let ptr = unsafe { glib::ffi::g_malloc0(16) };

        let value =
            unsafe { codec.read(ReadSource::Value(ptr, "test")) }.expect("decoding should succeed");

        match value {
            Value::Object(_) => (),
            other => panic!("Expected Object, got {other:?}"),
        }

        unsafe { glib::ffi::g_free(ptr) };
    });
}

#[test]
fn hashtable_encode_decode_booleans() {
    helpers::run(|| {
        let ht_codec = boolean_boolean_ht();

        let input = Value::Array(vec![
            Value::Array(vec![Value::Boolean(true), Value::Boolean(false)]),
            Value::Array(vec![Value::Boolean(false), Value::Boolean(true)]),
        ]);

        let decoded = roundtrip(&ht_codec, &input);

        assert_kv_pairs(decoded, 2, |k, v| {
            assert!(matches!(k, Value::Boolean(_)));
            assert!(matches!(v, Value::Boolean(_)));
        });
    });
}

#[test]
fn hashtable_encode_decode_floats() {
    helpers::run(|| {
        let ht_codec = ht_codec(
            Codec::Integer(IntegerCodec::I32),
            Codec::Float(FloatCodec::F64),
            Ownership::Full,
        );

        let input = Value::Array(vec![
            Value::Array(vec![
                Value::Number(1.0),
                Value::Number(std::f64::consts::PI),
            ]),
            Value::Array(vec![Value::Number(2.0), Value::Number(std::f64::consts::E)]),
        ]);

        let decoded = roundtrip(&ht_codec, &input);

        assert_kv_pairs(decoded, 2, |k, v| {
            assert!(matches!(k, Value::Number(_)));
            assert!(matches!(v, Value::Number(_)));
        });
    });
}

#[test]
fn hashtable_encode_decode_string_to_boolean() {
    helpers::run(|| {
        let ht_codec = ht_codec(
            Codec::String(StringCodec {
                ownership: Ownership::Borrowed,
                length: None,
            }),
            Codec::Boolean(BooleanCodec),
            Ownership::Full,
        );

        let input = Value::Array(vec![
            Value::Array(vec![
                Value::String("enabled".to_string()),
                Value::Boolean(true),
            ]),
            Value::Array(vec![
                Value::String("disabled".to_string()),
                Value::Boolean(false),
            ]),
        ]);

        let decoded = roundtrip(&ht_codec, &input);

        assert_kv_pairs(decoded, 2, |k, v| {
            assert!(matches!(k, Value::String(_)));
            assert!(matches!(v, Value::Boolean(_)));
        });
    });
}

#[test]
fn hashtable_encode_decode_float_keys() {
    helpers::run(|| {
        let ht_codec = ht_codec(
            Codec::Float(FloatCodec::F64),
            Codec::Integer(IntegerCodec::I32),
            Ownership::Full,
        );

        let input = Value::Array(vec![
            Value::Array(vec![Value::Number(1.5), Value::Number(100.0)]),
            Value::Array(vec![Value::Number(2.5), Value::Number(200.0)]),
        ]);

        let decoded = roundtrip(&ht_codec, &input);

        match decoded {
            Value::Array(pairs) => {
                assert_eq!(pairs.len(), 2);
            }
            _ => panic!("Expected array"),
        }
    });
}

#[test]
fn hashtable_empty() {
    helpers::run(|| {
        let ht_codec = boolean_boolean_ht();

        let input = Value::Array(vec![]);

        let decoded = roundtrip(&ht_codec, &input);

        match decoded {
            Value::Array(pairs) => assert!(pairs.is_empty()),
            _ => panic!("Expected empty array"),
        }
    });
}

#[test]
fn hashtable_null_optional() {
    helpers::run(|| {
        let ht_codec = boolean_boolean_ht();

        let encoded = ht_codec
            .encode(&Value::Null)
            .expect("encoding should succeed");

        match encoded {
            Stash::Ptr(ptr) => assert!(ptr.is_null()),
            _ => panic!("Expected null pointer"),
        }
    });
}

#[test]
fn hashtable_borrowed_does_not_free() {
    helpers::run(|| {
        let ht_codec = ht_codec(
            Codec::Integer(IntegerCodec::I32),
            Codec::Integer(IntegerCodec::I32),
            Ownership::Borrowed,
        );

        let hash_table = helpers::make_integer_hash_table(&[(1, 100), (2, 200)]);

        let stash = Stash::Ptr(hash_table as *mut c_void);
        let decoded = ht_codec.decode(&stash).expect("decoding should succeed");

        match decoded {
            Value::Array(pairs) => assert_eq!(pairs.len(), 2),
            _ => panic!("Expected array"),
        }

        let size = unsafe { glib::ffi::g_hash_table_size(hash_table) };
        assert_eq!(size, 2);

        unsafe { glib::ffi::g_hash_table_unref(hash_table) };
    });
}

#[test]
fn float_memory_properly_freed_on_drop() {
    helpers::run(|| {
        let ht_codec = ht_codec(
            Codec::Float(FloatCodec::F64),
            Codec::Float(FloatCodec::F64),
            Ownership::Full,
        );

        let input = Value::Array(vec![
            Value::Array(vec![Value::Number(1.1), Value::Number(2.2)]),
            Value::Array(vec![Value::Number(3.3), Value::Number(4.4)]),
            Value::Array(vec![Value::Number(5.5), Value::Number(6.6)]),
        ]);

        let _ = roundtrip(&ht_codec, &input);
    });
}

#[test]
fn encoder_from_type_native_handle() {
    assert!(matches!(
        HashTableEntryCodec::from_codec(&struct_codec()),
        Some(HashTableEntryCodec::Handle(_))
    ));
}

#[test]
fn encoder_from_type_ptr_array() {
    let encoder = HashTableEntryCodec::from_codec(&gptrarray_codec());
    assert!(matches!(encoder, Some(HashTableEntryCodec::PtrArray(_))));
}

#[test]
fn integer_encoder_hash_equal_and_free() {
    assert_hash_equal_and_free(HashTableEntryCodec::Integer, false);
}

#[test]
fn string_encoder_hash_equal_and_free() {
    assert_hash_equal_and_free(HashTableEntryCodec::String, true);
}

#[test]
fn native_handle_encoder_hash_equal_and_free() {
    assert_hash_equal_and_free(HashTableEntryCodec::Handle(Box::new(struct_codec())), false);
}

#[test]
fn full_gobject_encoder_installs_unref_destroy() {
    let encoder = HashTableEntryCodec::Handle(Box::new(Codec::Object(ObjectCodec {
        ownership: Ownership::Full,
    })));
    assert!(encoder.free_func().unwrap().is_some());
}

#[test]
fn full_fundamental_encoder_installs_unref_destroy() {
    helpers::run(|| {
        let encoder = full_variant_fundamental_encoder("g_variant_ref_sink", "g_variant_unref");
        assert!(encoder.free_func().unwrap().is_some());
    });
}

#[test]
fn full_fundamental_encoder_without_ref_fn_installs_no_destroy() {
    helpers::run(|| {
        let encoder = full_variant_fundamental_encoder("", "");
        assert!(encoder.free_func().unwrap().is_none());
    });
}

#[test]
fn ptr_array_encoder_hash_equal_and_free() {
    assert_hash_equal_and_free(
        HashTableEntryCodec::PtrArray(Box::new(Codec::Integer(IntegerCodec::I32))),
        true,
    );
}

#[test]
fn encode_native_handle_value_null_and_wrong_type() {
    helpers::run(|| {
        let encoder = HashTableEntryCodec::Handle(Box::new(struct_codec()));
        let handle = boxed_handle();
        let ptr = encoder.encode(&Value::Object(handle.clone())).unwrap();
        assert_eq!(ptr, handle.as_ptr());

        assert!(encoder.encode(&Value::Null).unwrap().is_null());
        assert!(encoder.encode(&Value::Undefined).unwrap().is_null());
        assert!(encoder.encode(&Value::Number(1.0)).is_err());
    });
}

#[test]
fn encode_ptr_array_value_with_objects_and_nulls() {
    helpers::run(|| {
        let encoder = HashTableEntryCodec::PtrArray(Box::new(struct_codec()));
        let ptr = encoder
            .encode(&Value::Array(vec![
                Value::Object(boxed_handle()),
                Value::Null,
                Value::Undefined,
            ]))
            .unwrap();
        assert!(!ptr.is_null());
        unsafe { glib::ffi::g_ptr_array_unref(ptr as *mut glib::ffi::GPtrArray) };
    });
}

#[test]
fn ptr_array_value_freed_when_hashtable_storage_drops() {
    helpers::run(|| {
        let ht_codec = ht_codec(
            Codec::Integer(IntegerCodec::I32),
            gptrarray_codec(),
            Ownership::Borrowed,
        );
        let input = Value::Array(vec![Value::Array(vec![
            Value::Number(1.0),
            Value::Array(vec![Value::Object(boxed_handle())]),
        ])]);
        {
            let _encoded = ht_codec.encode(&input).unwrap();
        }
    });
}

#[test]
fn hashtable_encode_propagates_key_encoder_error() {
    helpers::run(|| {
        let ht_codec = boolean_boolean_ht();
        let input = Value::Array(vec![Value::Array(vec![
            Value::Number(1.0),
            Value::Boolean(true),
        ])]);
        assert!(ht_codec.encode(&input).is_err());
    });
}

#[test]
fn hashtable_decode_null_yields_empty_array() {
    let ht_codec = boolean_boolean_ht();
    let decoded = ht_codec.decode(&Stash::Ptr(std::ptr::null_mut())).unwrap();
    assert!(matches!(decoded, Value::Array(items) if items.is_empty()));
}

#[test]
fn hashtable_ptr_to_value_null_and_populated() {
    helpers::run(|| {
        let ht_codec = ht_codec(
            Codec::Integer(IntegerCodec::I32),
            Codec::Integer(IntegerCodec::I32),
            Ownership::Borrowed,
        );

        let empty =
            unsafe { ht_codec.read(ReadSource::Value(std::ptr::null_mut(), "ctx")) }.unwrap();
        assert!(matches!(empty, Value::Array(items) if items.is_empty()));

        let hash_table = helpers::make_integer_hash_table(&[(1, 10)]);
        let decoded =
            unsafe { ht_codec.read(ReadSource::Value(hash_table as *mut c_void, "ctx")) }.unwrap();
        assert!(matches!(decoded, Value::Array(items) if items.len() == 1));
        unsafe { glib::ffi::g_hash_table_unref(hash_table) };
    });
}

#[test]
fn hashtable_decode_full_ownership_from_pointer_unrefs() {
    helpers::run(|| {
        let ht_codec = ht_codec(
            Codec::Integer(IntegerCodec::I32),
            Codec::Integer(IntegerCodec::I32),
            Ownership::Full,
        );
        let hash_table = helpers::make_integer_hash_table(&[(3, 30)]);
        unsafe {
            glib::ffi::g_hash_table_ref(hash_table);
        }

        let decoded = ht_codec
            .decode(&Stash::Ptr(hash_table as *mut c_void))
            .unwrap();
        assert!(matches!(decoded, Value::Array(items) if items.len() == 1));

        let size = unsafe { glib::ffi::g_hash_table_size(hash_table) };
        assert_eq!(size, 1);

        unsafe { glib::ffi::g_hash_table_unref(hash_table) };
    });
}

#[test]
fn hashtable_encode_native_handle_keys_roundtrips() {
    helpers::run(|| {
        let ht_codec = ht_codec(
            struct_codec(),
            Codec::Integer(IntegerCodec::I32),
            Ownership::Full,
        );
        let input = Value::Array(vec![Value::Array(vec![
            Value::Object(boxed_handle()),
            Value::Number(5.0),
        ])]);
        let decoded = roundtrip(&ht_codec, &input);
        assert!(matches!(decoded, Value::Array(items) if items.len() == 1));
    });
}

#[test]
fn boolean_roundtrip_preserves_values() {
    helpers::run(|| {
        let ht_codec = ht_codec(
            Codec::Integer(IntegerCodec::I32),
            Codec::Boolean(BooleanCodec),
            Ownership::Full,
        );

        let input = Value::Array(vec![
            Value::Array(vec![Value::Number(0.0), Value::Boolean(true)]),
            Value::Array(vec![Value::Number(1.0), Value::Boolean(false)]),
        ]);

        let decoded = roundtrip(&ht_codec, &input);

        let Value::Array(pairs) = decoded else {
            panic!("Expected array")
        };

        let mut found_true = false;
        let mut found_false = false;

        for pair in pairs {
            let Value::Array(kv) = pair else {
                panic!("Expected array pair")
            };
            match &kv[1] {
                Value::Boolean(true) => found_true = true,
                Value::Boolean(false) => found_false = true,
                _ => panic!("Expected boolean"),
            }
        }

        assert!(found_true && found_false);
    });
}

#[test]
fn fundamental_value_unreffed_when_hashtable_storage_drops() {
    helpers::run(|| {
        let pspec = create_param_spec();
        let before = helpers::param_spec_refcount(pspec);

        let ht_codec = ht_codec(
            Codec::Integer(IntegerCodec::I32),
            param_spec_fundamental_codec(),
            Ownership::Borrowed,
        );
        let input = Value::Array(vec![Value::Array(vec![
            Value::Number(1.0),
            Value::Object(Handle::from_glib_borrow(pspec)),
        ])]);

        let encoded = ht_codec.encode(&input).expect("encoding should succeed");
        assert_eq!(helpers::param_spec_refcount(pspec), before + 1);

        drop(encoded);
        assert_eq!(helpers::param_spec_refcount(pspec), before);

        unsafe { glib::gobject_ffi::g_param_spec_unref(pspec.cast()) };
    });
}

#[test]
fn gobject_value_unreffed_when_hashtable_storage_drops() {
    helpers::run(|| {
        let (_obj, obj_ptr, before) = new_object_with_refcount();

        let ht_codec = ht_codec(
            Codec::Integer(IntegerCodec::I32),
            full_gobject_codec(),
            Ownership::Borrowed,
        );
        let input = Value::Array(vec![
            Value::Array(vec![
                Value::Number(1.0),
                Value::Object(Handle::from_glib_borrow(obj_ptr as *mut c_void)),
            ]),
            Value::Array(vec![Value::Number(2.0), Value::Null]),
        ]);

        let encoded = ht_codec.encode(&input).expect("encoding should succeed");
        assert_eq!(helpers::get_gobject_refcount(obj_ptr), before + 1);

        let Stash::Storage(storage) = &encoded else {
            panic!("Expected Storage ffi value")
        };
        let size =
            unsafe { glib::ffi::g_hash_table_size(storage.ptr() as *mut glib::ffi::GHashTable) };
        assert_eq!(size, 2);

        drop(encoded);
        assert_eq!(helpers::get_gobject_refcount(obj_ptr), before);
    });
}

#[test]
fn hashtable_encode_value_error_releases_transferred_gobject_key() {
    helpers::run(|| {
        let (_obj, obj_ptr, before) = new_object_with_refcount();

        let ht_codec = gobject_key_boolean_ht();
        let input = Value::Array(vec![Value::Array(vec![
            Value::Object(Handle::from_glib_borrow(obj_ptr as *mut c_void)),
            Value::Number(1.0),
        ])]);

        let err = ht_codec.encode(&input).expect_err("value encode must fail");
        assert!(err.to_string().contains("Expected boolean in GHashTable"));
        assert_eq!(helpers::get_gobject_refcount(obj_ptr), before);
    });
}

#[test]
fn hashtable_encode_value_error_frees_duplicated_string_key() {
    helpers::run(|| {
        let ht_codec = ht_codec(
            borrowed_string_codec(),
            Codec::Boolean(BooleanCodec),
            Ownership::Full,
        );
        let input = Value::Array(vec![Value::Array(vec![
            Value::String("orphaned-key".to_string()),
            Value::Number(1.0),
        ])]);

        let err = ht_codec.encode(&input).expect_err("value encode must fail");
        assert!(err.to_string().contains("Expected boolean in GHashTable"));
    });
}

#[test]
fn hashtable_encode_value_destroy_error_releases_string_key() {
    helpers::run(|| {
        let value_codec = Codec::Array(
            ArrayCodec::new(
                Box::new(full_boxed_codec()),
                ArrayKind::GPtrArray,
                Ownership::Borrowed,
                None,
                None,
                None,
            )
            .expect("valid gptrarray codec"),
        );
        let ht_codec = ht_codec(borrowed_string_codec(), value_codec, Ownership::Full);
        let input = Value::Array(vec![Value::Array(vec![
            Value::String("orphaned-key".to_string()),
            Value::Array(vec![]),
        ])]);

        let err = ht_codec
            .encode(&input)
            .expect_err("value destroy resolution must fail");
        assert!(err.to_string().contains("unsupported"));
    });
}

#[test]
fn hashtable_encode_second_tuple_error_unwinds_inserted_entries() {
    helpers::run(|| {
        let (_inserted, inserted_ptr, inserted_before) = new_object_with_refcount();
        let (_failing, failing_ptr, failing_before) = new_object_with_refcount();

        let ht_codec = gobject_key_boolean_ht();
        let input = Value::Array(vec![
            Value::Array(vec![
                Value::Object(Handle::from_glib_borrow(inserted_ptr as *mut c_void)),
                Value::Boolean(true),
            ]),
            Value::Array(vec![
                Value::Object(Handle::from_glib_borrow(failing_ptr as *mut c_void)),
                Value::Number(1.0),
            ]),
        ]);

        let err = ht_codec.encode(&input).expect_err("second tuple must fail");
        assert!(err.to_string().contains("Expected boolean in GHashTable"));
        assert_eq!(helpers::get_gobject_refcount(inserted_ptr), inserted_before);
        assert_eq!(helpers::get_gobject_refcount(failing_ptr), failing_before);
    });
}

fn string_hashtable_codec(ownership: Ownership) -> HashTableCodec {
    HashTableCodec {
        key_codec: Box::new(borrowed_string_codec()),
        value_codec: Box::new(borrowed_string_codec()),
        ownership,
    }
}

#[test]
fn write_return_to_pointer_full_table_hands_caller_owned_table() {
    helpers::run(|| {
        let codec = string_hashtable_codec(Ownership::Full);
        let val = Value::Array(vec![Value::Array(vec![
            Value::String("key".to_string()),
            Value::String("value".to_string()),
        ])]);
        let mut slot: *mut c_void = std::ptr::null_mut();
        let ret = &mut slot as *mut *mut c_void as *mut c_void;
        PtrWriter::write_return_to_ptr(&codec, unsafe { Slot::new(ret) }, &Ok(val));
        assert!(!slot.is_null());
        let table = slot as *mut glib::ffi::GHashTable;
        let size = unsafe { glib::ffi::g_hash_table_size(table) };
        assert_eq!(size, 1);
        unsafe { glib::ffi::g_hash_table_unref(table) };
    });
}

#[test]
fn write_return_to_pointer_null_err_and_non_array_write_null() {
    let codec = string_hashtable_codec(Ownership::Full);
    let mut slot: *mut c_void = 7 as *mut c_void;
    let ret = &mut slot as *mut *mut c_void as *mut c_void;
    PtrWriter::write_return_to_ptr(&codec, unsafe { Slot::new(ret) }, &Ok(Value::Null));
    assert!(slot.is_null());

    slot = 7 as *mut c_void;
    PtrWriter::write_return_to_ptr(&codec, unsafe { Slot::new(ret) }, &Err(()));
    assert!(slot.is_null());

    slot = 7 as *mut c_void;
    PtrWriter::write_return_to_ptr(&codec, unsafe { Slot::new(ret) }, &Ok(Value::Number(1.0)));
    assert!(slot.is_null());
}

#[test]
fn write_return_to_pointer_encode_error_writes_null() {
    helpers::run(|| {
        let codec = string_hashtable_codec(Ownership::Full);
        let val = Value::Array(vec![Value::String("not a tuple".to_string())]);
        let mut slot: *mut c_void = 7 as *mut c_void;
        let ret = &mut slot as *mut *mut c_void as *mut c_void;
        PtrWriter::write_return_to_ptr(&codec, unsafe { Slot::new(ret) }, &Ok(val));
        assert!(slot.is_null());
    });
}

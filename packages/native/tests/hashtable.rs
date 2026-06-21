mod common;

use std::ffi::c_void;

use gtk4::glib;
use gtk4::prelude::ObjectType as _;
use gtk4::prelude::StaticType as _;

use native::NativeHandle;
use native::ffi::FfiValue;
use native::types::{
    ArrayKind, ArrayType, BooleanType, BoxedType, FloatKind, FundamentalType, GObjectType,
    HashTableEntryEncoder, HashTableType, IntegerKind, Ownership, StringType, StructType, Type,
};
use native::types::{FfiDecoder, FfiEncoder, RawPtrCodec, ReadSource};
use native::value::Value;

fn struct_type() -> Type {
    Type::Struct(StructType {
        ownership: Ownership::Borrowed,
        size: Some(size_of::<gtk4::gdk::ffi::GdkRGBA>()),
        caller_allocated: false,
    })
}

fn gptrarray_type() -> Type {
    Type::Array(ArrayType {
        item_type: Box::new(struct_type()),
        kind: ArrayKind::GPtrArray,
        ownership: Ownership::Borrowed,
        element_size: None,
    })
}

fn boxed_handle() -> NativeHandle {
    let ptr = common::allocate_test_boxed(gtk4::gdk::RGBA::static_type());
    NativeHandle::borrowed(ptr)
}

fn full_boxed_type() -> Type {
    Type::Boxed(BoxedType {
        ownership: Ownership::Full,
        type_name: "GdkRGBA".to_string(),
        library: None,
        get_type_fn: None,
        free_fn: None,
        caller_allocated: false,
    })
}

fn borrowed_string_type() -> Type {
    Type::String(StringType {
        ownership: Ownership::Borrowed,
        length: None,
    })
}

fn full_gobject_type() -> Type {
    Type::GObject(GObjectType {
        ownership: Ownership::Full,
    })
}

fn full_variant_fundamental_encoder(ref_func: &str, unref_func: &str) -> HashTableEntryEncoder {
    HashTableEntryEncoder::NativeHandle(Box::new(Type::Fundamental(FundamentalType {
        ownership: Ownership::Full,
        library: "libglib-2.0.so.0".to_owned(),
        ref_func: ref_func.to_owned(),
        unref_func: unref_func.to_owned(),
        type_name: Some("GVariant".to_owned()),
    })))
}

fn param_spec_fundamental_type() -> Type {
    Type::Fundamental(FundamentalType {
        ownership: Ownership::Full,
        library: "libgobject-2.0.so.0".to_owned(),
        ref_func: "g_param_spec_ref".to_owned(),
        unref_func: "g_param_spec_unref".to_owned(),
        type_name: Some("GParam".to_owned()),
    })
}

fn create_param_spec() -> *mut c_void {
    // SAFETY: runs on the GTK-initialized test thread; the string arguments are valid static
    // NUL-terminated C strings and the flags are valid, so this returns a new owned GParamSpec.
    unsafe {
        glib::gobject_ffi::g_param_spec_boolean(
            c"ht-cov-param".as_ptr(),
            c"HtCov".as_ptr(),
            c"A hashtable coverage parameter".as_ptr(),
            glib::ffi::GFALSE,
            glib::gobject_ffi::G_PARAM_READABLE,
        ) as *mut c_void
    }
}

fn ht_type(key: Type, value: Type, ownership: Ownership) -> HashTableType {
    HashTableType {
        key_type: Box::new(key),
        value_type: Box::new(value),
        ownership,
    }
}

fn roundtrip(ht: &HashTableType, input: &Value) -> Value {
    let encoded = ht.encode(input).expect("encoding should succeed");
    ht.decode(&encoded).expect("decoding should succeed")
}

fn assert_encoded_float(encoder: &HashTableEntryEncoder, value: &Value, expected: f64) {
    let ptr = encoder.encode(value).expect("encoding should succeed");

    // SAFETY: `ptr` is the non-null encoded float pointer the entry encoder returned;
    // reinterpreting it as `*const f64` and reading through it yields the stored value.
    let stored_value = unsafe {
        *ptr.cast::<f64>()
            .as_ref()
            .expect("encoded float pointer should be non-null")
    };
    assert!((stored_value - expected).abs() < f64::EPSILON);

    // SAFETY: the pointer is the test-owned allocation from above; `g_free` releases it once.
    unsafe { glib::ffi::g_free(ptr) };
}

fn assert_boolean_ptr_reads_true(ptr: *mut c_void) {
    let ty = Type::Boolean(BooleanType);

    let value =
        // SAFETY: the pointer addresses a live value/container of the codec's type, valid for
        // this read.
        unsafe { ty.read(ReadSource::Value(ptr, "test")) }.expect("decoding should succeed");

    match value {
        Value::Boolean(true) => (),
        other => panic!("Expected Boolean(true), got {other:?}"),
    }
}

fn boolean_boolean_ht() -> HashTableType {
    ht_type(
        Type::Boolean(BooleanType),
        Type::Boolean(BooleanType),
        Ownership::Full,
    )
}

fn gobject_key_boolean_ht() -> HashTableType {
    ht_type(
        full_gobject_type(),
        Type::Boolean(BooleanType),
        Ownership::Full,
    )
}

fn new_object_with_refcount() -> (glib::Object, *mut glib::gobject_ffi::GObject, u32) {
    let obj = glib::Object::new::<glib::Object>();
    let obj_ptr = obj.as_ptr();
    let before = common::get_gobject_refcount(obj_ptr);
    (obj, obj_ptr, before)
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
    let ty = Type::Boolean(BooleanType);
    let encoder = HashTableEntryEncoder::from_type(&ty);
    assert!(matches!(encoder, Some(HashTableEntryEncoder::Boolean)));
}

#[test]
fn encoder_from_type_float() {
    let ty = Type::Float(FloatKind::F64);
    let encoder = HashTableEntryEncoder::from_type(&ty);
    assert!(matches!(encoder, Some(HashTableEntryEncoder::Float)));
}

#[test]
fn encoder_from_type_integer() {
    let ty = Type::Integer(IntegerKind::I32);
    let encoder = HashTableEntryEncoder::from_type(&ty);
    assert!(matches!(encoder, Some(HashTableEntryEncoder::Integer)));
}

#[test]
fn encoder_from_type_string() {
    let ty = Type::String(StringType {
        ownership: Ownership::Borrowed,
        length: None,
    });
    let encoder = HashTableEntryEncoder::from_type(&ty);
    assert!(matches!(encoder, Some(HashTableEntryEncoder::String)));
}

#[test]
fn boolean_encoder_uses_direct_hash_and_equal() {
    let encoder = HashTableEntryEncoder::Boolean;

    assert!(encoder.hash_func().is_some());
    assert!(encoder.equal_func().is_some());
    assert!(encoder.free_func().unwrap().is_none());
}

#[test]
fn float_encoder_uses_double_hash_and_equal() {
    let encoder = HashTableEntryEncoder::Float;

    assert!(encoder.hash_func().is_some());
    assert!(encoder.equal_func().is_some());
    assert!(encoder.free_func().unwrap().is_some());
}

#[test]
fn encode_boolean_true() {
    let encoder = HashTableEntryEncoder::Boolean;
    let value = Value::Boolean(true);

    let ptr = encoder.encode(&value).expect("encoding should succeed");

    assert_eq!(ptr as isize, 1);
}

#[test]
fn encode_boolean_false() {
    let encoder = HashTableEntryEncoder::Boolean;
    let value = Value::Boolean(false);

    let ptr = encoder.encode(&value).expect("encoding should succeed");

    assert_eq!(ptr as isize, 0);
}

#[test]
fn encode_float_value() {
    let encoder = HashTableEntryEncoder::Float;
    let value = Value::Number(std::f64::consts::PI);

    assert_encoded_float(&encoder, &value, std::f64::consts::PI);
}

#[test]
fn encode_float_negative() {
    let encoder = HashTableEntryEncoder::Float;
    let value = Value::Number(-123.456);

    assert_encoded_float(&encoder, &value, -123.456);
}

#[test]
fn ptr_to_value_boolean_true() {
    assert_boolean_ptr_reads_true(std::ptr::dangling_mut::<c_void>());
}

#[test]
fn ptr_to_value_boolean_false() {
    let ty = Type::Boolean(BooleanType);
    let ptr = std::ptr::null_mut::<c_void>();

    let value =
        // SAFETY: the pointer addresses a live value/container of the codec's type, valid for
        // this read.
        unsafe { ty.read(ReadSource::Value(ptr, "test")) }.expect("decoding should succeed");

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
    let ty = Type::Float(FloatKind::F64);
    let float_val: f64 = std::f64::consts::E;
    // SAFETY: `g_malloc` returns a block large enough for one `f64`, written through the
    // suitably aligned pointer; the test owns and later frees it.
    let ptr = unsafe {
        let mem = glib::ffi::g_malloc(std::mem::size_of::<f64>()) as *mut f64;
        *mem = float_val;
        mem as *mut c_void
    };

    let value =
        // SAFETY: the pointer addresses a live value/container of the codec's type, valid for
        // this read.
        unsafe { ty.read(ReadSource::Value(ptr, "test")) }.expect("decoding should succeed");

    match value {
        Value::Number(n) => assert!((n - std::f64::consts::E).abs() < f64::EPSILON),
        other => panic!("Expected Number, got {other:?}"),
    }

    // SAFETY: the pointer is the test-owned allocation from above; `g_free` releases it once.
    unsafe { glib::ffi::g_free(ptr) };
}

#[test]
fn ptr_to_value_struct_null() {
    let ty = Type::Struct(StructType {
        ownership: Ownership::Borrowed,
        size: Some(16),
        caller_allocated: false,
    });

    // SAFETY: a null pointer is the documented null case, decoded without dereferencing.
    let value = unsafe { ty.read(ReadSource::Value(std::ptr::null_mut(), "test")) }
        .expect("decoding should succeed");

    match value {
        Value::Null => (),
        other => panic!("Expected Null, got {other:?}"),
    }
}

#[test]
fn ptr_to_value_struct_non_null() {
    common::run(|| {
        let ty = Type::Struct(StructType {
            ownership: Ownership::Borrowed,
            size: Some(16),
            caller_allocated: false,
        });

        // SAFETY: the pointer addresses a live value/container of the codec's type, valid for
        // this read.
        let ptr = unsafe { glib::ffi::g_malloc0(16) };

        let value =
            // SAFETY: the pointer addresses a live value/container of the codec's type, valid for
            // this read.
            unsafe { ty.read(ReadSource::Value(ptr, "test")) }.expect("decoding should succeed");

        match value {
            Value::Object(_) => (),
            other => panic!("Expected Object, got {other:?}"),
        }

        // SAFETY: the pointer is the test-owned allocation from above; `g_free` releases it once.
        unsafe { glib::ffi::g_free(ptr) };
    });
}

#[test]
fn hashtable_encode_decode_booleans() {
    common::run(|| {
        let ht_type = boolean_boolean_ht();

        let input = Value::Array(vec![
            Value::Array(vec![Value::Boolean(true), Value::Boolean(false)]),
            Value::Array(vec![Value::Boolean(false), Value::Boolean(true)]),
        ]);

        let decoded = roundtrip(&ht_type, &input);

        assert_kv_pairs(decoded, 2, |k, v| {
            assert!(matches!(k, Value::Boolean(_)));
            assert!(matches!(v, Value::Boolean(_)));
        });
    });
}

#[test]
fn hashtable_encode_decode_floats() {
    common::run(|| {
        let ht_type = ht_type(
            Type::Integer(IntegerKind::I32),
            Type::Float(FloatKind::F64),
            Ownership::Full,
        );

        let input = Value::Array(vec![
            Value::Array(vec![
                Value::Number(1.0),
                Value::Number(std::f64::consts::PI),
            ]),
            Value::Array(vec![Value::Number(2.0), Value::Number(std::f64::consts::E)]),
        ]);

        let decoded = roundtrip(&ht_type, &input);

        assert_kv_pairs(decoded, 2, |k, v| {
            assert!(matches!(k, Value::Number(_)));
            assert!(matches!(v, Value::Number(_)));
        });
    });
}

#[test]
fn hashtable_encode_decode_string_to_boolean() {
    common::run(|| {
        let ht_type = ht_type(
            Type::String(StringType {
                ownership: Ownership::Borrowed,
                length: None,
            }),
            Type::Boolean(BooleanType),
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

        let decoded = roundtrip(&ht_type, &input);

        assert_kv_pairs(decoded, 2, |k, v| {
            assert!(matches!(k, Value::String(_)));
            assert!(matches!(v, Value::Boolean(_)));
        });
    });
}

#[test]
fn hashtable_encode_decode_float_keys() {
    common::run(|| {
        let ht_type = ht_type(
            Type::Float(FloatKind::F64),
            Type::Integer(IntegerKind::I32),
            Ownership::Full,
        );

        let input = Value::Array(vec![
            Value::Array(vec![Value::Number(1.5), Value::Number(100.0)]),
            Value::Array(vec![Value::Number(2.5), Value::Number(200.0)]),
        ]);

        let decoded = roundtrip(&ht_type, &input);

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
    common::run(|| {
        let ht_type = boolean_boolean_ht();

        let input = Value::Array(vec![]);

        let decoded = roundtrip(&ht_type, &input);

        match decoded {
            Value::Array(pairs) => assert!(pairs.is_empty()),
            _ => panic!("Expected empty array"),
        }
    });
}

#[test]
fn hashtable_null_optional() {
    common::run(|| {
        let ht_type = boolean_boolean_ht();

        let encoded = ht_type
            .encode(&Value::Null)
            .expect("encoding should succeed");

        match encoded {
            FfiValue::Ptr(ptr) => assert!(ptr.is_null()),
            _ => panic!("Expected null pointer"),
        }
    });
}

#[test]
fn hashtable_borrowed_does_not_free() {
    common::run(|| {
        let ht_type = ht_type(
            Type::Integer(IntegerKind::I32),
            Type::Integer(IntegerKind::I32),
            Ownership::Borrowed,
        );

        let hash_table = common::make_integer_hash_table(&[(1, 100), (2, 200)]);

        let ffi_value = FfiValue::Ptr(hash_table as *mut c_void);
        let decoded = ht_type.decode(&ffi_value).expect("decoding should succeed");

        match decoded {
            Value::Array(pairs) => assert_eq!(pairs.len(), 2),
            _ => panic!("Expected array"),
        }

        // SAFETY: `hash_table`/`table` is a valid GHashTable and the test holds the reference released here.
        let size = unsafe { glib::ffi::g_hash_table_size(hash_table) };
        assert_eq!(size, 2);

        // SAFETY: `hash_table`/`table` is a valid GHashTable and the test holds the reference released here.
        unsafe { glib::ffi::g_hash_table_unref(hash_table) };
    });
}

#[test]
fn float_memory_properly_freed_on_drop() {
    common::run(|| {
        let ht_type = ht_type(
            Type::Float(FloatKind::F64),
            Type::Float(FloatKind::F64),
            Ownership::Full,
        );

        let input = Value::Array(vec![
            Value::Array(vec![Value::Number(1.1), Value::Number(2.2)]),
            Value::Array(vec![Value::Number(3.3), Value::Number(4.4)]),
            Value::Array(vec![Value::Number(5.5), Value::Number(6.6)]),
        ]);

        let _ = roundtrip(&ht_type, &input);
    });
}

#[test]
fn encoder_from_type_native_handle() {
    assert!(matches!(
        HashTableEntryEncoder::from_type(&struct_type()),
        Some(HashTableEntryEncoder::NativeHandle(_))
    ));
}

#[test]
fn encoder_from_type_ptr_array() {
    let encoder = HashTableEntryEncoder::from_type(&gptrarray_type());
    assert!(matches!(encoder, Some(HashTableEntryEncoder::PtrArray(_))));
}

#[test]
fn integer_encoder_hash_equal_and_free() {
    let encoder = HashTableEntryEncoder::Integer;
    assert!(encoder.hash_func().is_some());
    assert!(encoder.equal_func().is_some());
    assert!(encoder.free_func().unwrap().is_none());
}

#[test]
fn string_encoder_hash_equal_and_free() {
    let encoder = HashTableEntryEncoder::String;
    assert!(encoder.hash_func().is_some());
    assert!(encoder.equal_func().is_some());
    assert!(encoder.free_func().unwrap().is_some());
}

#[test]
fn native_handle_encoder_hash_equal_and_free() {
    let encoder = HashTableEntryEncoder::NativeHandle(Box::new(struct_type()));
    assert!(encoder.hash_func().is_some());
    assert!(encoder.equal_func().is_some());
    assert!(encoder.free_func().unwrap().is_none());
}

#[test]
fn full_gobject_encoder_installs_unref_destroy() {
    let encoder = HashTableEntryEncoder::NativeHandle(Box::new(Type::GObject(GObjectType {
        ownership: Ownership::Full,
    })));
    assert!(encoder.free_func().unwrap().is_some());
}

#[test]
fn full_fundamental_encoder_installs_unref_destroy() {
    common::run(|| {
        let encoder = full_variant_fundamental_encoder("g_variant_ref_sink", "g_variant_unref");
        assert!(encoder.free_func().unwrap().is_some());
    });
}

#[test]
fn full_fundamental_encoder_without_ref_fn_installs_no_destroy() {
    common::run(|| {
        let encoder = full_variant_fundamental_encoder("", "");
        assert!(encoder.free_func().unwrap().is_none());
    });
}

#[test]
fn ptr_array_encoder_hash_equal_and_free() {
    let encoder = HashTableEntryEncoder::PtrArray(Box::new(Type::Integer(IntegerKind::I32)));
    assert!(encoder.hash_func().is_some());
    assert!(encoder.equal_func().is_some());
    assert!(encoder.free_func().unwrap().is_some());
}

#[test]
fn encode_native_handle_value_null_and_wrong_type() {
    common::run(|| {
        let encoder = HashTableEntryEncoder::NativeHandle(Box::new(struct_type()));
        let handle = boxed_handle();
        let ptr = encoder.encode(&Value::Object(handle.clone())).unwrap();
        assert_eq!(ptr, handle.ptr());

        assert!(encoder.encode(&Value::Null).unwrap().is_null());
        assert!(encoder.encode(&Value::Undefined).unwrap().is_null());
        assert!(encoder.encode(&Value::Number(1.0)).is_err());
    });
}

#[test]
fn encode_ptr_array_value_with_objects_and_nulls() {
    common::run(|| {
        let encoder = HashTableEntryEncoder::PtrArray(Box::new(struct_type()));
        let ptr = encoder
            .encode(&Value::Array(vec![
                Value::Object(boxed_handle()),
                Value::Null,
                Value::Undefined,
            ]))
            .unwrap();
        assert!(!ptr.is_null());
        // SAFETY: the GPtrArray is valid and the test holds the reference released here.
        unsafe { glib::ffi::g_ptr_array_unref(ptr as *mut glib::ffi::GPtrArray) };
    });
}

#[test]
fn ptr_array_value_freed_when_hashtable_storage_drops() {
    common::run(|| {
        let ht_type = ht_type(
            Type::Integer(IntegerKind::I32),
            gptrarray_type(),
            Ownership::Borrowed,
        );
        let input = Value::Array(vec![Value::Array(vec![
            Value::Number(1.0),
            Value::Array(vec![Value::Object(boxed_handle())]),
        ])]);
        {
            let _encoded = ht_type.encode(&input).unwrap();
        }
    });
}

#[test]
fn hashtable_encode_propagates_key_encoder_error() {
    common::run(|| {
        let ht_type = boolean_boolean_ht();
        let input = Value::Array(vec![Value::Array(vec![
            Value::Number(1.0),
            Value::Boolean(true),
        ])]);
        assert!(ht_type.encode(&input).is_err());
    });
}

#[test]
fn hashtable_decode_null_yields_empty_array() {
    let ht_type = boolean_boolean_ht();
    let decoded = ht_type
        .decode(&FfiValue::Ptr(std::ptr::null_mut()))
        .unwrap();
    assert!(matches!(decoded, Value::Array(items) if items.is_empty()));
}

#[test]
fn hashtable_ptr_to_value_null_and_populated() {
    common::run(|| {
        let ht_type = ht_type(
            Type::Integer(IntegerKind::I32),
            Type::Integer(IntegerKind::I32),
            Ownership::Borrowed,
        );

        let empty =
            // SAFETY: a null pointer is the documented null case, decoded without dereferencing.
            unsafe { ht_type.read(ReadSource::Value(std::ptr::null_mut(), "ctx")) }.unwrap();
        assert!(matches!(empty, Value::Array(items) if items.is_empty()));

        let hash_table = common::make_integer_hash_table(&[(1, 10)]);
        let decoded =
            // SAFETY: the pointer addresses a live value/container of the codec's type, valid for
            // this read.
            unsafe { ht_type.read(ReadSource::Value(hash_table as *mut c_void, "ctx")) }.unwrap();
        assert!(matches!(decoded, Value::Array(items) if items.len() == 1));
        // SAFETY: `hash_table`/`table` is a valid GHashTable and the test holds the reference released here.
        unsafe { glib::ffi::g_hash_table_unref(hash_table) };
    });
}

#[test]
fn hashtable_decode_full_ownership_from_raw_ptr_unrefs() {
    common::run(|| {
        let ht_type = ht_type(
            Type::Integer(IntegerKind::I32),
            Type::Integer(IntegerKind::I32),
            Ownership::Full,
        );
        let hash_table = common::make_integer_hash_table(&[(3, 30)]);
        // SAFETY: `hash_table` is a valid GHashTable; this takes one extra owning reference
        // matched by an unref below.
        unsafe {
            glib::ffi::g_hash_table_ref(hash_table);
        }

        let decoded = ht_type
            .decode(&FfiValue::Ptr(hash_table as *mut c_void))
            .unwrap();
        assert!(matches!(decoded, Value::Array(items) if items.len() == 1));

        // SAFETY: `hash_table`/`table` is a valid GHashTable and the test holds the reference released here.
        let size = unsafe { glib::ffi::g_hash_table_size(hash_table) };
        assert_eq!(size, 1);

        // SAFETY: `hash_table`/`table` is a valid GHashTable and the test holds the reference released here.
        unsafe { glib::ffi::g_hash_table_unref(hash_table) };
    });
}

#[test]
fn hashtable_encode_native_handle_keys_roundtrips() {
    common::run(|| {
        let ht_type = ht_type(
            struct_type(),
            Type::Integer(IntegerKind::I32),
            Ownership::Full,
        );
        let input = Value::Array(vec![Value::Array(vec![
            Value::Object(boxed_handle()),
            Value::Number(5.0),
        ])]);
        let decoded = roundtrip(&ht_type, &input);
        assert!(matches!(decoded, Value::Array(items) if items.len() == 1));
    });
}

#[test]
fn boolean_roundtrip_preserves_values() {
    common::run(|| {
        let ht_type = ht_type(
            Type::Integer(IntegerKind::I32),
            Type::Boolean(BooleanType),
            Ownership::Full,
        );

        let input = Value::Array(vec![
            Value::Array(vec![Value::Number(0.0), Value::Boolean(true)]),
            Value::Array(vec![Value::Number(1.0), Value::Boolean(false)]),
        ]);

        let decoded = roundtrip(&ht_type, &input);

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
    common::run(|| {
        let pspec = create_param_spec();
        let before = common::param_spec_refcount(pspec);

        let ht_type = ht_type(
            Type::Integer(IntegerKind::I32),
            param_spec_fundamental_type(),
            Ownership::Borrowed,
        );
        let input = Value::Array(vec![Value::Array(vec![
            Value::Number(1.0),
            Value::Object(NativeHandle::borrowed(pspec)),
        ])]);

        let encoded = ht_type.encode(&input).expect("encoding should succeed");
        assert_eq!(common::param_spec_refcount(pspec), before + 1);

        drop(encoded);
        assert_eq!(common::param_spec_refcount(pspec), before);

        // SAFETY: the GParamSpec is live and the test owns the reference released here.
        unsafe { glib::gobject_ffi::g_param_spec_unref(pspec.cast()) };
    });
}

#[test]
fn gobject_value_unreffed_when_hashtable_storage_drops() {
    common::run(|| {
        let (_obj, obj_ptr, before) = new_object_with_refcount();

        let ht_type = ht_type(
            Type::Integer(IntegerKind::I32),
            full_gobject_type(),
            Ownership::Borrowed,
        );
        let input = Value::Array(vec![
            Value::Array(vec![
                Value::Number(1.0),
                Value::Object(NativeHandle::borrowed(obj_ptr as *mut c_void)),
            ]),
            Value::Array(vec![Value::Number(2.0), Value::Null]),
        ]);

        let encoded = ht_type.encode(&input).expect("encoding should succeed");
        assert_eq!(common::get_gobject_refcount(obj_ptr), before + 1);

        let FfiValue::Storage(storage) = &encoded else {
            panic!("Expected Storage ffi value")
        };
        let size =
            // SAFETY: the argument is a valid GHashTable pointer; reading its size only inspects it.
            unsafe { glib::ffi::g_hash_table_size(storage.ptr() as *mut glib::ffi::GHashTable) };
        assert_eq!(size, 2);

        drop(encoded);
        assert_eq!(common::get_gobject_refcount(obj_ptr), before);
    });
}

#[test]
fn hashtable_encode_value_error_releases_transferred_gobject_key() {
    common::run(|| {
        let (_obj, obj_ptr, before) = new_object_with_refcount();

        let ht_type = gobject_key_boolean_ht();
        let input = Value::Array(vec![Value::Array(vec![
            Value::Object(NativeHandle::borrowed(obj_ptr as *mut c_void)),
            Value::Number(1.0),
        ])]);

        let err = ht_type.encode(&input).expect_err("value encode must fail");
        assert!(err.to_string().contains("Expected boolean in GHashTable"));
        assert_eq!(common::get_gobject_refcount(obj_ptr), before);
    });
}

#[test]
fn hashtable_encode_value_error_frees_duplicated_string_key() {
    common::run(|| {
        let ht_type = ht_type(
            borrowed_string_type(),
            Type::Boolean(BooleanType),
            Ownership::Full,
        );
        let input = Value::Array(vec![Value::Array(vec![
            Value::String("orphaned-key".to_string()),
            Value::Number(1.0),
        ])]);

        let err = ht_type.encode(&input).expect_err("value encode must fail");
        assert!(err.to_string().contains("Expected boolean in GHashTable"));
    });
}

#[test]
fn hashtable_encode_value_destroy_error_releases_string_key() {
    common::run(|| {
        let value_type = Type::Array(ArrayType {
            item_type: Box::new(full_boxed_type()),
            kind: ArrayKind::GPtrArray,
            ownership: Ownership::Borrowed,
            element_size: None,
        });
        let ht_type = ht_type(borrowed_string_type(), value_type, Ownership::Full);
        let input = Value::Array(vec![Value::Array(vec![
            Value::String("orphaned-key".to_string()),
            Value::Array(vec![]),
        ])]);

        let err = ht_type
            .encode(&input)
            .expect_err("value destroy resolution must fail");
        assert!(err.to_string().contains("unsupported"));
    });
}

#[test]
fn hashtable_encode_second_tuple_error_unwinds_inserted_entries() {
    common::run(|| {
        let (_inserted, inserted_ptr, inserted_before) = new_object_with_refcount();
        let (_failing, failing_ptr, failing_before) = new_object_with_refcount();

        let ht_type = gobject_key_boolean_ht();
        let input = Value::Array(vec![
            Value::Array(vec![
                Value::Object(NativeHandle::borrowed(inserted_ptr as *mut c_void)),
                Value::Boolean(true),
            ]),
            Value::Array(vec![
                Value::Object(NativeHandle::borrowed(failing_ptr as *mut c_void)),
                Value::Number(1.0),
            ]),
        ]);

        let err = ht_type.encode(&input).expect_err("second tuple must fail");
        assert!(err.to_string().contains("Expected boolean in GHashTable"));
        assert_eq!(common::get_gobject_refcount(inserted_ptr), inserted_before);
        assert_eq!(common::get_gobject_refcount(failing_ptr), failing_before);
    });
}

fn string_hashtable_type(ownership: Ownership) -> HashTableType {
    HashTableType {
        key_type: Box::new(borrowed_string_type()),
        value_type: Box::new(borrowed_string_type()),
        ownership,
    }
}

#[test]
fn write_return_to_raw_ptr_full_table_hands_caller_owned_table() {
    common::run(|| {
        let ty = string_hashtable_type(Ownership::Full);
        let val = Value::Array(vec![Value::Array(vec![
            Value::String("key".to_string()),
            Value::String("value".to_string()),
        ])]);
        let mut slot: *mut c_void = std::ptr::null_mut();
        let ret = &mut slot as *mut *mut c_void as *mut c_void;
        // SAFETY: `ret` is a live, pointer-sized stack slot; the call writes exactly one pointer
        // (or null) into it, read back after the call.
        unsafe { RawPtrCodec::write_return_to_raw_ptr(&ty, ret, &Ok(val)) };
        assert!(!slot.is_null());
        let table = slot as *mut glib::ffi::GHashTable;
        // SAFETY: `hash_table`/`table` is a valid GHashTable and the test holds the reference released here.
        let size = unsafe { glib::ffi::g_hash_table_size(table) };
        assert_eq!(size, 1);
        // SAFETY: `ret` is a live, pointer-sized stack slot; the call writes exactly one pointer
        // (or null) into it, read back after the call.
        unsafe { glib::ffi::g_hash_table_unref(table) };
    });
}

#[test]
fn write_return_to_raw_ptr_null_err_and_non_array_write_null() {
    let ty = string_hashtable_type(Ownership::Full);
    let mut slot: *mut c_void = 7 as *mut c_void;
    let ret = &mut slot as *mut *mut c_void as *mut c_void;
    // SAFETY: `ret` is a live, pointer-sized stack slot; the call writes exactly one pointer
    // (or null) into it, read back after the call.
    unsafe { RawPtrCodec::write_return_to_raw_ptr(&ty, ret, &Ok(Value::Null)) };
    assert!(slot.is_null());

    slot = 7 as *mut c_void;
    // SAFETY: `ret` is a live, pointer-sized stack slot; the call writes exactly one pointer
    // (or null) into it, read back after the call.
    unsafe { RawPtrCodec::write_return_to_raw_ptr(&ty, ret, &Err(())) };
    assert!(slot.is_null());

    slot = 7 as *mut c_void;
    // SAFETY: `ret` is a live, pointer-sized stack slot; the call writes exactly one pointer
    // (or null) into it, read back after the call.
    unsafe { RawPtrCodec::write_return_to_raw_ptr(&ty, ret, &Ok(Value::Number(1.0))) };
    assert!(slot.is_null());
}

#[test]
fn write_return_to_raw_ptr_encode_error_writes_null() {
    common::run(|| {
        let ty = string_hashtable_type(Ownership::Full);
        let val = Value::Array(vec![Value::String("not a tuple".to_string())]);
        let mut slot: *mut c_void = 7 as *mut c_void;
        let ret = &mut slot as *mut *mut c_void as *mut c_void;
        // SAFETY: `ret` is a live, pointer-sized stack slot; the call writes exactly one pointer
        // (or null) into it, read back after the call.
        unsafe { RawPtrCodec::write_return_to_raw_ptr(&ty, ret, &Ok(val)) };
        assert!(slot.is_null());
    });
}

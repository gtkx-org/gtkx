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
    VoidType,
};
use native::types::{FfiDecoder, FfiEncoder, RawPtrCodec};
use native::value::Value;

fn struct_type() -> Type {
    Type::Struct(StructType {
        ownership: Ownership::Borrowed,
        size: Some(size_of::<gtk4::gdk::ffi::GdkRGBA>()),
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
    // SAFETY: Creating a GParamSpec from static NUL-terminated literals has
    // no pointer preconditions.
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
    let encoded = ht.encode(input, false).expect("encoding should succeed");
    ht.decode(&encoded).expect("decoding should succeed")
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
fn encode_boolean_wrong_type_fails() {
    let encoder = HashTableEntryEncoder::Boolean;
    let value = Value::String("not a boolean".to_string());

    let result = encoder.encode(&value);

    assert!(result.is_err());
}

#[test]
fn encode_float_value() {
    let encoder = HashTableEntryEncoder::Float;
    let value = Value::Number(std::f64::consts::PI);

    let ptr = encoder.encode(&value).expect("encoding should succeed");

    // SAFETY: The encoder returned a live g_malloc'd f64 box.
    let stored_value = unsafe {
        *ptr.cast::<f64>()
            .as_ref()
            .expect("encoded float pointer should be non-null")
    };
    assert!((stored_value - std::f64::consts::PI).abs() < f64::EPSILON);

    // SAFETY: Frees the allocation this test owns.
    unsafe { glib::ffi::g_free(ptr) };
}

#[test]
fn encode_float_negative() {
    let encoder = HashTableEntryEncoder::Float;
    let value = Value::Number(-123.456);

    let ptr = encoder.encode(&value).expect("encoding should succeed");

    // SAFETY: The encoder returned a live g_malloc'd f64 box.
    let stored_value = unsafe {
        *ptr.cast::<f64>()
            .as_ref()
            .expect("encoded float pointer should be non-null")
    };
    assert!((stored_value - (-123.456)).abs() < f64::EPSILON);

    // SAFETY: Frees the allocation this test owns.
    unsafe { glib::ffi::g_free(ptr) };
}

#[test]
fn encode_float_wrong_type_fails() {
    let encoder = HashTableEntryEncoder::Float;
    let value = Value::Boolean(true);

    let result = encoder.encode(&value);

    assert!(result.is_err());
}

#[test]
fn ptr_to_value_boolean_true() {
    let ty = Type::Boolean(BooleanType);
    let ptr = std::ptr::dangling_mut::<c_void>();

    // SAFETY: BooleanType reinterprets the pointer value without
    // dereferencing it.
    let value = unsafe { ty.ptr_to_value(ptr, "test") }.expect("decoding should succeed");

    match value {
        Value::Boolean(true) => (),
        other => panic!("Expected Boolean(true), got {other:?}"),
    }
}

#[test]
fn ptr_to_value_boolean_false() {
    let ty = Type::Boolean(BooleanType);
    let ptr = std::ptr::null_mut::<c_void>();

    // SAFETY: BooleanType reinterprets the pointer value without
    // dereferencing it.
    let value = unsafe { ty.ptr_to_value(ptr, "test") }.expect("decoding should succeed");

    match value {
        Value::Boolean(false) => (),
        other => panic!("Expected Boolean(false), got {other:?}"),
    }
}

#[test]
fn ptr_to_value_boolean_nonzero_is_true() {
    let ty = Type::Boolean(BooleanType);
    let ptr = 42isize as *mut c_void;

    // SAFETY: BooleanType reinterprets the pointer value without
    // dereferencing it.
    let value = unsafe { ty.ptr_to_value(ptr, "test") }.expect("decoding should succeed");

    match value {
        Value::Boolean(true) => (),
        other => panic!("Expected Boolean(true), got {other:?}"),
    }
}

#[test]
fn ptr_to_value_float() {
    let ty = Type::Float(FloatKind::F64);
    let float_val: f64 = std::f64::consts::E;
    // SAFETY: g_malloc aborts on failure, so the write targets a valid f64 slot.
    let ptr = unsafe {
        let mem = glib::ffi::g_malloc(std::mem::size_of::<f64>()) as *mut f64;
        *mem = float_val;
        mem as *mut c_void
    };

    // SAFETY: `ptr` addresses a live g_malloc'd f64.
    let value = unsafe { ty.ptr_to_value(ptr, "test") }.expect("decoding should succeed");

    match value {
        Value::Number(n) => assert!((n - std::f64::consts::E).abs() < f64::EPSILON),
        other => panic!("Expected Number, got {other:?}"),
    }

    // SAFETY: Frees the allocation this test owns.
    unsafe { glib::ffi::g_free(ptr) };
}

#[test]
fn ptr_to_value_struct_null() {
    let ty = Type::Struct(StructType {
        ownership: Ownership::Borrowed,
        size: Some(16),
    });

    // SAFETY: Null short-circuits before any read.
    let value =
        unsafe { ty.ptr_to_value(std::ptr::null_mut(), "test") }.expect("decoding should succeed");

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
        });

        // SAFETY: Allocating zeroed memory has no pointer preconditions.
        let ptr = unsafe { glib::ffi::g_malloc0(16) };

        // SAFETY: `ptr` addresses a live 16-byte allocation.
        let value = unsafe { ty.ptr_to_value(ptr, "test") }.expect("decoding should succeed");

        match value {
            Value::Object(_) => (),
            other => panic!("Expected Object, got {other:?}"),
        }

        // SAFETY: Frees the allocation this test owns.
        unsafe { glib::ffi::g_free(ptr) };
    });
}

#[test]
fn hashtable_encode_decode_booleans() {
    common::run(|| {
        let ht_type = ht_type(
            Type::Boolean(BooleanType),
            Type::Boolean(BooleanType),
            Ownership::Full,
        );

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
        let ht_type = ht_type(
            Type::Boolean(BooleanType),
            Type::Boolean(BooleanType),
            Ownership::Full,
        );

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
        let ht_type = ht_type(
            Type::Boolean(BooleanType),
            Type::Boolean(BooleanType),
            Ownership::Full,
        );

        let encoded = ht_type
            .encode(&Value::Null, true)
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

        // SAFETY: `hash_table` is a live GHashTable.
        let size = unsafe { glib::ffi::g_hash_table_size(hash_table) };
        assert_eq!(size, 2);

        // SAFETY: Releases a reference this test owns on the live GHashTable.
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
fn encoder_from_type_unsupported_returns_none() {
    assert!(HashTableEntryEncoder::from_type(&Type::Void(VoidType)).is_none());
    let non_ptr_array = Type::Array(ArrayType {
        item_type: Box::new(Type::Integer(IntegerKind::I32)),
        kind: ArrayKind::Array,
        ownership: Ownership::Full,
        element_size: None,
    });
    assert!(HashTableEntryEncoder::from_type(&non_ptr_array).is_none());
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
fn full_boxed_encoder_rejects_destroy() {
    let encoder = HashTableEntryEncoder::NativeHandle(Box::new(full_boxed_type()));
    let err = encoder
        .free_func()
        .expect_err("full-ownership boxed elements must be rejected");
    assert!(err.to_string().contains("unsupported"));
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
fn full_fundamental_encoder_without_unref_fn_rejects_destroy() {
    common::run(|| {
        let encoder = full_variant_fundamental_encoder("g_variant_ref_sink", "");
        let err = encoder
            .free_func()
            .expect_err("a ref function without an unref function must be rejected");
        assert!(err.to_string().contains("declares no unref function"));
    });
}

#[test]
fn full_fundamental_encoder_with_unknown_ref_symbol_fails() {
    common::run(|| {
        let encoder =
            full_variant_fundamental_encoder("gtkx_nonexistent_ref_symbol", "g_variant_unref");
        let err = encoder
            .free_func()
            .expect_err("an unresolvable ref symbol must fail destroy resolution");
        assert!(err.to_string().contains("Failed to find ref symbol"));
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
fn encode_string_value_and_wrong_type() {
    common::run(|| {
        let encoder = HashTableEntryEncoder::String;
        let ptr = encoder.encode(&Value::String("hi".to_string())).unwrap();
        assert!(!ptr.is_null());
        // SAFETY: Frees the allocation this test owns.
        unsafe { glib::ffi::g_free(ptr) };

        assert!(encoder.encode(&Value::Number(1.0)).is_err());
    });
}

#[test]
fn encode_integer_value_and_wrong_type() {
    let encoder = HashTableEntryEncoder::Integer;
    let ptr = encoder.encode(&Value::Number(7.0)).unwrap();
    assert_eq!(ptr as isize, 7);

    assert!(encoder.encode(&Value::Boolean(true)).is_err());
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
        // SAFETY: Releases the reference this test owns on the live GPtrArray.
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
            let _encoded = ht_type.encode(&input, false).unwrap();
        }
    });
}

#[test]
fn encode_ptr_array_rejects_non_array() {
    let encoder = HashTableEntryEncoder::PtrArray(Box::new(struct_type()));
    assert!(encoder.encode(&Value::Number(1.0)).is_err());
}

#[test]
fn encode_ptr_array_rejects_non_object_item() {
    let encoder = HashTableEntryEncoder::PtrArray(Box::new(struct_type()));
    assert!(
        encoder
            .encode(&Value::Array(vec![Value::Number(1.0)]))
            .is_err()
    );
}

#[test]
fn encoder_debug_and_clone() {
    let encoder = HashTableEntryEncoder::PtrArray(Box::new(Type::Integer(IntegerKind::I32)));
    let cloned = Clone::clone(&encoder);
    assert!(format!("{cloned:?}").contains("PtrArray"));
}

#[test]
fn hashtable_encode_rejects_non_array() {
    let ht_type = ht_type(
        Type::Boolean(BooleanType),
        Type::Boolean(BooleanType),
        Ownership::Full,
    );
    assert!(ht_type.encode(&Value::Number(1.0), false).is_err());
}

#[test]
fn hashtable_encode_rejects_unsupported_key_type() {
    let ht_type = ht_type(
        Type::Void(VoidType),
        Type::Boolean(BooleanType),
        Ownership::Full,
    );
    assert!(ht_type.encode(&Value::Array(vec![]), false).is_err());
}

#[test]
fn hashtable_encode_rejects_unsupported_value_type() {
    let ht_type = ht_type(
        Type::Boolean(BooleanType),
        Type::Void(VoidType),
        Ownership::Full,
    );
    assert!(ht_type.encode(&Value::Array(vec![]), false).is_err());
}

#[test]
fn hashtable_encode_rejects_non_tuple_entry() {
    common::run(|| {
        let ht_type = ht_type(
            Type::Boolean(BooleanType),
            Type::Boolean(BooleanType),
            Ownership::Full,
        );
        let input = Value::Array(vec![Value::Array(vec![Value::Boolean(true)])]);
        assert!(ht_type.encode(&input, false).is_err());
    });
}

#[test]
fn hashtable_encode_propagates_key_encoder_error() {
    common::run(|| {
        let ht_type = ht_type(
            Type::Boolean(BooleanType),
            Type::Boolean(BooleanType),
            Ownership::Full,
        );
        let input = Value::Array(vec![Value::Array(vec![
            Value::Number(1.0),
            Value::Boolean(true),
        ])]);
        assert!(ht_type.encode(&input, false).is_err());
    });
}

#[test]
fn hashtable_decode_null_yields_empty_array() {
    let ht_type = ht_type(
        Type::Boolean(BooleanType),
        Type::Boolean(BooleanType),
        Ownership::Full,
    );
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

        // SAFETY: Null short-circuits before any read.
        let empty = unsafe { ht_type.ptr_to_value(std::ptr::null_mut(), "ctx") }.unwrap();
        assert!(matches!(empty, Value::Array(items) if items.is_empty()));

        let hash_table = common::make_integer_hash_table(&[(1, 10)]);
        // SAFETY: `hash_table` is a live GHashTable.
        let decoded = unsafe { ht_type.ptr_to_value(hash_table as *mut c_void, "ctx") }.unwrap();
        assert!(matches!(decoded, Value::Array(items) if items.len() == 1));
        // SAFETY: Releases a reference this test owns on the live GHashTable.
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
        // SAFETY: `hash_table` is a live GHashTable created by this test.
        unsafe {
            glib::ffi::g_hash_table_ref(hash_table);
        }

        let decoded = ht_type
            .decode(&FfiValue::Ptr(hash_table as *mut c_void))
            .unwrap();
        assert!(matches!(decoded, Value::Array(items) if items.len() == 1));

        // SAFETY: `hash_table` is a live GHashTable.
        let size = unsafe { glib::ffi::g_hash_table_size(hash_table) };
        assert_eq!(size, 1);

        // SAFETY: Releases a reference this test owns on the live GHashTable.
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

        let encoded = ht_type
            .encode(&input, false)
            .expect("encoding should succeed");
        assert_eq!(common::param_spec_refcount(pspec), before + 1);

        drop(encoded);
        assert_eq!(common::param_spec_refcount(pspec), before);

        // SAFETY: Releases the reference this test owns on the live GParamSpec.
        unsafe { glib::gobject_ffi::g_param_spec_unref(pspec.cast()) };
    });
}

#[test]
fn gobject_value_unreffed_when_hashtable_storage_drops() {
    common::run(|| {
        let obj = glib::Object::new::<glib::Object>();
        let obj_ptr = obj.as_ptr();
        let before = common::get_gobject_refcount(obj_ptr);

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

        let encoded = ht_type
            .encode(&input, false)
            .expect("encoding should succeed");
        assert_eq!(common::get_gobject_refcount(obj_ptr), before + 1);

        let FfiValue::Storage(storage) = &encoded else {
            panic!("Expected Storage ffi value")
        };
        // SAFETY: `storage.ptr()` is the live GHashTable the encode built.
        let size =
            unsafe { glib::ffi::g_hash_table_size(storage.ptr() as *mut glib::ffi::GHashTable) };
        assert_eq!(size, 2);

        drop(encoded);
        assert_eq!(common::get_gobject_refcount(obj_ptr), before);
    });
}

#[test]
fn hashtable_encode_value_error_releases_transferred_gobject_key() {
    common::run(|| {
        let obj = glib::Object::new::<glib::Object>();
        let obj_ptr = obj.as_ptr();
        let before = common::get_gobject_refcount(obj_ptr);

        let ht_type = ht_type(
            full_gobject_type(),
            Type::Boolean(BooleanType),
            Ownership::Full,
        );
        let input = Value::Array(vec![Value::Array(vec![
            Value::Object(NativeHandle::borrowed(obj_ptr as *mut c_void)),
            Value::Number(1.0),
        ])]);

        let err = ht_type
            .encode(&input, false)
            .expect_err("value encode must fail");
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

        let err = ht_type
            .encode(&input, false)
            .expect_err("value encode must fail");
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
            .encode(&input, false)
            .expect_err("value destroy resolution must fail");
        assert!(err.to_string().contains("unsupported"));
    });
}

#[test]
fn hashtable_encode_second_tuple_error_unwinds_inserted_entries() {
    common::run(|| {
        let inserted = glib::Object::new::<glib::Object>();
        let inserted_ptr = inserted.as_ptr();
        let failing = glib::Object::new::<glib::Object>();
        let failing_ptr = failing.as_ptr();
        let inserted_before = common::get_gobject_refcount(inserted_ptr);
        let failing_before = common::get_gobject_refcount(failing_ptr);

        let ht_type = ht_type(
            full_gobject_type(),
            Type::Boolean(BooleanType),
            Ownership::Full,
        );
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

        let err = ht_type
            .encode(&input, false)
            .expect_err("second tuple must fail");
        assert!(err.to_string().contains("Expected boolean in GHashTable"));
        assert_eq!(common::get_gobject_refcount(inserted_ptr), inserted_before);
        assert_eq!(common::get_gobject_refcount(failing_ptr), failing_before);
    });
}

mod common;

use std::ffi::c_void;

use gtk4::glib;

use native::ffi::{FfiDecode as _, FfiEncode as _, FfiValue, HashTableStorage};
use native::types::{
    FloatKind, HashTableEntryEncoder, HashTableType, IntegerKind, IntegerType, Ownership,
    StringType, StructType, Type,
};
use native::value::Value;

#[test]
fn encoder_from_type_boolean() {
    let ty = Type::Boolean;
    let encoder = HashTableEntryEncoder::from_type(&ty);
    assert_eq!(encoder, Some(HashTableEntryEncoder::Boolean));
}

#[test]
fn encoder_from_type_float() {
    let ty = Type::Float(FloatKind::F64);
    let encoder = HashTableEntryEncoder::from_type(&ty);
    assert_eq!(encoder, Some(HashTableEntryEncoder::Float));
}

#[test]
fn encoder_from_type_integer() {
    let ty = Type::Integer(IntegerType::from(IntegerKind::I32));
    let encoder = HashTableEntryEncoder::from_type(&ty);
    assert_eq!(encoder, Some(HashTableEntryEncoder::Integer));
}

#[test]
fn encoder_from_type_string() {
    let ty = Type::String(StringType::new(Ownership::Borrowed));
    let encoder = HashTableEntryEncoder::from_type(&ty);
    assert_eq!(encoder, Some(HashTableEntryEncoder::String));
}

#[test]
fn boolean_encoder_uses_direct_hash_and_equal() {
    let encoder = HashTableEntryEncoder::Boolean;

    assert!(encoder.hash_func().is_some());
    assert!(encoder.equal_func().is_some());
    assert!(encoder.free_func().is_none());
}

#[test]
fn float_encoder_uses_double_hash_and_equal() {
    let encoder = HashTableEntryEncoder::Float;

    assert!(encoder.hash_func().is_some());
    assert!(encoder.equal_func().is_some());
    assert!(encoder.free_func().is_some());
}

#[test]
fn encode_boolean_true() {
    let encoder = HashTableEntryEncoder::Boolean;
    let value = Value::Boolean(true);

    let (ptr, storage) = encoder.encode(&value).expect("encoding should succeed");

    assert_eq!(ptr as isize, 1);
    assert!(matches!(storage, HashTableStorage::Booleans));
}

#[test]
fn encode_boolean_false() {
    let encoder = HashTableEntryEncoder::Boolean;
    let value = Value::Boolean(false);

    let (ptr, storage) = encoder.encode(&value).expect("encoding should succeed");

    assert_eq!(ptr as isize, 0);
    assert!(matches!(storage, HashTableStorage::Booleans));
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
    let value = Value::Number(3.14159);

    let (ptr, storage) = encoder.encode(&value).expect("encoding should succeed");

    assert!(!ptr.is_null());
    assert!(matches!(storage, HashTableStorage::Floats));

    let stored_value = unsafe { *(ptr as *const f64) };
    assert!((stored_value - 3.14159).abs() < f64::EPSILON);

    unsafe { glib::ffi::g_free(ptr) };
}

#[test]
fn encode_float_negative() {
    let encoder = HashTableEntryEncoder::Float;
    let value = Value::Number(-123.456);

    let (ptr, storage) = encoder.encode(&value).expect("encoding should succeed");

    let stored_value = unsafe { *(ptr as *const f64) };
    assert!((stored_value - (-123.456)).abs() < f64::EPSILON);
    assert!(matches!(storage, HashTableStorage::Floats));

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
    let ty = Type::Boolean;
    let ptr = 1isize as *mut c_void;

    let value = ty
        .ptr_to_value(ptr, "test")
        .expect("decoding should succeed");

    match value {
        Value::Boolean(true) => (),
        other => panic!("Expected Boolean(true), got {:?}", other),
    }
}

#[test]
fn ptr_to_value_boolean_false() {
    let ty = Type::Boolean;
    let ptr = 0isize as *mut c_void;

    let value = ty
        .ptr_to_value(ptr, "test")
        .expect("decoding should succeed");

    match value {
        Value::Boolean(false) => (),
        other => panic!("Expected Boolean(false), got {:?}", other),
    }
}

#[test]
fn ptr_to_value_boolean_nonzero_is_true() {
    let ty = Type::Boolean;
    let ptr = 42isize as *mut c_void;

    let value = ty
        .ptr_to_value(ptr, "test")
        .expect("decoding should succeed");

    match value {
        Value::Boolean(true) => (),
        other => panic!("Expected Boolean(true), got {:?}", other),
    }
}

#[test]
fn ptr_to_value_float() {
    let ty = Type::Float(FloatKind::F64);
    let float_val: f64 = 2.71828;
    let ptr = unsafe {
        let mem = glib::ffi::g_malloc(std::mem::size_of::<f64>()) as *mut f64;
        *mem = float_val;
        mem as *mut c_void
    };

    let value = ty
        .ptr_to_value(ptr, "test")
        .expect("decoding should succeed");

    match value {
        Value::Number(n) => assert!((n - 2.71828).abs() < f64::EPSILON),
        other => panic!("Expected Number, got {:?}", other),
    }

    unsafe { glib::ffi::g_free(ptr) };
}

#[test]
fn ptr_to_value_struct_null() {
    let ty = Type::Struct(StructType::new(
        Ownership::Borrowed,
        "TestStruct".to_string(),
        Some(16),
    ));

    let value = ty
        .ptr_to_value(std::ptr::null_mut(), "test")
        .expect("decoding should succeed");

    match value {
        Value::Null => (),
        other => panic!("Expected Null, got {:?}", other),
    }
}

#[test]
fn ptr_to_value_struct_non_null() {
    common::ensure_gtk_init();

    let ty = Type::Struct(StructType::new(
        Ownership::Borrowed,
        "TestStruct".to_string(),
        Some(16),
    ));

    let ptr = unsafe { glib::ffi::g_malloc0(16) };

    let value = ty
        .ptr_to_value(ptr, "test")
        .expect("decoding should succeed");

    match value {
        Value::Object(_) => (),
        other => panic!("Expected Object, got {:?}", other),
    }

    unsafe { glib::ffi::g_free(ptr) };
}

#[test]
fn hashtable_encode_decode_booleans() {
    common::ensure_gtk_init();

    let key_type = Type::Boolean;
    let value_type = Type::Boolean;
    let ht_type = HashTableType::new(key_type, value_type, Ownership::Full);

    let input = Value::Array(vec![
        Value::Array(vec![Value::Boolean(true), Value::Boolean(false)]),
        Value::Array(vec![Value::Boolean(false), Value::Boolean(true)]),
    ]);

    let encoded = ht_type
        .encode(&input, false)
        .expect("encoding should succeed");
    let decoded = ht_type.decode(&encoded).expect("decoding should succeed");

    match decoded {
        Value::Array(pairs) => {
            assert_eq!(pairs.len(), 2);
            for pair in pairs {
                match pair {
                    Value::Array(kv) => {
                        assert_eq!(kv.len(), 2);
                        assert!(matches!(kv[0], Value::Boolean(_)));
                        assert!(matches!(kv[1], Value::Boolean(_)));
                    }
                    _ => panic!("Expected array pair"),
                }
            }
        }
        _ => panic!("Expected array"),
    }
}

#[test]
fn hashtable_encode_decode_floats() {
    common::ensure_gtk_init();

    let key_type = Type::Integer(IntegerType::from(IntegerKind::I32));
    let value_type = Type::Float(FloatKind::F64);
    let ht_type = HashTableType::new(key_type, value_type, Ownership::Full);

    let input = Value::Array(vec![
        Value::Array(vec![Value::Number(1.0), Value::Number(3.14159)]),
        Value::Array(vec![Value::Number(2.0), Value::Number(2.71828)]),
    ]);

    let encoded = ht_type
        .encode(&input, false)
        .expect("encoding should succeed");
    let decoded = ht_type.decode(&encoded).expect("decoding should succeed");

    match decoded {
        Value::Array(pairs) => {
            assert_eq!(pairs.len(), 2);
            for pair in pairs {
                match pair {
                    Value::Array(kv) => {
                        assert_eq!(kv.len(), 2);
                        assert!(matches!(kv[0], Value::Number(_)));
                        assert!(matches!(kv[1], Value::Number(_)));
                    }
                    _ => panic!("Expected array pair"),
                }
            }
        }
        _ => panic!("Expected array"),
    }
}

#[test]
fn hashtable_encode_decode_string_to_boolean() {
    common::ensure_gtk_init();

    let key_type = Type::String(StringType::new(Ownership::Borrowed));
    let value_type = Type::Boolean;
    let ht_type = HashTableType::new(key_type, value_type, Ownership::Full);

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

    let encoded = ht_type
        .encode(&input, false)
        .expect("encoding should succeed");
    let decoded = ht_type.decode(&encoded).expect("decoding should succeed");

    match decoded {
        Value::Array(pairs) => {
            assert_eq!(pairs.len(), 2);
            for pair in pairs {
                match pair {
                    Value::Array(kv) => {
                        assert_eq!(kv.len(), 2);
                        assert!(matches!(kv[0], Value::String(_)));
                        assert!(matches!(kv[1], Value::Boolean(_)));
                    }
                    _ => panic!("Expected array pair"),
                }
            }
        }
        _ => panic!("Expected array"),
    }
}

#[test]
fn hashtable_encode_decode_float_keys() {
    common::ensure_gtk_init();

    let key_type = Type::Float(FloatKind::F64);
    let value_type = Type::Integer(IntegerType::from(IntegerKind::I32));
    let ht_type = HashTableType::new(key_type, value_type, Ownership::Full);

    let input = Value::Array(vec![
        Value::Array(vec![Value::Number(1.5), Value::Number(100.0)]),
        Value::Array(vec![Value::Number(2.5), Value::Number(200.0)]),
    ]);

    let encoded = ht_type
        .encode(&input, false)
        .expect("encoding should succeed");
    let decoded = ht_type.decode(&encoded).expect("decoding should succeed");

    match decoded {
        Value::Array(pairs) => {
            assert_eq!(pairs.len(), 2);
        }
        _ => panic!("Expected array"),
    }
}

#[test]
fn hashtable_empty() {
    common::ensure_gtk_init();

    let key_type = Type::Boolean;
    let value_type = Type::Boolean;
    let ht_type = HashTableType::new(key_type, value_type, Ownership::Full);

    let input = Value::Array(vec![]);

    let encoded = ht_type
        .encode(&input, false)
        .expect("encoding should succeed");
    let decoded = ht_type.decode(&encoded).expect("decoding should succeed");

    match decoded {
        Value::Array(pairs) => assert!(pairs.is_empty()),
        _ => panic!("Expected empty array"),
    }
}

#[test]
fn hashtable_null_optional() {
    common::ensure_gtk_init();

    let key_type = Type::Boolean;
    let value_type = Type::Boolean;
    let ht_type = HashTableType::new(key_type, value_type, Ownership::Full);

    let encoded = ht_type
        .encode(&Value::Null, true)
        .expect("encoding should succeed");

    match encoded {
        FfiValue::Ptr(ptr) => assert!(ptr.is_null()),
        _ => panic!("Expected null pointer"),
    }
}

#[test]
fn hashtable_borrowed_does_not_free() {
    common::ensure_gtk_init();

    let key_type = Type::Integer(IntegerType::from(IntegerKind::I32));
    let value_type = Type::Integer(IntegerType::from(IntegerKind::I32));
    let ht_type = HashTableType::new(key_type, value_type, Ownership::Borrowed);

    let hash_table = unsafe {
        glib::ffi::g_hash_table_new_full(
            Some(glib::ffi::g_direct_hash),
            Some(glib::ffi::g_direct_equal),
            None,
            None,
        )
    };

    unsafe {
        glib::ffi::g_hash_table_insert(hash_table, 1 as *mut c_void, 100 as *mut c_void);
        glib::ffi::g_hash_table_insert(hash_table, 2 as *mut c_void, 200 as *mut c_void);
    }

    let ffi_value = FfiValue::Ptr(hash_table as *mut c_void);
    let decoded = ht_type.decode(&ffi_value).expect("decoding should succeed");

    match decoded {
        Value::Array(pairs) => assert_eq!(pairs.len(), 2),
        _ => panic!("Expected array"),
    }

    let size = unsafe { glib::ffi::g_hash_table_size(hash_table) };
    assert_eq!(size, 2);

    unsafe { glib::ffi::g_hash_table_unref(hash_table) };
}

#[test]
fn float_memory_properly_freed_on_drop() {
    common::ensure_gtk_init();

    let key_type = Type::Float(FloatKind::F64);
    let value_type = Type::Float(FloatKind::F64);
    let ht_type = HashTableType::new(key_type, value_type, Ownership::Full);

    let input = Value::Array(vec![
        Value::Array(vec![Value::Number(1.1), Value::Number(2.2)]),
        Value::Array(vec![Value::Number(3.3), Value::Number(4.4)]),
        Value::Array(vec![Value::Number(5.5), Value::Number(6.6)]),
    ]);

    let encoded = ht_type
        .encode(&input, false)
        .expect("encoding should succeed");
    let _ = ht_type.decode(&encoded).expect("decoding should succeed");
}

#[test]
fn boolean_roundtrip_preserves_values() {
    common::ensure_gtk_init();

    let key_type = Type::Integer(IntegerType::from(IntegerKind::I32));
    let value_type = Type::Boolean;
    let ht_type = HashTableType::new(key_type, value_type, Ownership::Full);

    let input = Value::Array(vec![
        Value::Array(vec![Value::Number(0.0), Value::Boolean(true)]),
        Value::Array(vec![Value::Number(1.0), Value::Boolean(false)]),
    ]);

    let encoded = ht_type
        .encode(&input, false)
        .expect("encoding should succeed");
    let decoded = ht_type.decode(&encoded).expect("decoding should succeed");

    let pairs = match decoded {
        Value::Array(p) => p,
        _ => panic!("Expected array"),
    };

    let mut found_true = false;
    let mut found_false = false;

    for pair in pairs {
        let kv = match pair {
            Value::Array(v) => v,
            _ => panic!("Expected array pair"),
        };
        match &kv[1] {
            Value::Boolean(true) => found_true = true,
            Value::Boolean(false) => found_false = true,
            _ => panic!("Expected boolean"),
        }
    }

    assert!(found_true && found_false);
}

mod common;

use std::ffi::{CString, c_void};

use native::arg::Arg;
use native::ffi::{FfiStorage, FfiStorageKind, FfiValue};
use native::types::{ArrayKind, ArrayType, FloatKind, IntegerKind, Ownership, StringType, Type};
use native::value;

#[test]
fn owned_ptr_new_stores_value_and_ptr() {
    let data = vec![1u32, 2, 3, 4, 5];
    let ptr = data.as_ptr() as *mut c_void;
    let owned = FfiStorage::new(ptr, FfiStorageKind::U32Vec(data));

    assert_eq!(owned.ptr(), ptr);
}

#[test]
fn owned_ptr_from_vec_captures_correct_pointer() {
    let data = vec![10u64, 20, 30];
    let owned: FfiStorage = data.into();

    unsafe {
        let slice = std::slice::from_raw_parts(owned.ptr() as *const u64, 3);
        assert_eq!(slice, &[10, 20, 30]);
    }
}

#[test]
fn owned_ptr_keeps_cstring_alive() {
    let cstring = CString::new("test string").unwrap();
    let ptr = cstring.as_ptr() as *mut c_void;
    let owned = FfiStorage::new(ptr, FfiStorageKind::CString(cstring));

    unsafe {
        let s = std::ffi::CStr::from_ptr(owned.ptr() as *const i8);
        assert_eq!(s.to_str().unwrap(), "test string");
    }
}

#[test]
fn owned_ptr_tuple_keeps_both_alive() {
    let strings = vec![
        CString::new("hello").unwrap(),
        CString::new("world").unwrap(),
    ];
    let ptrs: Vec<*mut c_void> = strings.iter().map(|s| s.as_ptr() as *mut c_void).collect();
    let tuple_ptr = ptrs.as_ptr() as *mut c_void;

    let owned = FfiStorage::new(tuple_ptr, FfiStorageKind::StringArray(strings, ptrs));

    unsafe {
        let ptr_slice = std::slice::from_raw_parts(owned.ptr() as *const *const i8, 2);
        let s0 = std::ffi::CStr::from_ptr(ptr_slice[0]);
        let s1 = std::ffi::CStr::from_ptr(ptr_slice[1]);
        assert_eq!(s0.to_str().unwrap(), "hello");
        assert_eq!(s1.to_str().unwrap(), "world");
    }
}

#[test]
fn owned_ptr_drops_value_when_dropped() {
    let data = vec![1u8, 2, 3, 4, 5];
    let ptr = data.as_ptr() as *mut c_void;
    let owned = FfiStorage::new(ptr, FfiStorageKind::U8Vec(data));

    drop(owned);
}

#[test]
fn try_from_integer_i8() {
    let arg = Arg::new(
        Type::Integer(IntegerKind::I8.into()),
        value::Value::Number(-42.0),
    );

    let result = FfiValue::try_from(arg);
    assert!(result.is_ok());
    if let FfiValue::I8(v) = result.unwrap() {
        assert_eq!(v, -42);
    } else {
        panic!("Expected FfiValue::I8");
    }
}

#[test]
fn try_from_integer_u8() {
    let arg = Arg::new(
        Type::Integer(IntegerKind::U8.into()),
        value::Value::Number(200.0),
    );

    let result = FfiValue::try_from(arg);
    assert!(result.is_ok());
    if let FfiValue::U8(v) = result.unwrap() {
        assert_eq!(v, 200);
    } else {
        panic!("Expected FfiValue::U8");
    }
}

#[test]
fn try_from_integer_i32() {
    let arg = Arg::new(
        Type::Integer(IntegerKind::I32.into()),
        value::Value::Number(-123456.0),
    );

    let result = FfiValue::try_from(arg);
    assert!(result.is_ok());
    if let FfiValue::I32(v) = result.unwrap() {
        assert_eq!(v, -123456);
    } else {
        panic!("Expected FfiValue::I32");
    }
}

#[test]
fn try_from_integer_u64() {
    let arg = Arg::new(
        Type::Integer(IntegerKind::U64.into()),
        value::Value::Number(9999999999.0),
    );

    let result = FfiValue::try_from(arg);
    assert!(result.is_ok());
    if let FfiValue::U64(v) = result.unwrap() {
        assert_eq!(v, 9999999999);
    } else {
        panic!("Expected FfiValue::U64");
    }
}

#[test]
fn try_from_integer_optional_null() {
    let arg = Arg {
        ty: Type::Integer(IntegerKind::I32.into()),
        value: value::Value::Null,
        optional: true,
    };

    let result = FfiValue::try_from(arg);
    assert!(result.is_ok());
    if let FfiValue::I32(v) = result.unwrap() {
        assert_eq!(v, 0);
    } else {
        panic!("Expected FfiValue::I32");
    }
}

#[test]
fn try_from_float_f32() {
    let arg = Arg::new(Type::Float(FloatKind::F32), value::Value::Number(3.125));

    let result = FfiValue::try_from(arg);
    assert!(result.is_ok());
    if let FfiValue::F32(v) = result.unwrap() {
        assert!((v - 3.125).abs() < 0.001);
    } else {
        panic!("Expected FfiValue::F32");
    }
}

#[test]
fn try_from_float_f64() {
    let arg = Arg::new(Type::Float(FloatKind::F64), value::Value::Number(2.625));

    let result = FfiValue::try_from(arg);
    assert!(result.is_ok());
    if let FfiValue::F64(v) = result.unwrap() {
        assert!((v - 2.625).abs() < 0.0000001);
    } else {
        panic!("Expected FfiValue::F64");
    }
}

#[test]
fn try_from_string() {
    let arg = Arg::new(
        Type::String(StringType {
            ownership: Ownership::Full,
            length: None,
        }),
        value::Value::String("hello world".to_string()),
    );

    let result = FfiValue::try_from(arg);
    assert!(result.is_ok());
    if let FfiValue::Storage(owned) = result.unwrap() {
        unsafe {
            let s = std::ffi::CStr::from_ptr(owned.ptr() as *const i8);
            assert_eq!(s.to_str().unwrap(), "hello world");
        }
    } else {
        panic!("Expected FfiValue::Storage");
    }
}

#[test]
fn try_from_string_null() {
    let arg = Arg::new(
        Type::String(StringType {
            ownership: Ownership::Full,
            length: None,
        }),
        value::Value::Null,
    );

    let result = FfiValue::try_from(arg);
    assert!(result.is_ok());
    if let FfiValue::Ptr(ptr) = result.unwrap() {
        assert!(ptr.is_null());
    } else {
        panic!("Expected FfiValue::Ptr");
    }
}

#[test]
fn try_from_boolean_true() {
    let arg = Arg::new(Type::Boolean, value::Value::Boolean(true));

    let result = FfiValue::try_from(arg);
    assert!(result.is_ok());
    if let FfiValue::U8(v) = result.unwrap() {
        assert_eq!(v, 1);
    } else {
        panic!("Expected FfiValue::U8");
    }
}

#[test]
fn try_from_boolean_false() {
    let arg = Arg::new(Type::Boolean, value::Value::Boolean(false));

    let result = FfiValue::try_from(arg);
    assert!(result.is_ok());
    if let FfiValue::U8(v) = result.unwrap() {
        assert_eq!(v, 0);
    } else {
        panic!("Expected FfiValue::U8");
    }
}

#[test]
fn try_from_null() {
    let arg = Arg::new(Type::Null, value::Value::Null);

    let result = FfiValue::try_from(arg);
    assert!(result.is_ok());
    if let FfiValue::Ptr(ptr) = result.unwrap() {
        assert!(ptr.is_null());
    } else {
        panic!("Expected FfiValue::Ptr");
    }
}

#[test]
fn try_from_undefined() {
    let arg = Arg::new(Type::Undefined, value::Value::Undefined);

    let result = FfiValue::try_from(arg);
    assert!(result.is_ok());
    if let FfiValue::Ptr(ptr) = result.unwrap() {
        assert!(ptr.is_null());
    } else {
        panic!("Expected FfiValue::Ptr");
    }
}

#[test]
fn try_from_array_u8() {
    let arg = Arg::new(
        Type::Array(ArrayType {
            item_type: Box::new(Type::Integer(IntegerKind::U8.into())),
            kind: ArrayKind::Array,
            ownership: Ownership::Full,
            element_size: None,
        }),
        value::Value::Array(vec![
            value::Value::Number(1.0),
            value::Value::Number(2.0),
            value::Value::Number(3.0),
        ]),
    );

    let result = FfiValue::try_from(arg);
    assert!(result.is_ok());
    if let FfiValue::Storage(owned) = result.unwrap() {
        unsafe {
            let slice = std::slice::from_raw_parts(owned.ptr() as *const u8, 3);
            assert_eq!(slice, &[1, 2, 3]);
        }
    } else {
        panic!("Expected FfiValue::Storage");
    }
}

#[test]
fn try_from_array_i32() {
    let arg = Arg::new(
        Type::Array(ArrayType {
            item_type: Box::new(Type::Integer(IntegerKind::I32.into())),
            kind: ArrayKind::Array,
            ownership: Ownership::Full,
            element_size: None,
        }),
        value::Value::Array(vec![
            value::Value::Number(-10.0),
            value::Value::Number(0.0),
            value::Value::Number(10.0),
        ]),
    );

    let result = FfiValue::try_from(arg);
    assert!(result.is_ok());
    if let FfiValue::Storage(owned) = result.unwrap() {
        unsafe {
            let slice = std::slice::from_raw_parts(owned.ptr() as *const i32, 3);
            assert_eq!(slice, &[-10, 0, 10]);
        }
    } else {
        panic!("Expected FfiValue::Storage");
    }
}

#[test]
fn try_from_array_f64() {
    let arg = Arg::new(
        Type::Array(ArrayType {
            item_type: Box::new(Type::Float(FloatKind::F64)),
            kind: ArrayKind::Array,
            ownership: Ownership::Full,
            element_size: None,
        }),
        value::Value::Array(vec![value::Value::Number(1.1), value::Value::Number(2.2)]),
    );

    let result = FfiValue::try_from(arg);
    assert!(result.is_ok());
    if let FfiValue::Storage(owned) = result.unwrap() {
        unsafe {
            let slice = std::slice::from_raw_parts(owned.ptr() as *const f64, 2);
            assert!((slice[0] - 1.1).abs() < 0.001);
            assert!((slice[1] - 2.2).abs() < 0.001);
        }
    } else {
        panic!("Expected FfiValue::Storage");
    }
}

#[test]
fn try_from_array_string() {
    let arg = Arg::new(
        Type::Array(ArrayType {
            item_type: Box::new(Type::String(StringType {
                ownership: Ownership::Full,
                length: None,
            })),
            kind: ArrayKind::Array,
            ownership: Ownership::Full,
            element_size: None,
        }),
        value::Value::Array(vec![
            value::Value::String("foo".to_string()),
            value::Value::String("bar".to_string()),
        ]),
    );

    let result = FfiValue::try_from(arg);
    assert!(result.is_ok());
    if let FfiValue::Storage(owned) = result.unwrap() {
        unsafe {
            let ptrs = std::slice::from_raw_parts(owned.ptr() as *const *const i8, 3);
            let s0 = std::ffi::CStr::from_ptr(ptrs[0]);
            let s1 = std::ffi::CStr::from_ptr(ptrs[1]);
            assert_eq!(s0.to_str().unwrap(), "foo");
            assert_eq!(s1.to_str().unwrap(), "bar");
            assert!(ptrs[2].is_null());
        }
    } else {
        panic!("Expected FfiValue::Storage");
    }
}

#[test]
fn try_from_array_boolean() {
    let arg = Arg::new(
        Type::Array(ArrayType {
            item_type: Box::new(Type::Boolean),
            kind: ArrayKind::Array,
            ownership: Ownership::Full,
            element_size: None,
        }),
        value::Value::Array(vec![
            value::Value::Boolean(true),
            value::Value::Boolean(false),
            value::Value::Boolean(true),
        ]),
    );

    let result = FfiValue::try_from(arg);
    assert!(result.is_ok());
    if let FfiValue::Storage(owned) = result.unwrap() {
        unsafe {
            let slice = std::slice::from_raw_parts(owned.ptr() as *const u8, 3);
            assert_eq!(slice, &[1, 0, 1]);
        }
    } else {
        panic!("Expected FfiValue::Storage");
    }
}

#[test]
fn value_as_ptr_integer_types_fail() {
    let v_u8 = FfiValue::U8(42);
    let v_i32 = FfiValue::I32(-100);
    let v_u64 = FfiValue::U64(999);

    assert!(v_u8.as_ptr("test").is_err());
    assert!(v_i32.as_ptr("test").is_err());
    assert!(v_u64.as_ptr("test").is_err());
}

#[test]
fn value_as_ptr_float_types_fail() {
    let v_f32 = FfiValue::F32(3.125);
    let v_f64 = FfiValue::F64(2.625);

    assert!(v_f32.as_ptr("test").is_err());
    assert!(v_f64.as_ptr("test").is_err());
}

#[test]
fn value_as_ptr_void() {
    let v = FfiValue::Void;
    assert!(v.as_ptr("test").is_err());
}

#[test]
fn value_as_ptr_null_ptr() {
    let v = FfiValue::Ptr(std::ptr::null_mut());
    assert!(v.as_ptr("test").unwrap().is_null());
}

#[test]
fn value_to_libffi_arg_integers() {
    let v = FfiValue::I32(42);
    let _arg: libffi::middle::Arg = (&v).into();
}

#[test]
fn value_to_libffi_arg_floats() {
    let v = FfiValue::F64(3.125);
    let _arg: libffi::middle::Arg = (&v).into();
}

#[test]
fn value_to_libffi_arg_ptr() {
    let v = FfiValue::Ptr(std::ptr::null_mut());
    let _arg: libffi::middle::Arg = (&v).into();
}

#[test]
fn value_to_libffi_arg_owned_ptr() {
    let storage: FfiStorage = vec![1u8, 2, 3].into();
    let v = FfiValue::Storage(storage);
    let _arg: libffi::middle::Arg = (&v).into();
}

#[test]
fn try_from_struct_null() {
    let struct_type =
        native::types::StructType::new(Ownership::Borrowed, "TestStruct".to_string(), Some(16));
    let arg = Arg::new(Type::Struct(struct_type), value::Value::Null);

    let result = FfiValue::try_from(arg);
    assert!(result.is_ok());
    if let FfiValue::Ptr(ptr) = result.unwrap() {
        assert!(ptr.is_null());
    } else {
        panic!("Expected FfiValue::Ptr for null struct");
    }
}

#[test]
fn try_from_struct_undefined() {
    let struct_type = native::types::StructType::new(Ownership::Full, "TestRect".to_string(), None);
    let arg = Arg::new(Type::Struct(struct_type), value::Value::Undefined);

    let result = FfiValue::try_from(arg);
    assert!(result.is_ok());
    if let FfiValue::Ptr(ptr) = result.unwrap() {
        assert!(ptr.is_null());
    } else {
        panic!("Expected FfiValue::Ptr for undefined struct");
    }
}

#[test]
fn try_from_struct_invalid_type() {
    let struct_type =
        native::types::StructType::new(Ownership::Borrowed, "TestStruct".to_string(), Some(16));
    let arg = Arg::new(
        Type::Struct(struct_type),
        value::Value::String("invalid".to_string()),
    );

    let result = FfiValue::try_from(arg);
    assert!(result.is_err());
}

#[test]
fn try_from_struct_invalid_number() {
    let struct_type =
        native::types::StructType::new(Ownership::Borrowed, "TestStruct".to_string(), Some(16));
    let arg = Arg::new(Type::Struct(struct_type), value::Value::Number(42.0));

    let result = FfiValue::try_from(arg);
    assert!(result.is_err());
}

#[test]
fn try_from_struct_invalid_boolean() {
    let struct_type =
        native::types::StructType::new(Ownership::Full, "TestRect".to_string(), Some(8));
    let arg = Arg::new(Type::Struct(struct_type), value::Value::Boolean(true));

    let result = FfiValue::try_from(arg);
    assert!(result.is_err());
}

#[test]
fn try_from_struct_transfer_none_vs_full() {
    let transfer_none_type =
        native::types::StructType::new(Ownership::Full, "TestStruct".to_string(), Some(16));
    let transfer_full_type =
        native::types::StructType::new(Ownership::Borrowed, "TestStruct".to_string(), Some(16));

    let transfer_none_arg = Arg::new(Type::Struct(transfer_none_type), value::Value::Null);

    let transfer_full_arg = Arg::new(Type::Struct(transfer_full_type), value::Value::Null);

    let transfer_none_result = FfiValue::try_from(transfer_none_arg);
    let transfer_full_result = FfiValue::try_from(transfer_full_arg);

    assert!(transfer_none_result.is_ok());
    assert!(transfer_full_result.is_ok());

    if let (FfiValue::Ptr(ptr1), FfiValue::Ptr(ptr2)) =
        (transfer_none_result.unwrap(), transfer_full_result.unwrap())
    {
        assert!(ptr1.is_null());
        assert!(ptr2.is_null());
    } else {
        panic!("Expected FfiValue::Ptr for both");
    }
}

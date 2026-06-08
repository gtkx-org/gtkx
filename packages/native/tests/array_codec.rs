mod common;

use std::ffi::{CString, c_char, c_void};

use gtk4::glib;
use gtk4::prelude::StaticType as _;

use native::NativeHandle;
use native::arg::Arg;
use native::ffi::{FfiStorageKind, FfiValue, GArrayData};
use native::types::{
    ArrayKind, ArrayType, BooleanType, FfiDecoder, FfiEncoder, FloatKind, IntegerKind, Ownership,
    RawPtrCodec, RefType, StringType, StructType, TaggedKind, TaggedType, Type, VoidType,
};
use native::value::Value;

fn struct_item_type() -> Type {
    Type::Struct(StructType {
        ownership: Ownership::Borrowed,
        size: Some(size_of::<gtk4::gdk::ffi::GdkRGBA>()),
    })
}

fn string_item_type(ownership: Ownership) -> Type {
    Type::String(StringType {
        ownership,
        length: None,
    })
}

fn tagged_item_type() -> Type {
    Type::Tagged(TaggedType {
        kind: TaggedKind::Enum,
        library: "Gtk".to_string(),
        get_type_fn: "gtk_orientation_get_type".to_string(),
        storage: IntegerKind::I32,
    })
}

fn array_type(item: Type, kind: ArrayKind, ownership: Ownership) -> ArrayType {
    ArrayType {
        item_type: Box::new(item),
        kind,
        ownership,
        element_size: None,
    }
}

fn boxed_handle() -> NativeHandle {
    let ptr = common::allocate_test_boxed(gtk4::gdk::RGBA::static_type());
    NativeHandle::borrowed(ptr)
}

#[test]
fn array_kind_from_str_parses_every_variant() {
    assert_eq!("array".parse::<ArrayKind>().unwrap(), ArrayKind::Array);
    assert_eq!("glist".parse::<ArrayKind>().unwrap(), ArrayKind::GList);
    assert_eq!("gslist".parse::<ArrayKind>().unwrap(), ArrayKind::GSList);
    assert_eq!(
        "gptrarray".parse::<ArrayKind>().unwrap(),
        ArrayKind::GPtrArray
    );
    assert_eq!("garray".parse::<ArrayKind>().unwrap(), ArrayKind::GArray);
    assert_eq!(
        "gbytearray".parse::<ArrayKind>().unwrap(),
        ArrayKind::GByteArray
    );
    assert_eq!(
        "sized".parse::<ArrayKind>().unwrap(),
        ArrayKind::Sized { size_index: 0 }
    );
    assert_eq!(
        "fixed".parse::<ArrayKind>().unwrap(),
        ArrayKind::Fixed { size: 0 }
    );
    assert!("bogus".parse::<ArrayKind>().is_err());
}

#[test]
fn encode_optional_null_yields_null_ptr() {
    let ty = array_type(
        Type::Integer(IntegerKind::U8),
        ArrayKind::Array,
        Ownership::Full,
    );
    match ty.encode(&Value::Null, true).unwrap() {
        FfiValue::Ptr(ptr) => assert!(ptr.is_null()),
        other => panic!("expected null ptr, got {other:?}"),
    }
    match ty.encode(&Value::Undefined, true).unwrap() {
        FfiValue::Ptr(ptr) => assert!(ptr.is_null()),
        other => panic!("expected null ptr, got {other:?}"),
    }
}

#[test]
fn encode_non_array_value_fails() {
    let ty = array_type(
        Type::Integer(IntegerKind::U8),
        ArrayKind::Array,
        Ownership::Full,
    );
    assert!(ty.encode(&Value::Number(1.0), false).is_err());
}

#[test]
fn encode_unsupported_item_type_fails() {
    let ty = array_type(Type::Void(VoidType), ArrayKind::Array, Ownership::Full);
    let val = Value::Array(vec![]);
    assert!(ty.encode(&val, false).is_err());
}

#[test]
fn encode_integer_array_extract_error() {
    let ty = array_type(
        Type::Integer(IntegerKind::I32),
        ArrayKind::Array,
        Ownership::Full,
    );
    let val = Value::Array(vec![Value::Boolean(true)]);
    assert!(ty.encode(&val, false).is_err());
}

#[test]
fn encode_tagged_array_roundtrips_through_storage() {
    let ty = array_type(tagged_item_type(), ArrayKind::Array, Ownership::Full);
    let val = Value::Array(vec![Value::Number(0.0), Value::Number(1.0)]);
    let encoded = ty.encode(&val, false).unwrap();
    let decoded = ty.decode(&encoded).unwrap();
    let Value::Array(items) = decoded else {
        panic!("expected array")
    };
    assert_eq!(items.len(), 2);
}

#[test]
fn encode_float_f32_array_roundtrips() {
    let ty = array_type(
        Type::Float(FloatKind::F32),
        ArrayKind::Array,
        Ownership::Full,
    );
    let val = Value::Array(vec![Value::Number(1.5), Value::Number(2.5)]);
    let encoded = ty.encode(&val, false).unwrap();
    let Value::Array(items) = ty.decode(&encoded).unwrap() else {
        panic!("expected array")
    };
    assert_eq!(items.len(), 2);
}

#[test]
fn encode_float_f32_array_out_of_range_fails() {
    let ty = array_type(
        Type::Float(FloatKind::F32),
        ArrayKind::Array,
        Ownership::Full,
    );
    let val = Value::Array(vec![Value::Number(1e40)]);
    assert!(ty.encode(&val, false).is_err());
}

#[test]
fn encode_float_f64_array_roundtrips() {
    let ty = array_type(
        Type::Float(FloatKind::F64),
        ArrayKind::Array,
        Ownership::Full,
    );
    let val = Value::Array(vec![Value::Number(1.25)]);
    let encoded = ty.encode(&val, false).unwrap();
    let Value::Array(items) = ty.decode(&encoded).unwrap() else {
        panic!("expected array")
    };
    assert_eq!(items.len(), 1);
}

#[test]
fn encode_boolean_array_roundtrips() {
    let ty = array_type(
        Type::Boolean(BooleanType),
        ArrayKind::Array,
        Ownership::Full,
    );
    let val = Value::Array(vec![Value::Boolean(true), Value::Boolean(false)]);
    let encoded = ty.encode(&val, false).unwrap();
    let Value::Array(items) = ty.decode(&encoded).unwrap() else {
        panic!("expected array")
    };
    assert_eq!(items.len(), 2);
}

#[test]
fn encode_boolean_array_extract_error() {
    let ty = array_type(
        Type::Boolean(BooleanType),
        ArrayKind::Array,
        Ownership::Full,
    );
    let val = Value::Array(vec![Value::Number(1.0)]);
    assert!(ty.encode(&val, false).is_err());
}

#[test]
fn encode_string_array_extract_error() {
    let ty = array_type(
        string_item_type(Ownership::Full),
        ArrayKind::Array,
        Ownership::Full,
    );
    let val = Value::Array(vec![Value::Number(1.0)]);
    assert!(ty.encode(&val, false).is_err());
}

#[test]
fn encode_string_array_full_ownership_dups_elements() {
    let ty = array_type(
        string_item_type(Ownership::Full),
        ArrayKind::Array,
        Ownership::Full,
    );
    let val = Value::Array(vec![
        Value::String("foo".to_string()),
        Value::String("bar".to_string()),
    ]);
    let encoded = ty.encode(&val, false).unwrap();
    let Value::Array(items) = ty.decode(&encoded).unwrap() else {
        panic!("expected array")
    };
    assert_eq!(items.len(), 2);
}

#[test]
fn encode_string_array_borrowed_keeps_elements() {
    let ty = array_type(
        string_item_type(Ownership::Borrowed),
        ArrayKind::Array,
        Ownership::Full,
    );
    let val = Value::Array(vec![Value::String("foo".to_string())]);
    let encoded = ty.encode(&val, false).unwrap();
    let Value::Array(items) = ty.decode(&encoded).unwrap() else {
        panic!("expected array")
    };
    assert_eq!(items.len(), 1);
}

#[test]
fn encode_pointer_array_with_element_size_copies_into_buffer() {
    let mut ty = array_type(struct_item_type(), ArrayKind::Array, Ownership::Full);
    ty.element_size = Some(size_of::<gtk4::gdk::ffi::GdkRGBA>());
    let handle = boxed_handle();
    let val = Value::Array(vec![Value::Object(handle)]);
    let encoded = ty.encode(&val, false).unwrap();
    assert!(matches!(encoded, FfiValue::Storage(_)));
}

#[test]
fn encode_pointer_array_with_element_size_rejects_null_handle() {
    let mut ty = array_type(struct_item_type(), ArrayKind::Array, Ownership::Full);
    ty.element_size = Some(8);
    let val = Value::Array(vec![Value::Object(NativeHandle::borrowed(
        std::ptr::null_mut(),
    ))]);
    assert!(ty.encode(&val, false).is_err());
}

#[test]
fn encode_pointer_array_extract_error() {
    let ty = array_type(struct_item_type(), ArrayKind::Array, Ownership::Full);
    let val = Value::Array(vec![Value::Number(1.0)]);
    assert!(ty.encode(&val, false).is_err());
}

#[test]
fn encode_pointer_array_null_terminated_with_handles() {
    let ty = array_type(struct_item_type(), ArrayKind::Array, Ownership::Full);
    let val = Value::Array(vec![Value::Object(boxed_handle())]);
    let encoded = ty.encode(&val, false).unwrap();
    let FfiValue::Storage(storage) = encoded else {
        panic!("expected storage")
    };
    let FfiStorageKind::ObjectArray(_, ptrs) = storage.kind() else {
        panic!("expected object array storage")
    };
    assert_eq!(ptrs.len(), 2);
    assert!(ptrs[1].is_null());
}

#[test]
fn encode_pointer_array_null_terminated_empty_has_sentinel() {
    let ty = array_type(struct_item_type(), ArrayKind::Array, Ownership::Full);
    let encoded = ty.encode(&Value::Array(vec![]), false).unwrap();
    let FfiValue::Storage(storage) = encoded else {
        panic!("expected storage")
    };
    let FfiStorageKind::ObjectArray(_, ptrs) = storage.kind() else {
        panic!("expected object array storage")
    };
    assert_eq!(ptrs.len(), 1);
    assert!(ptrs[0].is_null());
}

#[test]
fn encode_pointer_array_null_terminated_rejects_null_handle() {
    let ty = array_type(struct_item_type(), ArrayKind::Array, Ownership::Full);
    let val = Value::Array(vec![Value::Object(NativeHandle::borrowed(
        std::ptr::null_mut(),
    ))]);
    assert!(ty.encode(&val, false).is_err());
}

#[test]
fn encode_glist_strings_full_ownership_dups_elements() {
    common::run(|| {
        let ty = array_type(
            string_item_type(Ownership::Full),
            ArrayKind::GList,
            Ownership::Borrowed,
        );
        let val = Value::Array(vec![
            Value::String("a".to_string()),
            Value::String("b".to_string()),
        ]);
        let encoded = ty.encode(&val, false).unwrap();
        assert!(matches!(encoded, FfiValue::Storage(_)));
    });
}

#[test]
fn encode_glist_strings_borrowed_roundtrips() {
    common::run(|| {
        let ty = array_type(
            string_item_type(Ownership::Borrowed),
            ArrayKind::GList,
            Ownership::Borrowed,
        );
        let val = Value::Array(vec![
            Value::String("a".to_string()),
            Value::String("b".to_string()),
        ]);
        let encoded = ty.encode(&val, false).unwrap();
        let Value::Array(items) = ty.decode(&encoded).unwrap() else {
            panic!("expected array")
        };
        assert_eq!(items.len(), 2);
    });
}

#[test]
fn encode_glist_handles_roundtrips() {
    common::run(|| {
        let ty = array_type(struct_item_type(), ArrayKind::GList, Ownership::Borrowed);
        let val = Value::Array(vec![Value::Object(boxed_handle())]);
        let encoded = ty.encode(&val, false).unwrap();
        let Value::Array(items) = ty.decode(&encoded).unwrap() else {
            panic!("expected array")
        };
        assert_eq!(items.len(), 1);
    });
}

#[test]
fn encode_glist_handles_rejects_null() {
    common::run(|| {
        let ty = array_type(struct_item_type(), ArrayKind::GList, Ownership::Borrowed);
        let val = Value::Array(vec![Value::Object(NativeHandle::borrowed(
            std::ptr::null_mut(),
        ))]);
        assert!(ty.encode(&val, false).is_err());
    });
}

#[test]
fn encode_gslist_strings_full_ownership_dups_elements() {
    common::run(|| {
        let ty = array_type(
            string_item_type(Ownership::Full),
            ArrayKind::GSList,
            Ownership::Borrowed,
        );
        let val = Value::Array(vec![
            Value::String("x".to_string()),
            Value::String("y".to_string()),
        ]);
        let encoded = ty.encode(&val, false).unwrap();
        assert!(matches!(encoded, FfiValue::Storage(_)));
    });
}

#[test]
fn encode_gslist_strings_borrowed_roundtrips() {
    common::run(|| {
        let ty = array_type(
            string_item_type(Ownership::Borrowed),
            ArrayKind::GSList,
            Ownership::Borrowed,
        );
        let val = Value::Array(vec![
            Value::String("x".to_string()),
            Value::String("y".to_string()),
        ]);
        let encoded = ty.encode(&val, false).unwrap();
        let Value::Array(items) = ty.decode(&encoded).unwrap() else {
            panic!("expected array")
        };
        assert_eq!(items.len(), 2);
    });
}

#[test]
fn encode_gslist_handles_roundtrips() {
    common::run(|| {
        let ty = array_type(struct_item_type(), ArrayKind::GSList, Ownership::Borrowed);
        let val = Value::Array(vec![Value::Object(boxed_handle())]);
        let encoded = ty.encode(&val, false).unwrap();
        let Value::Array(items) = ty.decode(&encoded).unwrap() else {
            panic!("expected array")
        };
        assert_eq!(items.len(), 1);
    });
}

#[test]
fn encode_gslist_handles_rejects_null() {
    common::run(|| {
        let ty = array_type(struct_item_type(), ArrayKind::GSList, Ownership::Borrowed);
        let val = Value::Array(vec![Value::Object(NativeHandle::borrowed(
            std::ptr::null_mut(),
        ))]);
        assert!(ty.encode(&val, false).is_err());
    });
}

#[test]
fn encode_gbytearray_roundtrips() {
    common::run(|| {
        let ty = array_type(
            Type::Integer(IntegerKind::U8),
            ArrayKind::GByteArray,
            Ownership::Borrowed,
        );
        let val = Value::Array(vec![
            Value::Number(1.0),
            Value::Number(2.0),
            Value::Number(255.0),
        ]);
        let encoded = ty.encode(&val, false).unwrap();
        let Value::Array(items) = ty.decode(&encoded).unwrap() else {
            panic!("expected array")
        };
        assert_eq!(items.len(), 3);
    });
}

#[test]
fn encode_gbytearray_rejects_out_of_range() {
    common::run(|| {
        let ty = array_type(
            Type::Integer(IntegerKind::U8),
            ArrayKind::GByteArray,
            Ownership::Full,
        );
        assert!(
            ty.encode(&Value::Array(vec![Value::Number(256.0)]), false)
                .is_err()
        );
        assert!(
            ty.encode(&Value::Array(vec![Value::Number(-1.0)]), false)
                .is_err()
        );
        assert!(
            ty.encode(&Value::Array(vec![Value::Number(1.5)]), false)
                .is_err()
        );
        assert!(
            ty.encode(&Value::Array(vec![Value::Boolean(true)]), false)
                .is_err()
        );
    });
}

#[test]
fn encode_garray_integer_roundtrips() {
    common::run(|| {
        let ty = array_type(
            Type::Integer(IntegerKind::I32),
            ArrayKind::GArray,
            Ownership::Borrowed,
        );
        let val = Value::Array(vec![Value::Number(10.0), Value::Number(-20.0)]);
        let encoded = ty.encode(&val, false).unwrap();
        let Value::Array(items) = ty.decode(&encoded).unwrap() else {
            panic!("expected array")
        };
        assert_eq!(items.len(), 2);
    });
}

#[test]
fn encode_garray_float_f32_roundtrips() {
    common::run(|| {
        let ty = array_type(
            Type::Float(FloatKind::F32),
            ArrayKind::GArray,
            Ownership::Borrowed,
        );
        let val = Value::Array(vec![Value::Number(1.5)]);
        let encoded = ty.encode(&val, false).unwrap();
        let Value::Array(items) = ty.decode(&encoded).unwrap() else {
            panic!("expected array")
        };
        assert_eq!(items.len(), 1);
    });
}

#[test]
fn encode_garray_float_f64_roundtrips() {
    common::run(|| {
        let ty = array_type(
            Type::Float(FloatKind::F64),
            ArrayKind::GArray,
            Ownership::Borrowed,
        );
        let val = Value::Array(vec![Value::Number(2.75)]);
        let encoded = ty.encode(&val, false).unwrap();
        let Value::Array(items) = ty.decode(&encoded).unwrap() else {
            panic!("expected array")
        };
        assert_eq!(items.len(), 1);
    });
}

#[test]
fn encode_garray_boolean_roundtrips() {
    common::run(|| {
        let ty = array_type(
            Type::Boolean(BooleanType),
            ArrayKind::GArray,
            Ownership::Borrowed,
        );
        let val = Value::Array(vec![Value::Boolean(true), Value::Boolean(false)]);
        let encoded = ty.encode(&val, false).unwrap();
        let Value::Array(items) = ty.decode(&encoded).unwrap() else {
            panic!("expected array")
        };
        assert_eq!(items.len(), 2);
    });
}

#[test]
fn encode_garray_tagged_roundtrips() {
    common::run(|| {
        let ty = array_type(tagged_item_type(), ArrayKind::GArray, Ownership::Borrowed);
        let val = Value::Array(vec![Value::Number(1.0)]);
        let encoded = ty.encode(&val, false).unwrap();
        assert!(matches!(encoded, FfiValue::Storage(_)));
    });
}

#[test]
fn encode_garray_handles_roundtrips() {
    common::run(|| {
        let ty = array_type(struct_item_type(), ArrayKind::GArray, Ownership::Borrowed);
        let val = Value::Array(vec![Value::Object(boxed_handle())]);
        let encoded = ty.encode(&val, false).unwrap();
        let Value::Array(items) = ty.decode(&encoded).unwrap() else {
            panic!("expected array")
        };
        assert_eq!(items.len(), 1);
    });
}

#[test]
fn encode_garray_handles_rejects_null() {
    common::run(|| {
        let ty = array_type(struct_item_type(), ArrayKind::GArray, Ownership::Borrowed);
        let val = Value::Array(vec![Value::Object(NativeHandle::borrowed(
            std::ptr::null_mut(),
        ))]);
        assert!(ty.encode(&val, false).is_err());
    });
}

#[test]
fn encode_garray_strings_roundtrips() {
    common::run(|| {
        let ty = array_type(
            string_item_type(Ownership::Full),
            ArrayKind::GArray,
            Ownership::Borrowed,
        );
        let val = Value::Array(vec![Value::String("hello".to_string())]);
        let encoded = ty.encode(&val, false).unwrap();
        assert!(matches!(encoded, FfiValue::Storage(_)));
    });
}

#[test]
fn encode_garray_explicit_element_size_used() {
    common::run(|| {
        let mut ty = array_type(
            Type::Integer(IntegerKind::I32),
            ArrayKind::GArray,
            Ownership::Borrowed,
        );
        ty.element_size = Some(size_of::<i32>());
        let val = Value::Array(vec![Value::Number(7.0)]);
        let encoded = ty.encode(&val, false).unwrap();
        assert!(matches!(encoded, FfiValue::Storage(_)));
    });
}

#[test]
fn encode_garray_unknown_element_size_fails() {
    common::run(|| {
        let ty = array_type(Type::Void(VoidType), ArrayKind::GArray, Ownership::Borrowed);
        assert!(ty.encode(&Value::Array(vec![]), false).is_err());
    });
}

#[test]
fn encode_garray_append_error_unrefs_and_propagates() {
    common::run(|| {
        let ty = array_type(
            Type::Integer(IntegerKind::I32),
            ArrayKind::GArray,
            Ownership::Borrowed,
        );
        let val = Value::Array(vec![Value::Boolean(true)]);
        assert!(ty.encode(&val, false).is_err());
    });
}

#[test]
fn encode_gptrarray_uses_null_terminated_layout() {
    let ty = array_type(struct_item_type(), ArrayKind::GPtrArray, Ownership::Full);
    let val = Value::Array(vec![Value::Object(boxed_handle())]);
    let encoded = ty.encode(&val, false).unwrap();
    assert!(matches!(encoded, FfiValue::Storage(_)));
}

#[test]
fn decode_integer_array_from_storage() {
    let ty = array_type(
        Type::Integer(IntegerKind::U16),
        ArrayKind::Array,
        Ownership::Full,
    );
    let encoded = ty
        .encode(
            &Value::Array(vec![Value::Number(1.0), Value::Number(2.0)]),
            false,
        )
        .unwrap();
    let Value::Array(items) = ty.decode(&encoded).unwrap() else {
        panic!("expected array")
    };
    assert_eq!(items.len(), 2);
}

#[test]
fn decode_null_ptr_yields_empty_array() {
    let ty = array_type(
        Type::Integer(IntegerKind::U8),
        ArrayKind::Array,
        Ownership::Full,
    );
    let Value::Array(items) = ty.decode(&FfiValue::Ptr(std::ptr::null_mut())).unwrap() else {
        panic!("expected array")
    };
    assert!(items.is_empty());
}

#[test]
fn decode_non_storage_non_ptr_fails() {
    let ty = array_type(
        Type::Integer(IntegerKind::U8),
        ArrayKind::Array,
        Ownership::Full,
    );
    assert!(ty.decode(&FfiValue::Void).is_err());
}

#[test]
fn decode_null_terminated_string_array_from_ptr() {
    let ty = array_type(
        string_item_type(Ownership::Borrowed),
        ArrayKind::Array,
        Ownership::Borrowed,
    );
    let s0 = CString::new("first").unwrap();
    let s1 = CString::new("second").unwrap();
    let mut ptrs: Vec<*const c_char> = vec![s0.as_ptr(), s1.as_ptr(), std::ptr::null()];
    let Value::Array(items) = ty
        .decode(&FfiValue::Ptr(ptrs.as_mut_ptr() as *mut c_void))
        .unwrap()
    else {
        panic!("expected array")
    };
    assert_eq!(items.len(), 2);
}

#[test]
fn decode_null_terminated_string_array_full_ownership_frees() {
    common::run(|| {
        let ty = array_type(
            string_item_type(Ownership::Full),
            ArrayKind::Array,
            Ownership::Full,
        );
        let strv = unsafe {
            let arr = glib::ffi::g_malloc0(size_of::<*mut c_char>() * 3) as *mut *mut c_char;
            *arr = glib::ffi::g_strdup(c"a".as_ptr());
            *arr.add(1) = glib::ffi::g_strdup(c"b".as_ptr());
            arr
        };
        let Value::Array(items) = ty.decode(&FfiValue::Ptr(strv as *mut c_void)).unwrap() else {
            panic!("expected array")
        };
        assert_eq!(items.len(), 2);
    });
}

#[test]
fn decode_null_terminated_borrowed_string_array_full_ownership_frees_vector_only() {
    common::run(|| {
        let ty = array_type(
            string_item_type(Ownership::Borrowed),
            ArrayKind::Array,
            Ownership::Full,
        );
        let strv = unsafe {
            let arr = glib::ffi::g_malloc0(size_of::<*mut c_char>() * 2) as *mut *mut c_char;
            *arr = c"borrowed".as_ptr().cast_mut();
            arr
        };
        let Value::Array(items) = ty.decode(&FfiValue::Ptr(strv as *mut c_void)).unwrap() else {
            panic!("expected array")
        };
        assert!(matches!(items.first(), Some(Value::String(s)) if s == "borrowed"));
    });
}

#[test]
fn decode_null_terminated_ptr_array_from_ptr() {
    let ty = array_type(struct_item_type(), ArrayKind::Array, Ownership::Borrowed);
    let h0 = boxed_handle();
    let h1 = boxed_handle();
    let mut ptrs: Vec<*mut c_void> = vec![h0.ptr(), h1.ptr(), std::ptr::null_mut()];
    let Value::Array(items) = ty
        .decode(&FfiValue::Ptr(ptrs.as_mut_ptr() as *mut c_void))
        .unwrap()
    else {
        panic!("expected array")
    };
    assert_eq!(items.len(), 2);
}

#[test]
fn decode_null_terminated_ptr_array_full_ownership_frees() {
    common::run(|| {
        let ty = array_type(struct_item_type(), ArrayKind::Array, Ownership::Full);
        let arr = unsafe {
            let mem = glib::ffi::g_malloc0(size_of::<*mut c_void>() * 2) as *mut *mut c_void;
            *mem = boxed_handle().ptr();
            mem
        };
        let Value::Array(items) = ty.decode(&FfiValue::Ptr(arr as *mut c_void)).unwrap() else {
            panic!("expected array")
        };
        assert_eq!(items.len(), 1);
    });
}

#[test]
fn decode_glist_empty_and_populated() {
    common::run(|| {
        let ty = array_type(struct_item_type(), ArrayKind::GList, Ownership::Full);
        let Value::Array(empty) = ty.decode(&FfiValue::Ptr(std::ptr::null_mut())).unwrap() else {
            panic!("expected array")
        };
        assert!(empty.is_empty());

        let list = unsafe { glib::ffi::g_list_append(std::ptr::null_mut(), boxed_handle().ptr()) };
        let Value::Array(items) = ty.decode(&FfiValue::Ptr(list as *mut c_void)).unwrap() else {
            panic!("expected array")
        };
        assert_eq!(items.len(), 1);
    });
}

#[test]
fn decode_gslist_full_ownership_frees_list() {
    common::run(|| {
        let ty = array_type(struct_item_type(), ArrayKind::GSList, Ownership::Full);
        let list = unsafe { glib::ffi::g_slist_append(std::ptr::null_mut(), boxed_handle().ptr()) };
        let Value::Array(items) = ty.decode(&FfiValue::Ptr(list as *mut c_void)).unwrap() else {
            panic!("expected array")
        };
        assert_eq!(items.len(), 1);
    });
}

#[test]
fn decode_garray_from_borrowed_ptr() {
    common::run(|| {
        let ty = array_type(
            Type::Integer(IntegerKind::I32),
            ArrayKind::GArray,
            Ownership::Full,
        );
        let g_array = unsafe { glib::ffi::g_array_sized_new(0, 0, size_of::<i32>() as u32, 0) };
        let value: i32 = 42;
        unsafe {
            glib::ffi::g_array_append_vals(g_array, &value as *const i32 as *const c_void, 1);
        }
        let Value::Array(items) = ty.decode(&FfiValue::Ptr(g_array as *mut c_void)).unwrap() else {
            panic!("expected array")
        };
        assert_eq!(items.len(), 1);
    });
}

#[test]
fn decode_garray_null_yields_empty() {
    common::run(|| {
        let ty = array_type(
            Type::Integer(IntegerKind::I32),
            ArrayKind::GArray,
            Ownership::Full,
        );
        let Value::Array(items) = ty.decode(&FfiValue::Ptr(std::ptr::null_mut())).unwrap() else {
            panic!("expected array")
        };
        assert!(items.is_empty());
    });
}

#[test]
fn decode_garray_storage_owned_does_not_double_free() {
    common::run(|| {
        let ty = array_type(
            Type::Integer(IntegerKind::I32),
            ArrayKind::GArray,
            Ownership::Full,
        );
        let g_array = unsafe { glib::ffi::g_array_sized_new(0, 0, size_of::<i32>() as u32, 0) };
        let storage = native::ffi::FfiStorage::new(
            g_array as *mut c_void,
            native::ffi::FfiStorageKind::GArray(GArrayData {
                array_ptr: g_array,
                should_free: true,
            }),
        );
        let Value::Array(items) = ty.decode(&FfiValue::Storage(storage)).unwrap() else {
            panic!("expected array")
        };
        assert!(items.is_empty());
    });
}

#[test]
fn decode_gptrarray_from_ptr() {
    common::run(|| {
        let ty = array_type(struct_item_type(), ArrayKind::GPtrArray, Ownership::Full);
        let ptr_array = unsafe { glib::ffi::g_ptr_array_new() };
        unsafe { glib::ffi::g_ptr_array_add(ptr_array, boxed_handle().ptr()) };
        let Value::Array(items) = ty.decode(&FfiValue::Ptr(ptr_array as *mut c_void)).unwrap()
        else {
            panic!("expected array")
        };
        assert_eq!(items.len(), 1);
    });
}

#[test]
fn decode_gptrarray_null_yields_empty() {
    let ty = array_type(struct_item_type(), ArrayKind::GPtrArray, Ownership::Full);
    let Value::Array(items) = ty.decode(&FfiValue::Ptr(std::ptr::null_mut())).unwrap() else {
        panic!("expected array")
    };
    assert!(items.is_empty());
}

#[test]
fn decode_gbytearray_from_ptr_and_empty() {
    common::run(|| {
        let ty = array_type(
            Type::Integer(IntegerKind::U8),
            ArrayKind::GByteArray,
            Ownership::Borrowed,
        );
        let bytes = [1u8, 2, 3];
        let ba = unsafe {
            let ba = glib::ffi::g_byte_array_sized_new(3);
            glib::ffi::g_byte_array_append(ba, bytes.as_ptr(), 3);
            ba
        };
        let Value::Array(items) = ty.decode(&FfiValue::Ptr(ba as *mut c_void)).unwrap() else {
            panic!("expected array")
        };
        assert_eq!(items.len(), 3);
        unsafe { glib::ffi::g_byte_array_unref(ba) };

        let empty = unsafe { glib::ffi::g_byte_array_new() };
        let Value::Array(items) = ty.decode(&FfiValue::Ptr(empty as *mut c_void)).unwrap() else {
            panic!("expected array")
        };
        assert!(items.is_empty());
        unsafe { glib::ffi::g_byte_array_unref(empty) };
    });
}

#[test]
fn decode_gbytearray_full_ownership_unrefs_raw_ptr() {
    common::run(|| {
        let ty = array_type(
            Type::Integer(IntegerKind::U8),
            ArrayKind::GByteArray,
            Ownership::Full,
        );
        let bytes = [7u8, 8];
        let ba = unsafe {
            let ba = glib::ffi::g_byte_array_sized_new(2);
            glib::ffi::g_byte_array_append(ba, bytes.as_ptr(), 2);
            glib::ffi::g_byte_array_ref(ba)
        };
        let Value::Array(items) = ty.decode(&FfiValue::Ptr(ba as *mut c_void)).unwrap() else {
            panic!("expected array")
        };
        assert_eq!(items.len(), 2);
        unsafe { glib::ffi::g_byte_array_unref(ba) };
    });
}

#[test]
fn decode_gbytearray_null_yields_empty() {
    let ty = array_type(
        Type::Integer(IntegerKind::U8),
        ArrayKind::GByteArray,
        Ownership::Full,
    );
    let Value::Array(items) = ty.decode(&FfiValue::Ptr(std::ptr::null_mut())).unwrap() else {
        panic!("expected array")
    };
    assert!(items.is_empty());
}

#[test]
fn decode_with_context_sized_array() {
    let ty = array_type(
        Type::Integer(IntegerKind::I32),
        ArrayKind::Sized { size_index: 0 },
        Ownership::Borrowed,
    );
    let data: Vec<i32> = vec![5, 6, 7];
    let ffi_value = FfiValue::Ptr(data.as_ptr() as *mut c_void);
    let ffi_args = [FfiValue::U32(3)];
    let args = [Arg::new(
        Type::Integer(IntegerKind::U32),
        Value::Number(3.0),
    )];
    let Value::Array(items) = ty
        .decode_with_context(&ffi_value, &ffi_args, &args)
        .unwrap()
    else {
        panic!("expected array")
    };
    assert_eq!(items.len(), 3);
}

#[test]
fn decode_with_context_sized_array_null_ptr() {
    let ty = array_type(
        Type::Integer(IntegerKind::I32),
        ArrayKind::Sized { size_index: 0 },
        Ownership::Borrowed,
    );
    let ffi_value = FfiValue::Ptr(std::ptr::null_mut());
    let ffi_args = [FfiValue::U32(3)];
    let args = [Arg::new(
        Type::Integer(IntegerKind::U32),
        Value::Number(3.0),
    )];
    let Value::Array(items) = ty
        .decode_with_context(&ffi_value, &ffi_args, &args)
        .unwrap()
    else {
        panic!("expected array")
    };
    assert!(items.is_empty());
}

#[test]
fn decode_with_context_sized_non_ptr_falls_through_to_decode() {
    let ty = array_type(
        Type::Integer(IntegerKind::I32),
        ArrayKind::Sized { size_index: 0 },
        Ownership::Borrowed,
    );
    let storage = native::ffi::FfiStorage::from(vec![1i32, 2]);
    let ffi_value = FfiValue::Storage(storage);
    let ffi_args = [FfiValue::U32(2)];
    let args = [Arg::new(
        Type::Integer(IntegerKind::U32),
        Value::Number(2.0),
    )];
    let Value::Array(items) = ty
        .decode_with_context(&ffi_value, &ffi_args, &args)
        .unwrap()
    else {
        panic!("expected array")
    };
    assert_eq!(items.len(), 2);
}

#[test]
fn decode_with_context_fixed_array() {
    let ty = array_type(
        Type::Float(FloatKind::F64),
        ArrayKind::Fixed { size: 2 },
        Ownership::Borrowed,
    );
    let data: Vec<f64> = vec![1.0, 2.0];
    let ffi_value = FfiValue::Ptr(data.as_ptr() as *mut c_void);
    let Value::Array(items) = ty.decode_with_context(&ffi_value, &[], &[]).unwrap() else {
        panic!("expected array")
    };
    assert_eq!(items.len(), 2);
}

#[test]
fn decode_with_context_fixed_array_null_ptr() {
    let ty = array_type(
        Type::Float(FloatKind::F64),
        ArrayKind::Fixed { size: 2 },
        Ownership::Borrowed,
    );
    let ffi_value = FfiValue::Ptr(std::ptr::null_mut());
    let Value::Array(items) = ty.decode_with_context(&ffi_value, &[], &[]).unwrap() else {
        panic!("expected array")
    };
    assert!(items.is_empty());
}

#[test]
fn decode_with_context_fixed_non_ptr_falls_through() {
    let ty = array_type(
        Type::Integer(IntegerKind::I32),
        ArrayKind::Fixed { size: 1 },
        Ownership::Borrowed,
    );
    let storage = native::ffi::FfiStorage::from(vec![9i32]);
    let Value::Array(items) = ty
        .decode_with_context(&FfiValue::Storage(storage), &[], &[])
        .unwrap()
    else {
        panic!("expected array")
    };
    assert_eq!(items.len(), 1);
}

#[test]
fn decode_with_context_array_kind_delegates_to_decode() {
    let ty = array_type(
        Type::Integer(IntegerKind::I32),
        ArrayKind::Array,
        Ownership::Borrowed,
    );
    let storage = native::ffi::FfiStorage::from(vec![1i32]);
    let Value::Array(items) = ty
        .decode_with_context(&FfiValue::Storage(storage), &[], &[])
        .unwrap()
    else {
        panic!("expected array")
    };
    assert_eq!(items.len(), 1);
}

#[test]
fn decode_contiguous_empty_and_null() {
    let ty = array_type(
        Type::Integer(IntegerKind::I32),
        ArrayKind::Fixed { size: 0 },
        Ownership::Borrowed,
    );
    let data: Vec<i32> = vec![1];
    let Value::Array(items) = ty
        .decode_with_context(&FfiValue::Ptr(data.as_ptr() as *mut c_void), &[], &[])
        .unwrap()
    else {
        panic!("expected array")
    };
    assert!(items.is_empty());
}

#[test]
fn decode_contiguous_pointer_elements() {
    let ty = array_type(
        struct_item_type(),
        ArrayKind::Fixed { size: 1 },
        Ownership::Borrowed,
    );
    let handle = boxed_handle();
    let data: Vec<*mut c_void> = vec![handle.ptr()];
    let Value::Array(items) = ty
        .decode_with_context(&FfiValue::Ptr(data.as_ptr() as *mut c_void), &[], &[])
        .unwrap()
    else {
        panic!("expected array")
    };
    assert_eq!(items.len(), 1);
}

#[test]
fn decode_contiguous_float_and_boolean() {
    let f32_ty = array_type(
        Type::Float(FloatKind::F32),
        ArrayKind::Fixed { size: 1 },
        Ownership::Borrowed,
    );
    let f32_data: Vec<f32> = vec![1.5];
    assert!(matches!(
        f32_ty
            .decode_with_context(&FfiValue::Ptr(f32_data.as_ptr() as *mut c_void), &[], &[])
            .unwrap(),
        Value::Array(_)
    ));

    let bool_ty = array_type(
        Type::Boolean(BooleanType),
        ArrayKind::Fixed { size: 1 },
        Ownership::Borrowed,
    );
    let bool_data: Vec<i32> = vec![1];
    assert!(matches!(
        bool_ty
            .decode_with_context(&FfiValue::Ptr(bool_data.as_ptr() as *mut c_void), &[], &[])
            .unwrap(),
        Value::Array(_)
    ));
}

#[test]
fn decode_storage_string_elements() {
    let ty = array_type(
        string_item_type(Ownership::Borrowed),
        ArrayKind::Array,
        Ownership::Full,
    );
    let encoded = ty
        .encode(&Value::Array(vec![Value::String("z".to_string())]), false)
        .unwrap();
    let Value::Array(items) = ty.decode(&encoded).unwrap() else {
        panic!("expected array")
    };
    assert_eq!(items.len(), 1);
}

#[test]
fn decode_storage_pointer_elements() {
    let ty = array_type(struct_item_type(), ArrayKind::Array, Ownership::Full);
    let encoded = ty
        .encode(&Value::Array(vec![Value::Object(boxed_handle())]), false)
        .unwrap();
    let Value::Array(items) = ty.decode(&encoded).unwrap() else {
        panic!("expected array")
    };
    assert_eq!(items.len(), 1);
}

#[test]
fn ptr_to_value_null_yields_empty() {
    let ty = array_type(
        Type::Integer(IntegerKind::I32),
        ArrayKind::Array,
        Ownership::Borrowed,
    );
    let value = unsafe { ty.ptr_to_value(std::ptr::null_mut()) }.unwrap();
    assert!(matches!(value, Value::Array(items) if items.is_empty()));
}

#[test]
fn ptr_to_value_gptrarray() {
    common::run(|| {
        let ty = array_type(
            struct_item_type(),
            ArrayKind::GPtrArray,
            Ownership::Borrowed,
        );
        let ptr_array = unsafe { glib::ffi::g_ptr_array_new() };
        unsafe { glib::ffi::g_ptr_array_add(ptr_array, boxed_handle().ptr()) };
        let value = unsafe { ty.ptr_to_value(ptr_array as *mut c_void) }.unwrap();
        assert!(matches!(value, Value::Array(items) if items.len() == 1));
        unsafe { glib::ffi::g_ptr_array_unref(ptr_array) };
    });
}

#[test]
fn ptr_to_value_gbytearray() {
    common::run(|| {
        let ty = array_type(
            Type::Integer(IntegerKind::U8),
            ArrayKind::GByteArray,
            Ownership::Borrowed,
        );
        let bytes = [9u8];
        let ba = unsafe {
            let ba = glib::ffi::g_byte_array_sized_new(1);
            glib::ffi::g_byte_array_append(ba, bytes.as_ptr(), 1);
            ba
        };
        let value = unsafe { ty.ptr_to_value(ba as *mut c_void) }.unwrap();
        assert!(matches!(value, Value::Array(items) if items.len() == 1));
        unsafe { glib::ffi::g_byte_array_unref(ba) };
    });
}

#[test]
fn ptr_to_value_garray() {
    common::run(|| {
        let ty = array_type(
            Type::Integer(IntegerKind::I32),
            ArrayKind::GArray,
            Ownership::Borrowed,
        );
        let g_array = unsafe { glib::ffi::g_array_sized_new(0, 0, size_of::<i32>() as u32, 0) };
        let value: i32 = 1;
        unsafe {
            glib::ffi::g_array_append_vals(g_array, &value as *const i32 as *const c_void, 1)
        };
        let decoded = unsafe { ty.ptr_to_value(g_array as *mut c_void) }.unwrap();
        assert!(matches!(decoded, Value::Array(items) if items.len() == 1));
        unsafe { glib::ffi::g_array_unref(g_array) };
    });
}

#[test]
fn ptr_to_value_glist() {
    common::run(|| {
        let ty = array_type(struct_item_type(), ArrayKind::GList, Ownership::Borrowed);
        let list = unsafe { glib::ffi::g_list_append(std::ptr::null_mut(), boxed_handle().ptr()) };
        let decoded = unsafe { ty.ptr_to_value(list as *mut c_void) }.unwrap();
        assert!(matches!(decoded, Value::Array(items) if items.len() == 1));
        unsafe { glib::ffi::g_list_free(list) };
    });
}

#[test]
fn ptr_to_value_plain_array() {
    common::run(|| {
        let ty = array_type(struct_item_type(), ArrayKind::Array, Ownership::Borrowed);
        let h0 = boxed_handle();
        let mut data: Vec<*mut c_void> = vec![h0.ptr(), std::ptr::null_mut()];
        let decoded = unsafe { ty.ptr_to_value(data.as_mut_ptr() as *mut c_void) }.unwrap();
        assert!(matches!(decoded, Value::Array(items) if items.len() == 1));
    });
}

#[test]
fn size_from_args_out_of_bounds_fails() {
    let ty = array_type(
        Type::Integer(IntegerKind::I32),
        ArrayKind::Sized { size_index: 5 },
        Ownership::Borrowed,
    );
    let data: Vec<i32> = vec![1];
    let ffi_value = FfiValue::Ptr(data.as_ptr() as *mut c_void);
    assert!(ty.decode_with_context(&ffi_value, &[], &[]).is_err());
}

#[test]
fn size_from_args_reads_integer_argument() {
    let ty = array_type(
        Type::Integer(IntegerKind::I32),
        ArrayKind::Sized { size_index: 0 },
        Ownership::Borrowed,
    );
    let data: Vec<i32> = vec![10, 20];
    let ffi_value = FfiValue::Ptr(data.as_ptr() as *mut c_void);
    let ffi_args = [FfiValue::I32(2)];
    let args = [Arg::new(
        Type::Integer(IntegerKind::I32),
        Value::Number(2.0),
    )];
    let Value::Array(items) = ty
        .decode_with_context(&ffi_value, &ffi_args, &args)
        .unwrap()
    else {
        panic!("expected array")
    };
    assert_eq!(items.len(), 2);
}

#[test]
fn size_from_args_reads_ref_integer_storage() {
    let ty = array_type(
        Type::Integer(IntegerKind::I32),
        ArrayKind::Sized { size_index: 0 },
        Ownership::Borrowed,
    );
    let data: Vec<i32> = vec![10, 20];
    let ffi_value = FfiValue::Ptr(data.as_ptr() as *mut c_void);
    let size_storage = native::ffi::FfiStorage::from(vec![2i32]);
    let ffi_args = [FfiValue::Storage(size_storage)];
    let args = [Arg::new(
        Type::Ref(RefType::new(Type::Integer(IntegerKind::I32))),
        Value::Number(2.0),
    )];
    let Value::Array(items) = ty
        .decode_with_context(&ffi_value, &ffi_args, &args)
        .unwrap()
    else {
        panic!("expected array")
    };
    assert_eq!(items.len(), 2);
}

#[test]
fn size_from_args_reads_ref_integer_ptr() {
    let ty = array_type(
        Type::Integer(IntegerKind::I32),
        ArrayKind::Sized { size_index: 0 },
        Ownership::Borrowed,
    );
    let data: Vec<i32> = vec![10, 20];
    let ffi_value = FfiValue::Ptr(data.as_ptr() as *mut c_void);
    let size: i32 = 2;
    let ffi_args = [FfiValue::Ptr(&size as *const i32 as *mut c_void)];
    let args = [Arg::new(
        Type::Ref(RefType::new(Type::Integer(IntegerKind::I32))),
        Value::Number(2.0),
    )];
    let Value::Array(items) = ty
        .decode_with_context(&ffi_value, &ffi_args, &args)
        .unwrap()
    else {
        panic!("expected array")
    };
    assert_eq!(items.len(), 2);
}

#[test]
fn size_from_args_rejects_unusable_argument() {
    let ty = array_type(
        Type::Integer(IntegerKind::I32),
        ArrayKind::Sized { size_index: 0 },
        Ownership::Borrowed,
    );
    let data: Vec<i32> = vec![1];
    let ffi_value = FfiValue::Ptr(data.as_ptr() as *mut c_void);
    let ffi_args = [FfiValue::Void];
    let args = [Arg::new(Type::Void(VoidType), Value::Null)];
    assert!(
        ty.decode_with_context(&ffi_value, &ffi_args, &args)
            .is_err()
    );
}

#[test]
fn size_from_args_rejects_negative_size() {
    let ty = array_type(
        Type::Integer(IntegerKind::I32),
        ArrayKind::Sized { size_index: 0 },
        Ownership::Borrowed,
    );
    let data: Vec<i32> = vec![1];
    let ffi_value = FfiValue::Ptr(data.as_ptr() as *mut c_void);
    let ffi_args = [FfiValue::I32(-1)];
    let args = [Arg::new(
        Type::Integer(IntegerKind::I32),
        Value::Number(-1.0),
    )];
    assert!(
        ty.decode_with_context(&ffi_value, &ffi_args, &args)
            .is_err()
    );
}

#[test]
fn size_from_args_ref_null_ptr_falls_through_to_error() {
    let ty = array_type(
        Type::Integer(IntegerKind::I32),
        ArrayKind::Sized { size_index: 0 },
        Ownership::Borrowed,
    );
    let data: Vec<i32> = vec![1];
    let ffi_value = FfiValue::Ptr(data.as_ptr() as *mut c_void);
    let ffi_args = [FfiValue::Ptr(std::ptr::null_mut())];
    let args = [Arg::new(
        Type::Ref(RefType::new(Type::Integer(IntegerKind::I32))),
        Value::Number(0.0),
    )];
    assert!(
        ty.decode_with_context(&ffi_value, &ffi_args, &args)
            .is_err()
    );
}

#[test]
fn item_codec_resolves_pointer_kinds() {
    let ty = array_type(struct_item_type(), ArrayKind::Array, Ownership::Full);
    let encoded = ty.encode(&Value::Array(vec![]), false).unwrap();
    assert!(matches!(encoded, FfiValue::Storage(_)));
}

#[test]
fn trait_methods_delegate_to_inherent_implementations() {
    common::run(|| {
        let ty = array_type(
            Type::Integer(IntegerKind::I32),
            ArrayKind::Array,
            Ownership::Borrowed,
        );

        let encoded =
            FfiEncoder::encode(&ty, &Value::Array(vec![Value::Number(1.0)]), false).unwrap();
        let decoded = FfiDecoder::decode(&ty, &encoded).unwrap();
        assert!(matches!(decoded, Value::Array(items) if items.len() == 1));

        let storage = native::ffi::FfiStorage::from(vec![7i32]);
        let with_context =
            FfiDecoder::decode_with_context(&ty, &FfiValue::Storage(storage), &[], &[]).unwrap();
        assert!(matches!(with_context, Value::Array(items) if items.len() == 1));

        let ptr_ty = array_type(struct_item_type(), ArrayKind::Array, Ownership::Borrowed);
        let h0 = boxed_handle();
        let mut data: Vec<*mut c_void> = vec![h0.ptr(), std::ptr::null_mut()];
        let from_ptr =
            RawPtrCodec::ptr_to_value(&ptr_ty, data.as_mut_ptr() as *mut c_void, "ctx").unwrap();
        assert!(matches!(from_ptr, Value::Array(items) if items.len() == 1));
    });
}

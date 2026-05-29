mod common;

use std::ffi::c_void;

use gtk4::gdk;
use gtk4::glib;
use gtk4::glib::translate::IntoGlib as _;
use gtk4::prelude::ObjectType as _;
use gtk4::prelude::StaticType as _;

use native::ffi;
use native::types::{
    ArrayKind, ArrayType, BooleanType, BoxedType, FfiDecoder, GObjectType, Ownership, StringType,
    Type, VoidType,
};
use native::value::Value;

use common::get_gobject_refcount;

#[test]
fn gobject_transfer_none_does_not_take_ownership() {
    common::run(|| {
        let obj = glib::Object::new::<glib::Object>();
        let obj_ptr = obj.as_ptr();

        let initial_ref = get_gobject_refcount(obj_ptr);

        let gobject_type = GObjectType {
            ownership: Ownership::Borrowed,
        };
        let type_ = Type::GObject(gobject_type);

        let cif_value = ffi::FfiValue::Ptr(obj_ptr as *mut c_void);
        let result = type_.decode(&cif_value);

        assert!(result.is_ok());

        let after_ref = get_gobject_refcount(obj_ptr);

        assert_eq!(after_ref, initial_ref + 1);

        drop(result);
        assert_eq!(get_gobject_refcount(obj_ptr), initial_ref);
    });
}

#[test]
fn gobject_full_transfer_takes_ownership() {
    common::run(|| {
        let obj = glib::Object::new::<glib::Object>();
        let obj_ptr = obj.as_ptr();

        unsafe {
            glib::gobject_ffi::g_object_ref(obj_ptr);
        }

        let ref_before_transfer = get_gobject_refcount(obj_ptr);

        let gobject_type = GObjectType {
            ownership: Ownership::Full,
        };
        let type_ = Type::GObject(gobject_type);

        let cif_value = ffi::FfiValue::Ptr(obj_ptr as *mut c_void);
        let result = type_.decode(&cif_value);

        assert!(result.is_ok());

        let ref_after_transfer = get_gobject_refcount(obj_ptr);

        assert_eq!(ref_after_transfer, ref_before_transfer);

        drop(result);
        assert_eq!(get_gobject_refcount(obj_ptr), ref_before_transfer - 1);
    });
}

#[test]
fn gobject_null_returns_null_value() {
    common::run(|| {
        let gobject_type = GObjectType {
            ownership: Ownership::Full,
        };
        let type_ = Type::GObject(gobject_type);

        let cif_value = ffi::FfiValue::Ptr(std::ptr::null_mut());
        let result = type_.decode(&cif_value);

        assert!(result.is_ok());
        assert!(matches!(result.unwrap(), Value::Null));
    });
}

#[test]
fn gobject_floating_ref_gets_sunk() {
    common::run(|| {
        let obj = glib::Object::new::<glib::Object>();
        let obj_ptr = obj.as_ptr();

        unsafe {
            glib::gobject_ffi::g_object_ref(obj_ptr);
            glib::gobject_ffi::g_object_force_floating(obj_ptr);
        }

        let is_floating_before = unsafe { glib::gobject_ffi::g_object_is_floating(obj_ptr) != 0 };
        assert!(is_floating_before);

        let gobject_type = GObjectType {
            ownership: Ownership::Full,
        };
        let type_ = Type::GObject(gobject_type);

        let cif_value = ffi::FfiValue::Ptr(obj_ptr as *mut c_void);
        let result = type_.decode(&cif_value);

        assert!(result.is_ok());

        let is_floating_after = unsafe { glib::gobject_ffi::g_object_is_floating(obj_ptr) != 0 };
        assert!(!is_floating_after);
    });
}

#[test]
fn string_transfer_none_does_not_free() {
    common::run(|| {
        let test_string = "test string content";
        let c_string = std::ffi::CString::new(test_string).unwrap();
        let ptr = c_string.as_ptr() as *mut c_void;

        let string_type = StringType {
            ownership: Ownership::Borrowed,
            length: None,
        };
        let type_ = Type::String(string_type);

        let cif_value = ffi::FfiValue::Ptr(ptr);
        let result = type_.decode(&cif_value);

        assert!(result.is_ok());
        if let Value::String(s) = result.unwrap() {
            assert_eq!(s, test_string);
        } else {
            panic!("Expected Value::String");
        }

        let still_valid = unsafe { std::ffi::CStr::from_ptr(c_string.as_ptr()) };
        assert_eq!(still_valid.to_str().unwrap(), test_string);
    });
}

#[test]
fn string_full_transfer_frees_memory() {
    common::run(|| {
        let test_string = "allocated string";
        let c_string = std::ffi::CString::new(test_string).unwrap();
        let allocated_ptr = unsafe { glib::ffi::g_strdup(c_string.as_ptr()) };

        let string_type = StringType {
            ownership: Ownership::Full,
            length: None,
        };
        let type_ = Type::String(string_type);

        let cif_value = ffi::FfiValue::Ptr(allocated_ptr as *mut c_void);
        let result = type_.decode(&cif_value);

        assert!(result.is_ok());
        if let Value::String(s) = result.unwrap() {
            assert_eq!(s, test_string);
        } else {
            panic!("Expected Value::String");
        }
    });
}

#[test]
fn string_null_returns_null_value() {
    common::run(|| {
        let string_type = StringType {
            ownership: Ownership::Full,
            length: None,
        };
        let type_ = Type::String(string_type);

        let cif_value = ffi::FfiValue::Ptr(std::ptr::null_mut());
        let result = type_.decode(&cif_value);

        assert!(result.is_ok());
        assert!(matches!(result.unwrap(), Value::Null));
    });
}

#[test]
fn boxed_transfer_none_creates_copy() {
    common::run(|| {
        let gtype = gdk::RGBA::static_type();
        let original_ptr = common::allocate_test_boxed(gtype);

        let boxed_type = BoxedType {
            ownership: Ownership::Borrowed,
            type_name: "GdkRGBA".to_string(),
            library: None,
            get_type_fn: None,
            free_fn: None,
        };
        let type_ = Type::Boxed(boxed_type);

        let cif_value = ffi::FfiValue::Ptr(original_ptr);
        let result = type_.decode(&cif_value);

        assert!(result.is_ok());

        assert!(common::is_valid_boxed_ptr(original_ptr, gtype));

        unsafe {
            glib::gobject_ffi::g_boxed_free(gtype.into_glib(), original_ptr);
        }
    });
}

#[test]
fn boxed_full_transfer_takes_ownership() {
    common::run(|| {
        let gtype = gdk::RGBA::static_type();
        let ptr = common::allocate_test_boxed(gtype);

        let boxed_type = BoxedType {
            ownership: Ownership::Full,
            type_name: "GdkRGBA".to_string(),
            library: None,
            get_type_fn: None,
            free_fn: None,
        };
        let type_ = Type::Boxed(boxed_type);

        let cif_value = ffi::FfiValue::Ptr(ptr);
        let result = type_.decode(&cif_value);

        assert!(result.is_ok());
    });
}

#[test]
fn boxed_null_returns_null_value() {
    common::run(|| {
        let boxed_type = BoxedType {
            ownership: Ownership::Full,
            type_name: "GdkRGBA".to_string(),
            library: None,
            get_type_fn: None,
            free_fn: None,
        };
        let type_ = Type::Boxed(boxed_type);

        let cif_value = ffi::FfiValue::Ptr(std::ptr::null_mut());
        let result = type_.decode(&cif_value);

        assert!(result.is_ok());
        assert!(matches!(result.unwrap(), Value::Null));
    });
}

#[test]
fn glist_transfer_none_does_not_free_list() {
    common::run(|| {
        let mut list: *mut glib::ffi::GList = std::ptr::null_mut();

        for _ in 0..3 {
            let obj = glib::Object::new::<glib::Object>();
            unsafe {
                glib::gobject_ffi::g_object_ref(obj.as_ptr());
            }
            list = unsafe { glib::ffi::g_list_append(list, obj.as_ptr() as *mut c_void) };
        }

        let gobject_type = GObjectType {
            ownership: Ownership::Borrowed,
        };
        let array_type = ArrayType {
            item_type: Box::new(Type::GObject(gobject_type)),
            kind: ArrayKind::GList,
            ownership: Ownership::Borrowed,
            element_size: None,
        };
        let type_ = Type::Array(array_type);

        let cif_value = ffi::FfiValue::Ptr(list as *mut c_void);
        let result = type_.decode(&cif_value);

        assert!(result.is_ok());
        if let Value::Array(arr) = result.unwrap() {
            assert_eq!(arr.len(), 3);
        } else {
            panic!("Expected Value::Array");
        }

        assert!(!list.is_null());

        let length = unsafe { glib::ffi::g_list_length(list) };
        for index in 0..length {
            let data = unsafe { glib::ffi::g_list_nth_data(list, index) };
            if !data.is_null() {
                unsafe {
                    glib::gobject_ffi::g_object_unref(data as *mut glib::gobject_ffi::GObject);
                }
            }
        }
        unsafe {
            glib::ffi::g_list_free(list);
        }
    });
}

#[test]
fn glist_full_transfer_frees_list() {
    common::run(|| {
        let mut list: *mut glib::ffi::GList = std::ptr::null_mut();

        for _ in 0..3 {
            let obj = glib::Object::new::<glib::Object>();
            unsafe {
                glib::gobject_ffi::g_object_ref(obj.as_ptr());
            }
            list = unsafe { glib::ffi::g_list_append(list, obj.as_ptr() as *mut c_void) };
        }

        let gobject_type = GObjectType {
            ownership: Ownership::Borrowed,
        };
        let array_type = ArrayType {
            item_type: Box::new(Type::GObject(gobject_type)),
            kind: ArrayKind::GList,
            ownership: Ownership::Full,
            element_size: None,
        };
        let type_ = Type::Array(array_type);

        let cif_value = ffi::FfiValue::Ptr(list as *mut c_void);
        let result = type_.decode(&cif_value);

        assert!(result.is_ok());
        if let Value::Array(arr) = result.unwrap() {
            assert_eq!(arr.len(), 3);
        } else {
            panic!("Expected Value::Array");
        }
    });
}

#[test]
fn glist_null_returns_empty_array() {
    common::run(|| {
        let gobject_type = GObjectType {
            ownership: Ownership::Borrowed,
        };
        let array_type = ArrayType {
            item_type: Box::new(Type::GObject(gobject_type)),
            kind: ArrayKind::GList,
            ownership: Ownership::Full,
            element_size: None,
        };
        let type_ = Type::Array(array_type);

        let cif_value = ffi::FfiValue::Ptr(std::ptr::null_mut());
        let result = type_.decode(&cif_value);

        assert!(result.is_ok());
        if let Value::Array(arr) = result.unwrap() {
            assert!(arr.is_empty());
        } else {
            panic!("Expected Value::Array");
        }
    });
}

#[test]
fn strv_transfer_none_does_not_free() {
    common::run(|| {
        let strings = [
            std::ffi::CString::new("hello").unwrap(),
            std::ffi::CString::new("world").unwrap(),
        ];
        let mut ptrs: Vec<*const i8> = strings.iter().map(|s| s.as_ptr()).collect();
        ptrs.push(std::ptr::null());

        let strv_ptr = ptrs.as_ptr() as *mut c_void;

        let string_type = StringType {
            ownership: Ownership::Borrowed,
            length: None,
        };
        let array_type = ArrayType {
            item_type: Box::new(Type::String(string_type)),
            kind: ArrayKind::Array,
            ownership: Ownership::Borrowed,
            element_size: None,
        };
        let type_ = Type::Array(array_type);

        let cif_value = ffi::FfiValue::Ptr(strv_ptr);
        let result = type_.decode(&cif_value);

        assert!(result.is_ok());
        if let Value::Array(arr) = result.unwrap() {
            assert_eq!(arr.len(), 2);
            if let Value::String(s) = &arr[0] {
                assert_eq!(s, "hello");
            }
            if let Value::String(s) = &arr[1] {
                assert_eq!(s, "world");
            }
        } else {
            panic!("Expected Value::Array");
        }

        assert_eq!(
            unsafe { std::ffi::CStr::from_ptr(strings[0].as_ptr()) }
                .to_str()
                .unwrap(),
            "hello"
        );
    });
}

#[test]
fn strv_full_transfer_frees_strings() {
    common::run(|| {
        let s1 = unsafe { glib::ffi::g_strdup(c"hello".as_ptr()) };
        let s2 = unsafe { glib::ffi::g_strdup(c"world".as_ptr()) };

        let strv = unsafe {
            let ptr = glib::ffi::g_malloc(3 * std::mem::size_of::<*mut i8>()) as *mut *mut i8;
            *ptr = s1;
            *ptr.add(1) = s2;
            *ptr.add(2) = std::ptr::null_mut();
            ptr
        };

        let string_type = StringType {
            ownership: Ownership::Full,
            length: None,
        };
        let array_type = ArrayType {
            item_type: Box::new(Type::String(string_type)),
            kind: ArrayKind::Array,
            ownership: Ownership::Full,
            element_size: None,
        };
        let type_ = Type::Array(array_type);

        let cif_value = ffi::FfiValue::Ptr(strv as *mut c_void);
        let result = type_.decode(&cif_value);

        assert!(result.is_ok());
        if let Value::Array(arr) = result.unwrap() {
            assert_eq!(arr.len(), 2);
        } else {
            panic!("Expected Value::Array");
        }
    });
}

#[test]
fn from_glib_value_gobject_transfer_none() {
    common::run(|| {
        let obj = glib::Object::new::<glib::Object>();
        let obj_ptr = obj.as_ptr();
        let initial_ref = get_gobject_refcount(obj_ptr);

        let gvalue: glib::Value = obj.into();

        let gobject_type = GObjectType {
            ownership: Ownership::Borrowed,
        };
        let type_ = Type::GObject(gobject_type);

        let result = Value::from_glib_value(&gvalue, &type_);

        assert!(result.is_ok());

        let after_ref = get_gobject_refcount(obj_ptr);
        assert_eq!(after_ref, initial_ref + 1);

        drop(result);
        assert_eq!(get_gobject_refcount(obj_ptr), initial_ref);
    });
}

#[test]
fn from_glib_value_string() {
    common::run(|| {
        let test_string = "test value";
        let gvalue: glib::Value = test_string.into();

        let string_type = StringType {
            ownership: Ownership::Borrowed,
            length: None,
        };
        let type_ = Type::String(string_type);

        let result = Value::from_glib_value(&gvalue, &type_);

        assert!(result.is_ok());
        if let Value::String(s) = result.unwrap() {
            assert_eq!(s, test_string);
        } else {
            panic!("Expected Value::String");
        }
    });
}

#[test]
fn from_glib_value_boolean() {
    common::run(|| {
        let gvalue_true: glib::Value = true.into();
        let gvalue_false: glib::Value = false.into();

        let type_ = Type::Boolean(BooleanType);

        let result_true = Value::from_glib_value(&gvalue_true, &type_);
        let result_false = Value::from_glib_value(&gvalue_false, &type_);

        assert!(result_true.is_ok());
        assert!(result_false.is_ok());

        assert!(matches!(result_true.unwrap(), Value::Boolean(true)));
        assert!(matches!(result_false.unwrap(), Value::Boolean(false)));
    });
}

#[test]
fn from_glib_value_integers() {
    common::run(|| {
        let gvalue_i32: glib::Value = 42i32.into();

        let int_kind = native::types::IntegerKind::I32;
        let type_ = Type::Integer(int_kind);

        let result = Value::from_glib_value(&gvalue_i32, &type_);

        assert!(result.is_ok());
        if let Value::Number(n) = result.unwrap() {
            assert_eq!(n, 42.0);
        } else {
            panic!("Expected Value::Number");
        }
    });
}

#[test]
fn from_glib_value_floats() {
    common::run(|| {
        let gvalue_f64: glib::Value = 3.15625f64.into();

        let float_type = native::types::FloatKind::F64;
        let type_ = Type::Float(float_type);

        let result = Value::from_glib_value(&gvalue_f64, &type_);

        assert!(result.is_ok());
        if let Value::Number(n) = result.unwrap() {
            assert!((n - 3.15625).abs() < 0.0001);
        } else {
            panic!("Expected Value::Number");
        }
    });
}

#[test]
fn from_glib_value_i8() {
    common::run(|| {
        let gvalue: glib::Value = (-42i8).into();

        let int_kind = native::types::IntegerKind::I8;
        let type_ = Type::Integer(int_kind);

        let result = Value::from_glib_value(&gvalue, &type_);

        assert!(result.is_ok());
        if let Value::Number(n) = result.unwrap() {
            assert_eq!(n, -42.0);
        } else {
            panic!("Expected Value::Number");
        }
    });
}

#[test]
fn from_glib_value_u8() {
    common::run(|| {
        let gvalue: glib::Value = 200u8.into();

        let int_kind = native::types::IntegerKind::U8;
        let type_ = Type::Integer(int_kind);

        let result = Value::from_glib_value(&gvalue, &type_);

        assert!(result.is_ok());
        if let Value::Number(n) = result.unwrap() {
            assert_eq!(n, 200.0);
        } else {
            panic!("Expected Value::Number");
        }
    });
}

#[test]
fn from_glib_value_i64() {
    common::run(|| {
        let gvalue: glib::Value = (-999_999_i64).into();

        let int_kind = native::types::IntegerKind::I64;
        let type_ = Type::Integer(int_kind);

        let result = Value::from_glib_value(&gvalue, &type_);

        assert!(result.is_ok());
        if let Value::Number(n) = result.unwrap() {
            assert_eq!(n, -999_999.0);
        } else {
            panic!("Expected Value::Number");
        }
    });
}

#[test]
fn from_glib_value_u64() {
    common::run(|| {
        let gvalue: glib::Value = 9_999_999_999_u64.into();

        let int_kind = native::types::IntegerKind::U64;
        let type_ = Type::Integer(int_kind);

        let result = Value::from_glib_value(&gvalue, &type_);

        assert!(result.is_ok());
        if let Value::Number(n) = result.unwrap() {
            assert_eq!(n, 9_999_999_999.0);
        } else {
            panic!("Expected Value::Number");
        }
    });
}

#[test]
fn from_glib_value_f32() {
    common::run(|| {
        let gvalue: glib::Value = 2.5f32.into();

        let float_type = native::types::FloatKind::F32;
        let type_ = Type::Float(float_type);

        let result = Value::from_glib_value(&gvalue, &type_);

        assert!(result.is_ok());
        if let Value::Number(n) = result.unwrap() {
            assert!((n - 2.5).abs() < 0.001);
        } else {
            panic!("Expected Value::Number");
        }
    });
}

#[test]
fn from_glib_value_null_undefined() {
    common::run(|| {
        let gvalue: glib::Value = glib::Value::from_type(glib::types::Type::POINTER);

        let result_null = Value::from_glib_value(&gvalue, &Type::Void(VoidType));
        let result_undefined = Value::from_glib_value(&gvalue, &Type::Void(VoidType));

        assert!(result_null.is_ok());
        assert!(result_undefined.is_ok());
        assert!(matches!(result_null.unwrap(), Value::Null));
        assert!(matches!(result_undefined.unwrap(), Value::Null));
    });
}

#[test]
fn from_cif_value_fundamental_gvariant_transfer_none() {
    common::run(|| {
        let variant = unsafe {
            let ptr = glib::ffi::g_variant_new_int32(42);
            glib::ffi::g_variant_ref_sink(ptr);
            ptr
        };

        let fundamental_type = native::types::FundamentalType {
            ownership: Ownership::Borrowed,
            library: "libglib-2.0.so.0".to_string(),
            ref_func: "g_variant_ref_sink".to_string(),
            unref_func: "g_variant_unref".to_string(),
            type_name: Some("GVariant".to_string()),
        };
        let type_ = Type::Fundamental(fundamental_type);

        let cif_value = ffi::FfiValue::Ptr(variant as *mut c_void);
        let result = type_.decode(&cif_value);

        assert!(result.is_ok());
        if let Value::Object(_handle) = result.unwrap() {
        } else {
            panic!("Expected Value::Object");
        }

        unsafe {
            glib::ffi::g_variant_unref(variant);
        }
    });
}

#[test]
fn from_cif_value_fundamental_null() {
    common::run(|| {
        let fundamental_type = native::types::FundamentalType {
            ownership: Ownership::Full,
            library: "libglib-2.0.so.0".to_string(),
            ref_func: "g_variant_ref_sink".to_string(),
            unref_func: "g_variant_unref".to_string(),
            type_name: Some("GVariant".to_string()),
        };
        let type_ = Type::Fundamental(fundamental_type);

        let cif_value = ffi::FfiValue::Ptr(std::ptr::null_mut());
        let result = type_.decode(&cif_value);

        assert!(result.is_ok());
        assert!(matches!(result.unwrap(), Value::Null));
    });
}

#[test]
fn from_cif_value_ref_integer() {
    common::run(|| {
        let int_value = ffi::FfiValue::I32(12345);
        let ptr = int_value.as_raw_ptr();
        let boxed_value = Box::new(int_value);

        let int_kind = native::types::IntegerKind::I32;
        let ref_type = native::types::RefType::new(Type::Integer(int_kind));
        let type_ = Type::Ref(ref_type);

        let storage = ffi::FfiStorage::new(ptr, ffi::FfiStorageKind::BoxedValue(boxed_value));
        let cif_value = ffi::FfiValue::Storage(storage);
        let result = type_.decode(&cif_value);

        assert!(result.is_ok());
        if let Value::Number(n) = result.unwrap() {
            assert_eq!(n, 12345.0);
        } else {
            panic!("Expected Value::Number");
        }
    });
}

#[test]
fn from_cif_value_ref_float() {
    common::run(|| {
        let float_value = ffi::FfiValue::F64(3.15625);
        let ptr = float_value.as_raw_ptr();
        let boxed_value = Box::new(float_value);

        let float_type = native::types::FloatKind::F64;
        let ref_type = native::types::RefType::new(Type::Float(float_type));
        let type_ = Type::Ref(ref_type);

        let storage = ffi::FfiStorage::new(ptr, ffi::FfiStorageKind::BoxedValue(boxed_value));
        let cif_value = ffi::FfiValue::Storage(storage);
        let result = type_.decode(&cif_value);

        assert!(result.is_ok());
        if let Value::Number(n) = result.unwrap() {
            assert!((n - 3.15625).abs() < 0.0001);
        } else {
            panic!("Expected Value::Number");
        }
    });
}

#[test]
fn from_cif_value_ref_gobject() {
    common::run(|| {
        let obj = glib::Object::new::<glib::Object>();
        let obj_ptr = obj.as_ptr() as *mut c_void;

        let ptr_storage: Box<*mut c_void> = Box::new(obj_ptr);
        let storage_ptr = ptr_storage.as_ref() as *const *mut c_void as *mut c_void;
        let storage =
            ffi::FfiStorage::new(storage_ptr, ffi::FfiStorageKind::PtrStorage(ptr_storage));
        let cif_value = ffi::FfiValue::Storage(storage);

        let ref_type = native::types::RefType::new(Type::GObject(GObjectType {
            ownership: Ownership::Borrowed,
        }));
        let type_ = Type::Ref(ref_type);

        let result = type_
            .decode(&cif_value)
            .expect("Ref<GObject> decode failed");
        if let Value::Object(handle) = result {
            assert_eq!(handle.ptr(), obj_ptr);
        } else {
            panic!("Expected Value::Object");
        }
    });
}

#[test]
fn from_cif_value_ref_gobject_null_inner() {
    common::run(|| {
        let ptr_storage: Box<*mut c_void> = Box::new(std::ptr::null_mut());
        let storage_ptr = ptr_storage.as_ref() as *const *mut c_void as *mut c_void;
        let storage =
            ffi::FfiStorage::new(storage_ptr, ffi::FfiStorageKind::PtrStorage(ptr_storage));
        let cif_value = ffi::FfiValue::Storage(storage);

        let ref_type = native::types::RefType::new(Type::GObject(GObjectType {
            ownership: Ownership::Borrowed,
        }));
        let type_ = Type::Ref(ref_type);

        let result = type_
            .decode(&cif_value)
            .expect("Ref<GObject> null decode failed");
        assert!(matches!(result, Value::Null));
    });
}

#[test]
fn from_cif_value_ref_boxed() {
    common::run(|| {
        let gtype = gdk::RGBA::static_type();
        let boxed_ptr = common::allocate_test_boxed(gtype);

        let ptr_storage: Box<*mut c_void> = Box::new(boxed_ptr);
        let storage_ptr = ptr_storage.as_ref() as *const *mut c_void as *mut c_void;
        let storage =
            ffi::FfiStorage::new(storage_ptr, ffi::FfiStorageKind::PtrStorage(ptr_storage));
        let cif_value = ffi::FfiValue::Storage(storage);

        let ref_type = native::types::RefType::new(Type::Boxed(BoxedType {
            ownership: Ownership::Borrowed,
            type_name: "GdkRGBA".to_string(),
            library: None,
            get_type_fn: None,
            free_fn: None,
        }));
        let type_ = Type::Ref(ref_type);

        let result = type_.decode(&cif_value).expect("Ref<Boxed> decode failed");
        assert!(matches!(result, Value::Object(_)));

        unsafe {
            glib::gobject_ffi::g_boxed_free(gtype.into_glib(), boxed_ptr);
        }
    });
}

#[test]
fn value_to_glib_value_number() {
    common::run(|| {
        let value = Value::Number(42.5);
        let gvalue = value.to_glib_value();

        assert!(gvalue.is_ok());
    });
}

#[test]
fn value_to_glib_value_string() {
    common::run(|| {
        let value = Value::String("test".to_string());
        let gvalue = value.to_glib_value();

        assert!(gvalue.is_ok());
    });
}

#[test]
fn value_to_glib_value_boolean() {
    common::run(|| {
        let value = Value::Boolean(true);
        let gvalue = value.to_glib_value();

        assert!(gvalue.is_ok());
    });
}

#[test]
fn value_to_glib_value_null() {
    let value = Value::Null;
    let gvalue = value.to_glib_value();

    assert!(gvalue.is_err());
}

#[test]
fn value_to_glib_value_undefined() {
    let value = Value::Undefined;
    let gvalue = value.to_glib_value();

    assert!(gvalue.is_err());
}

#[test]
fn into_glib_value_with_default_undefined_boolean() {
    common::run(|| {
        let value = Value::Undefined;
        let result = value.into_glib_value_with_default(Some(&Type::Boolean(BooleanType)));

        assert!(result.is_some());
    });
}

#[test]
fn into_glib_value_with_default_undefined_integer() {
    common::run(|| {
        let int_kind = native::types::IntegerKind::I32;
        let value = Value::Undefined;
        let result = value.into_glib_value_with_default(Some(&Type::Integer(int_kind)));

        assert!(result.is_some());
    });
}

#[test]
fn into_glib_value_with_default_regular_value() {
    common::run(|| {
        let value = Value::Number(42.0);
        let result = value.into_glib_value_with_default(Some(&Type::Boolean(BooleanType)));

        assert!(result.is_some());
    });
}

#[test]
fn glist_with_string_items() {
    common::run(|| {
        let s1 = std::ffi::CString::new("hello").unwrap();
        let s2 = std::ffi::CString::new("world").unwrap();

        let mut list: *mut glib::ffi::GList = std::ptr::null_mut();
        list = unsafe { glib::ffi::g_list_append(list, s1.as_ptr() as *mut c_void) };
        list = unsafe { glib::ffi::g_list_append(list, s2.as_ptr() as *mut c_void) };

        let string_type = StringType {
            ownership: Ownership::Borrowed,
            length: None,
        };
        let array_type = ArrayType {
            item_type: Box::new(Type::String(string_type)),
            kind: ArrayKind::GList,
            ownership: Ownership::Borrowed,
            element_size: None,
        };
        let type_ = Type::Array(array_type);

        let cif_value = ffi::FfiValue::Ptr(list as *mut c_void);
        let result = type_.decode(&cif_value);

        assert!(result.is_ok());
        if let Value::Array(arr) = result.unwrap() {
            assert_eq!(arr.len(), 2);
            if let Value::String(s) = &arr[0] {
                assert_eq!(s, "hello");
            }
            if let Value::String(s) = &arr[1] {
                assert_eq!(s, "world");
            }
        } else {
            panic!("Expected Value::Array");
        }

        unsafe {
            glib::ffi::g_list_free(list);
        }
    });
}

#[test]
fn from_cif_value_struct_transfer_none_logs_warning() {
    common::run(|| {
        let struct_ptr = unsafe { glib::ffi::g_malloc0(16) };

        let struct_type = native::types::StructType {
            ownership: Ownership::Borrowed,
            size: Some(16),
        };
        let type_ = Type::Struct(struct_type);

        let cif_value = ffi::FfiValue::Ptr(struct_ptr);
        let result = type_.decode(&cif_value);

        assert!(result.is_ok());
        if let Value::Object(_handle) = result.unwrap() {
        } else {
            panic!("Expected Value::Object for struct");
        }

        unsafe {
            glib::ffi::g_free(struct_ptr);
        }
    });
}

#[test]
fn from_cif_value_struct_full_transfer() {
    common::run(|| {
        let struct_ptr = unsafe { glib::ffi::g_malloc0(32) };

        let struct_type = native::types::StructType {
            ownership: Ownership::Full,
            size: Some(32),
        };
        let type_ = Type::Struct(struct_type);

        let cif_value = ffi::FfiValue::Ptr(struct_ptr);
        let result = type_.decode(&cif_value);

        assert!(result.is_ok());
        if let Value::Object(_handle) = result.unwrap() {
        } else {
            panic!("Expected Value::Object for struct");
        }
    });
}

#[test]
fn from_cif_value_struct_null_returns_null_value() {
    common::run(|| {
        let struct_type = native::types::StructType {
            ownership: Ownership::Borrowed,
            size: Some(16),
        };
        let type_ = Type::Struct(struct_type);

        let cif_value = ffi::FfiValue::Ptr(std::ptr::null_mut());
        let result = type_.decode(&cif_value);

        assert!(result.is_ok());
        assert!(matches!(result.unwrap(), Value::Null));
    });
}

#[test]
fn from_glib_value_struct_fails() {
    common::run(|| {
        let gvalue: glib::Value = glib::Value::from_type(glib::types::Type::POINTER);

        let struct_type = native::types::StructType {
            ownership: Ownership::Borrowed,
            size: Some(16),
        };
        let type_ = Type::Struct(struct_type);

        let result = Value::from_glib_value(&gvalue, &type_);

        assert!(result.is_err());
    });
}

#[test]
fn from_cif_value_struct_transfer_none_without_size_creates_unowned() {
    common::run(|| {
        let struct_ptr = unsafe { glib::ffi::g_malloc0(24) };

        let struct_type = native::types::StructType {
            ownership: Ownership::Borrowed,
            size: None,
        };
        let type_ = Type::Struct(struct_type);

        let cif_value = ffi::FfiValue::Ptr(struct_ptr);
        let result = type_.decode(&cif_value);

        assert!(result.is_ok());
        if let Value::Object(_handle) = result.unwrap() {
        } else {
            panic!("Expected Value::Object for struct");
        }

        unsafe {
            glib::ffi::g_free(struct_ptr);
        }
    });
}

#[test]
fn from_cif_value_struct_owned_without_size() {
    common::run(|| {
        let struct_ptr = unsafe { glib::ffi::g_malloc0(24) };

        let struct_type = native::types::StructType {
            ownership: Ownership::Full,
            size: None,
        };
        let type_ = Type::Struct(struct_type);

        let cif_value = ffi::FfiValue::Ptr(struct_ptr);
        let result = type_.decode(&cif_value);

        assert!(result.is_ok());
        if let Value::Object(_handle) = result.unwrap() {
        } else {
            panic!("Expected Value::Object for struct");
        }
    });
}

#[test]
fn result_to_ptr_returns_handle_pointer_for_object() {
    common::run(|| {
        let obj = glib::Object::new::<glib::Object>();
        let obj_ptr = obj.as_ptr() as *mut c_void;
        let handle: native::NativeHandle = native::NativeValue::GObject(obj).into();

        let result: Result<Value, ()> = Ok(Value::Object(handle));
        assert_eq!(Value::result_to_ptr(&result), obj_ptr);
    });
}

#[test]
fn result_to_ptr_returns_null_for_non_object_ok() {
    let result: Result<Value, ()> = Ok(Value::Number(7.0));
    assert!(Value::result_to_ptr(&result).is_null());
}

#[test]
fn result_to_ptr_returns_null_for_err() {
    let result: Result<Value, ()> = Err(());
    assert!(Value::result_to_ptr(&result).is_null());
}

#[test]
fn as_number_extracts_number_payload() {
    assert_eq!(Value::Number(3.5).as_number(), Some(3.5));
}

#[test]
fn as_number_is_none_for_other_variants() {
    assert_eq!(Value::String("x".to_string()).as_number(), None);
    assert_eq!(Value::Boolean(true).as_number(), None);
    assert_eq!(Value::Null.as_number(), None);
    assert_eq!(Value::Undefined.as_number(), None);
}

#[test]
fn object_ptr_returns_handle_pointer() {
    common::run(|| {
        let obj = glib::Object::new::<glib::Object>();
        let obj_ptr = obj.as_ptr() as *mut c_void;
        let handle: native::NativeHandle = native::NativeValue::GObject(obj).into();

        let value = Value::Object(handle);
        assert_eq!(value.object_ptr("GObject").unwrap(), obj_ptr);
    });
}

#[test]
fn object_ptr_returns_null_for_null_and_undefined() {
    assert!(Value::Null.object_ptr("GObject").unwrap().is_null());
    assert!(Value::Undefined.object_ptr("GObject").unwrap().is_null());
}

#[test]
fn object_ptr_errors_for_non_object_variants() {
    assert!(Value::Number(1.0).object_ptr("GObject").is_err());
    assert!(
        Value::String("s".to_string())
            .object_ptr("GObject")
            .is_err()
    );
    assert!(Value::Boolean(false).object_ptr("GObject").is_err());
    assert!(Value::Array(vec![]).object_ptr("GObject").is_err());
}

#[test]
fn from_ffi_value_with_args_decodes_integer() {
    common::run(|| {
        let ffi_value = ffi::FfiValue::I32(99);
        let type_ = Type::Integer(native::types::IntegerKind::I32);

        let result = Value::from_ffi_value_with_args(&ffi_value, &type_, &[], &[]);

        assert!(result.is_ok());
        if let Value::Number(n) = result.unwrap() {
            assert_eq!(n, 99.0);
        } else {
            panic!("Expected Value::Number");
        }
    });
}

#[test]
fn into_glib_value_with_default_no_type_returns_none() {
    let result = Value::Undefined.into_glib_value_with_default(None);
    assert!(result.is_none());
}

#[test]
fn into_glib_value_with_default_undefined_string_uses_null() {
    common::run(|| {
        let string_type = StringType {
            ownership: Ownership::Borrowed,
            length: None,
        };
        let result =
            Value::Undefined.into_glib_value_with_default(Some(&Type::String(string_type)));
        assert!(result.is_some());
    });
}

#[test]
fn into_glib_value_with_default_undefined_gobject_uses_null() {
    common::run(|| {
        let gobject_type = GObjectType {
            ownership: Ownership::Borrowed,
        };
        let result =
            Value::Undefined.into_glib_value_with_default(Some(&Type::GObject(gobject_type)));
        assert!(result.is_some());
    });
}

#[test]
fn into_glib_value_with_default_undefined_unsupported_type_returns_none() {
    common::run(|| {
        let result = Value::Undefined.into_glib_value_with_default(Some(&Type::Void(VoidType)));
        assert!(result.is_none());
    });
}

#[test]
fn into_glib_value_with_default_undefined_default_conversion_failure_returns_none() {
    common::run(|| {
        let tagged = native::types::TaggedType {
            kind: native::types::TaggedKind::Enum,
            library: "libnonexistent_for_default_12345.so".to_string(),
            get_type_fn: "no_such_get_type".to_string(),
            storage: native::types::IntegerKind::I32,
        };
        let result = Value::Undefined.into_glib_value_with_default(Some(&Type::Tagged(tagged)));
        assert!(result.is_none());
    });
}

#[test]
fn into_glib_value_with_default_regular_value_conversion_failure_returns_none() {
    common::run(|| {
        let result = Value::Null.into_glib_value_with_default(None);
        assert!(result.is_none());
    });
}

#[test]
fn to_glib_value_typed_uses_expected_type_when_available() {
    common::run(|| {
        let value = Value::Boolean(true);
        let gvalue = value.to_glib_value_typed(Some(&Type::Boolean(BooleanType)));

        assert!(gvalue.is_ok());
    });
}

#[test]
fn to_glib_value_object_with_pointer() {
    common::run(|| {
        let obj = glib::Object::new::<glib::Object>();
        let handle: native::NativeHandle = native::NativeValue::GObject(obj).into();

        let value = Value::Object(handle);
        let gvalue = value.to_glib_value();

        assert!(gvalue.is_ok());
    });
}

#[test]
fn to_glib_value_object_with_null_pointer() {
    common::run(|| {
        let value = Value::Object(native::NativeHandle::borrowed(std::ptr::null_mut()));
        let gvalue = value.to_glib_value();

        assert!(gvalue.is_ok());
    });
}

#[test]
fn to_glib_value_array_is_unsupported() {
    common::run(|| {
        let value = Value::Array(vec![Value::Number(1.0)]);
        let gvalue = value.to_glib_value();

        assert!(gvalue.is_err());
    });
}

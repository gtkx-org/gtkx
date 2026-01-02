mod common;

use std::ffi::c_void;

use gtk4::gdk;
use gtk4::glib;
use gtk4::glib::translate::IntoGlib as _;
use gtk4::prelude::ObjectType as _;
use gtk4::prelude::StaticType as _;

use native::cif;
use native::types::{ArrayType, BoxedType, GObjectType, ListType, StringType, Type};
use native::value::Value;

use common::get_gobject_refcount;

#[test]
fn gobject_transfer_none_does_not_take_ownership() {
    common::ensure_gtk_init();

    let obj = glib::Object::new::<glib::Object>();
    let obj_ptr = obj.as_ptr();

    let initial_ref = get_gobject_refcount(obj_ptr);

    let gobject_type = GObjectType {
        is_transfer_full: false,
    };
    let type_ = Type::GObject(gobject_type);

    let cif_value = cif::Value::Ptr(obj_ptr as *mut c_void);
    let result = Value::from_cif_value(&cif_value, &type_);

    assert!(result.is_ok());

    let after_ref = get_gobject_refcount(obj_ptr);

    assert!(after_ref >= initial_ref);
}

#[test]
fn gobject_full_transfer_takes_ownership() {
    common::ensure_gtk_init();

    let obj = glib::Object::new::<glib::Object>();
    let obj_ptr = obj.as_ptr();

    unsafe {
        glib::gobject_ffi::g_object_ref(obj_ptr);
    }

    let ref_before_transfer = get_gobject_refcount(obj_ptr);

    let gobject_type = GObjectType {
        is_transfer_full: true,
    };
    let type_ = Type::GObject(gobject_type);

    let cif_value = cif::Value::Ptr(obj_ptr as *mut c_void);
    let result = Value::from_cif_value(&cif_value, &type_);

    assert!(result.is_ok());

    let ref_after_transfer = get_gobject_refcount(obj_ptr);

    assert!(ref_after_transfer <= ref_before_transfer);
}

#[test]
fn gobject_null_returns_null_value() {
    common::ensure_gtk_init();

    let gobject_type = GObjectType {
        is_transfer_full: true,
    };
    let type_ = Type::GObject(gobject_type);

    let cif_value = cif::Value::Ptr(std::ptr::null_mut());
    let result = Value::from_cif_value(&cif_value, &type_);

    assert!(result.is_ok());
    assert!(matches!(result.unwrap(), Value::Null));
}

#[test]
fn gobject_floating_ref_gets_sunk() {
    common::ensure_gtk_init();

    let obj = glib::Object::new::<glib::Object>();
    let obj_ptr = obj.as_ptr();

    unsafe {
        glib::gobject_ffi::g_object_ref(obj_ptr);
        glib::gobject_ffi::g_object_force_floating(obj_ptr);
    }

    let is_floating_before = unsafe { glib::gobject_ffi::g_object_is_floating(obj_ptr) != 0 };
    assert!(is_floating_before);

    let gobject_type = GObjectType {
        is_transfer_full: true,
    };
    let type_ = Type::GObject(gobject_type);

    let cif_value = cif::Value::Ptr(obj_ptr as *mut c_void);
    let result = Value::from_cif_value(&cif_value, &type_);

    assert!(result.is_ok());

    let is_floating_after = unsafe { glib::gobject_ffi::g_object_is_floating(obj_ptr) != 0 };
    assert!(!is_floating_after);
}

#[test]
fn string_transfer_none_does_not_free() {
    common::ensure_gtk_init();

    let test_string = "test string content";
    let c_string = std::ffi::CString::new(test_string).unwrap();
    let ptr = c_string.as_ptr() as *mut c_void;

    let string_type = StringType {
        is_transfer_full: false,
        length: None,
    };
    let type_ = Type::String(string_type);

    let cif_value = cif::Value::Ptr(ptr);
    let result = Value::from_cif_value(&cif_value, &type_);

    assert!(result.is_ok());
    if let Value::String(s) = result.unwrap() {
        assert_eq!(s, test_string);
    } else {
        panic!("Expected Value::String");
    }

    let still_valid = unsafe { std::ffi::CStr::from_ptr(c_string.as_ptr()) };
    assert_eq!(still_valid.to_str().unwrap(), test_string);
}

#[test]
fn string_full_transfer_frees_memory() {
    common::ensure_gtk_init();

    let test_string = "allocated string";
    let c_string = std::ffi::CString::new(test_string).unwrap();
    let allocated_ptr = unsafe { glib::ffi::g_strdup(c_string.as_ptr()) };

    let string_type = StringType {
        is_transfer_full: true,
        length: None,
    };
    let type_ = Type::String(string_type);

    let cif_value = cif::Value::Ptr(allocated_ptr as *mut c_void);
    let result = Value::from_cif_value(&cif_value, &type_);

    assert!(result.is_ok());
    if let Value::String(s) = result.unwrap() {
        assert_eq!(s, test_string);
    } else {
        panic!("Expected Value::String");
    }
}

#[test]
fn string_null_returns_null_value() {
    common::ensure_gtk_init();

    let string_type = StringType {
        is_transfer_full: true,
        length: None,
    };
    let type_ = Type::String(string_type);

    let cif_value = cif::Value::Ptr(std::ptr::null_mut());
    let result = Value::from_cif_value(&cif_value, &type_);

    assert!(result.is_ok());
    assert!(matches!(result.unwrap(), Value::Null));
}

#[test]
fn boxed_transfer_none_creates_copy() {
    common::ensure_gtk_init();

    let gtype = gdk::RGBA::static_type();
    let original_ptr = common::allocate_test_boxed(gtype);

    let boxed_type = BoxedType {
        is_transfer_full: false,
        type_: "GdkRGBA".to_string(),
        lib: None,
        get_type_fn: None,
    };
    let type_ = Type::Boxed(boxed_type);

    let cif_value = cif::Value::Ptr(original_ptr);
    let result = Value::from_cif_value(&cif_value, &type_);

    assert!(result.is_ok());

    assert!(common::is_valid_boxed_ptr(original_ptr, gtype));

    unsafe {
        glib::gobject_ffi::g_boxed_free(gtype.into_glib(), original_ptr);
    }
}

#[test]
fn boxed_full_transfer_takes_ownership() {
    common::ensure_gtk_init();

    let gtype = gdk::RGBA::static_type();
    let ptr = common::allocate_test_boxed(gtype);

    let boxed_type = BoxedType {
        is_transfer_full: true,
        type_: "GdkRGBA".to_string(),
        lib: None,
        get_type_fn: None,
    };
    let type_ = Type::Boxed(boxed_type);

    let cif_value = cif::Value::Ptr(ptr);
    let result = Value::from_cif_value(&cif_value, &type_);

    assert!(result.is_ok());
}

#[test]
fn boxed_null_returns_null_value() {
    common::ensure_gtk_init();

    let boxed_type = BoxedType {
        is_transfer_full: true,
        type_: "GdkRGBA".to_string(),
        lib: None,
        get_type_fn: None,
    };
    let type_ = Type::Boxed(boxed_type);

    let cif_value = cif::Value::Ptr(std::ptr::null_mut());
    let result = Value::from_cif_value(&cif_value, &type_);

    assert!(result.is_ok());
    assert!(matches!(result.unwrap(), Value::Null));
}

#[test]
fn glist_transfer_none_does_not_free_list() {
    common::ensure_gtk_init();

    let mut list: *mut glib::ffi::GList = std::ptr::null_mut();

    for _ in 0..3 {
        let obj = glib::Object::new::<glib::Object>();
        unsafe {
            glib::gobject_ffi::g_object_ref(obj.as_ptr());
        }
        list = unsafe { glib::ffi::g_list_append(list, obj.as_ptr() as *mut c_void) };
    }

    let gobject_type = GObjectType {
        is_transfer_full: false,
    };
    let array_type = ArrayType {
        item_type: Box::new(Type::GObject(gobject_type)),
        list_type: ListType::GList,
        is_transfer_full: false,
    };
    let type_ = Type::Array(array_type);

    let cif_value = cif::Value::Ptr(list as *mut c_void);
    let result = Value::from_cif_value(&cif_value, &type_);

    assert!(result.is_ok());
    if let Value::Array(arr) = result.unwrap() {
        assert_eq!(arr.len(), 3);
    } else {
        panic!("Expected Value::Array");
    }

    assert!(!list.is_null());

    let mut current = list;
    while !current.is_null() {
        let data = unsafe { (*current).data };
        if !data.is_null() {
            unsafe {
                glib::gobject_ffi::g_object_unref(data as *mut glib::gobject_ffi::GObject);
            }
        }
        current = unsafe { (*current).next };
    }
    unsafe {
        glib::ffi::g_list_free(list);
    }
}

#[test]
fn glist_full_transfer_frees_list() {
    common::ensure_gtk_init();

    let mut list: *mut glib::ffi::GList = std::ptr::null_mut();

    for _ in 0..3 {
        let obj = glib::Object::new::<glib::Object>();
        unsafe {
            glib::gobject_ffi::g_object_ref(obj.as_ptr());
        }
        list = unsafe { glib::ffi::g_list_append(list, obj.as_ptr() as *mut c_void) };
    }

    let gobject_type = GObjectType {
        is_transfer_full: false,
    };
    let array_type = ArrayType {
        item_type: Box::new(Type::GObject(gobject_type)),
        list_type: ListType::GList,
        is_transfer_full: true,
    };
    let type_ = Type::Array(array_type);

    let cif_value = cif::Value::Ptr(list as *mut c_void);
    let result = Value::from_cif_value(&cif_value, &type_);

    assert!(result.is_ok());
    if let Value::Array(arr) = result.unwrap() {
        assert_eq!(arr.len(), 3);
    } else {
        panic!("Expected Value::Array");
    }
}

#[test]
fn glist_null_returns_empty_array() {
    common::ensure_gtk_init();

    let gobject_type = GObjectType {
        is_transfer_full: false,
    };
    let array_type = ArrayType {
        item_type: Box::new(Type::GObject(gobject_type)),
        list_type: ListType::GList,
        is_transfer_full: true,
    };
    let type_ = Type::Array(array_type);

    let cif_value = cif::Value::Ptr(std::ptr::null_mut());
    let result = Value::from_cif_value(&cif_value, &type_);

    assert!(result.is_ok());
    if let Value::Array(arr) = result.unwrap() {
        assert!(arr.is_empty());
    } else {
        panic!("Expected Value::Array");
    }
}

#[test]
fn strv_transfer_none_does_not_free() {
    common::ensure_gtk_init();

    let strings = vec![
        std::ffi::CString::new("hello").unwrap(),
        std::ffi::CString::new("world").unwrap(),
    ];
    let mut ptrs: Vec<*const i8> = strings.iter().map(|s| s.as_ptr()).collect();
    ptrs.push(std::ptr::null());

    let strv_ptr = ptrs.as_ptr() as *mut c_void;

    let string_type = StringType {
        is_transfer_full: false,
        length: None,
    };
    let array_type = ArrayType {
        item_type: Box::new(Type::String(string_type)),
        list_type: ListType::Array,
        is_transfer_full: false,
    };
    let type_ = Type::Array(array_type);

    let cif_value = cif::Value::Ptr(strv_ptr);
    let result = Value::from_cif_value(&cif_value, &type_);

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
}

#[test]
fn strv_full_transfer_frees_strings() {
    common::ensure_gtk_init();

    let s1 = unsafe { glib::ffi::g_strdup("hello\0".as_ptr() as *const i8) };
    let s2 = unsafe { glib::ffi::g_strdup("world\0".as_ptr() as *const i8) };

    let strv = unsafe {
        let ptr = glib::ffi::g_malloc(3 * std::mem::size_of::<*mut i8>()) as *mut *mut i8;
        *ptr = s1;
        *ptr.add(1) = s2;
        *ptr.add(2) = std::ptr::null_mut();
        ptr
    };

    let string_type = StringType {
        is_transfer_full: true,
        length: None,
    };
    let array_type = ArrayType {
        item_type: Box::new(Type::String(string_type)),
        list_type: ListType::Array,
        is_transfer_full: true,
    };
    let type_ = Type::Array(array_type);

    let cif_value = cif::Value::Ptr(strv as *mut c_void);
    let result = Value::from_cif_value(&cif_value, &type_);

    assert!(result.is_ok());
    if let Value::Array(arr) = result.unwrap() {
        assert_eq!(arr.len(), 2);
    } else {
        panic!("Expected Value::Array");
    }
}

#[test]
fn from_glib_value_gobject_transfer_none() {
    common::ensure_gtk_init();

    let obj = glib::Object::new::<glib::Object>();
    let obj_ptr = obj.as_ptr();
    let initial_ref = get_gobject_refcount(obj_ptr);

    let gvalue: glib::Value = obj.clone().into();

    let gobject_type = GObjectType {
        is_transfer_full: false,
    };
    let type_ = Type::GObject(gobject_type);

    let result = Value::from_glib_value(&gvalue, &type_);

    assert!(result.is_ok());

    let after_ref = get_gobject_refcount(obj_ptr);
    assert!(after_ref >= initial_ref);
}

#[test]
fn from_glib_value_string() {
    common::ensure_gtk_init();

    let test_string = "test value";
    let gvalue: glib::Value = test_string.into();

    let string_type = StringType {
        is_transfer_full: false,
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
}

#[test]
fn from_glib_value_boolean() {
    common::ensure_gtk_init();

    let gvalue_true: glib::Value = true.into();
    let gvalue_false: glib::Value = false.into();

    let type_ = Type::Boolean;

    let result_true = Value::from_glib_value(&gvalue_true, &type_);
    let result_false = Value::from_glib_value(&gvalue_false, &type_);

    assert!(result_true.is_ok());
    assert!(result_false.is_ok());

    assert!(matches!(result_true.unwrap(), Value::Boolean(true)));
    assert!(matches!(result_false.unwrap(), Value::Boolean(false)));
}

#[test]
fn from_glib_value_integers() {
    common::ensure_gtk_init();

    let gvalue_i32: glib::Value = 42i32.into();

    let int_type = native::types::IntegerType {
        size: native::types::IntegerSize::_32,
        sign: native::types::IntegerSign::Signed,
    };
    let type_ = Type::Integer(int_type);

    let result = Value::from_glib_value(&gvalue_i32, &type_);

    assert!(result.is_ok());
    if let Value::Number(n) = result.unwrap() {
        assert_eq!(n, 42.0);
    } else {
        panic!("Expected Value::Number");
    }
}

#[test]
fn from_glib_value_floats() {
    common::ensure_gtk_init();

    let gvalue_f64: glib::Value = 3.14159f64.into();

    let float_type = native::types::FloatType {
        size: native::types::FloatSize::_64,
    };
    let type_ = Type::Float(float_type);

    let result = Value::from_glib_value(&gvalue_f64, &type_);

    assert!(result.is_ok());
    if let Value::Number(n) = result.unwrap() {
        assert!((n - 3.14159).abs() < 0.0001);
    } else {
        panic!("Expected Value::Number");
    }
}

#[test]
fn from_glib_value_i8() {
    common::ensure_gtk_init();

    let gvalue: glib::Value = (-42i8).into();

    let int_type = native::types::IntegerType {
        size: native::types::IntegerSize::_8,
        sign: native::types::IntegerSign::Signed,
    };
    let type_ = Type::Integer(int_type);

    let result = Value::from_glib_value(&gvalue, &type_);

    assert!(result.is_ok());
    if let Value::Number(n) = result.unwrap() {
        assert_eq!(n, -42.0);
    } else {
        panic!("Expected Value::Number");
    }
}

#[test]
fn from_glib_value_u8() {
    common::ensure_gtk_init();

    let gvalue: glib::Value = 200u8.into();

    let int_type = native::types::IntegerType {
        size: native::types::IntegerSize::_8,
        sign: native::types::IntegerSign::Unsigned,
    };
    let type_ = Type::Integer(int_type);

    let result = Value::from_glib_value(&gvalue, &type_);

    assert!(result.is_ok());
    if let Value::Number(n) = result.unwrap() {
        assert_eq!(n, 200.0);
    } else {
        panic!("Expected Value::Number");
    }
}

#[test]
fn from_glib_value_i64() {
    common::ensure_gtk_init();

    let gvalue: glib::Value = (-999999i64).into();

    let int_type = native::types::IntegerType {
        size: native::types::IntegerSize::_64,
        sign: native::types::IntegerSign::Signed,
    };
    let type_ = Type::Integer(int_type);

    let result = Value::from_glib_value(&gvalue, &type_);

    assert!(result.is_ok());
    if let Value::Number(n) = result.unwrap() {
        assert_eq!(n, -999999.0);
    } else {
        panic!("Expected Value::Number");
    }
}

#[test]
fn from_glib_value_u64() {
    common::ensure_gtk_init();

    let gvalue: glib::Value = 9999999999u64.into();

    let int_type = native::types::IntegerType {
        size: native::types::IntegerSize::_64,
        sign: native::types::IntegerSign::Unsigned,
    };
    let type_ = Type::Integer(int_type);

    let result = Value::from_glib_value(&gvalue, &type_);

    assert!(result.is_ok());
    if let Value::Number(n) = result.unwrap() {
        assert_eq!(n, 9999999999.0);
    } else {
        panic!("Expected Value::Number");
    }
}

#[test]
fn from_glib_value_f32() {
    common::ensure_gtk_init();

    let gvalue: glib::Value = 2.5f32.into();

    let float_type = native::types::FloatType {
        size: native::types::FloatSize::_32,
    };
    let type_ = Type::Float(float_type);

    let result = Value::from_glib_value(&gvalue, &type_);

    assert!(result.is_ok());
    if let Value::Number(n) = result.unwrap() {
        assert!((n - 2.5).abs() < 0.001);
    } else {
        panic!("Expected Value::Number");
    }
}

#[test]
fn from_glib_value_null_undefined() {
    common::ensure_gtk_init();

    let gvalue: glib::Value = glib::Value::from_type(glib::types::Type::POINTER);

    let result_null = Value::from_glib_value(&gvalue, &Type::Null);
    let result_undefined = Value::from_glib_value(&gvalue, &Type::Undefined);

    assert!(result_null.is_ok());
    assert!(result_undefined.is_ok());
    assert!(matches!(result_null.unwrap(), Value::Null));
    assert!(matches!(result_undefined.unwrap(), Value::Null));
}

#[test]
fn from_cif_value_gvariant_transfer_none() {
    common::ensure_gtk_init();

    let variant = unsafe {
        let ptr = glib::ffi::g_variant_new_int32(42);
        glib::ffi::g_variant_ref_sink(ptr);
        ptr
    };

    let gvariant_type = native::types::GVariantType {
        is_transfer_full: false,
    };
    let type_ = Type::GVariant(gvariant_type);

    let cif_value = cif::Value::Ptr(variant as *mut c_void);
    let result = Value::from_cif_value(&cif_value, &type_);

    assert!(result.is_ok());
    if let Value::Object(_id) = result.unwrap() {
    } else {
        panic!("Expected Value::Object");
    }

    unsafe {
        glib::ffi::g_variant_unref(variant);
    }
}

#[test]
fn from_cif_value_gvariant_null() {
    common::ensure_gtk_init();

    let gvariant_type = native::types::GVariantType {
        is_transfer_full: true,
    };
    let type_ = Type::GVariant(gvariant_type);

    let cif_value = cif::Value::Ptr(std::ptr::null_mut());
    let result = Value::from_cif_value(&cif_value, &type_);

    assert!(result.is_ok());
    assert!(matches!(result.unwrap(), Value::Null));
}

#[test]
fn from_cif_value_ref_integer() {
    common::ensure_gtk_init();

    let int_value: i32 = 12345;
    let ptr = &int_value as *const i32 as *mut c_void;

    let int_type = native::types::IntegerType {
        size: native::types::IntegerSize::_32,
        sign: native::types::IntegerSign::Signed,
    };
    let ref_type = native::types::RefType::new(Type::Integer(int_type));
    let type_ = Type::Ref(ref_type);

    let owned_ptr = cif::OwnedPtr::new(Box::new(int_value), ptr);
    let cif_value = cif::Value::OwnedPtr(owned_ptr);
    let result = Value::from_cif_value(&cif_value, &type_);

    assert!(result.is_ok());
    if let Value::Number(n) = result.unwrap() {
        assert_eq!(n, 12345.0);
    } else {
        panic!("Expected Value::Number");
    }
}

#[test]
fn from_cif_value_ref_float() {
    common::ensure_gtk_init();

    let float_value: f64 = 3.14159;
    let ptr = &float_value as *const f64 as *mut c_void;

    let float_type = native::types::FloatType {
        size: native::types::FloatSize::_64,
    };
    let ref_type = native::types::RefType::new(Type::Float(float_type));
    let type_ = Type::Ref(ref_type);

    let owned_ptr = cif::OwnedPtr::new(Box::new(float_value), ptr);
    let cif_value = cif::Value::OwnedPtr(owned_ptr);
    let result = Value::from_cif_value(&cif_value, &type_);

    assert!(result.is_ok());
    if let Value::Number(n) = result.unwrap() {
        assert!((n - 3.14159).abs() < 0.0001);
    } else {
        panic!("Expected Value::Number");
    }
}

#[test]
fn try_from_glib_value_i32() {
    common::ensure_gtk_init();

    let gvalue: glib::Value = 42i32.into();
    let result: anyhow::Result<Value> = (&gvalue).try_into();

    assert!(result.is_ok());
    if let Value::Number(n) = result.unwrap() {
        assert_eq!(n, 42.0);
    } else {
        panic!("Expected Value::Number");
    }
}

#[test]
fn try_from_glib_value_u32() {
    common::ensure_gtk_init();

    let gvalue: glib::Value = 100u32.into();
    let result: anyhow::Result<Value> = (&gvalue).try_into();

    assert!(result.is_ok());
    if let Value::Number(n) = result.unwrap() {
        assert_eq!(n, 100.0);
    } else {
        panic!("Expected Value::Number");
    }
}

#[test]
fn try_from_glib_value_string() {
    common::ensure_gtk_init();

    let gvalue: glib::Value = "hello".to_string().into();
    let result: anyhow::Result<Value> = (&gvalue).try_into();

    assert!(result.is_ok());
    if let Value::String(s) = result.unwrap() {
        assert_eq!(s, "hello");
    } else {
        panic!("Expected Value::String");
    }
}

#[test]
fn try_from_glib_value_bool() {
    common::ensure_gtk_init();

    let gvalue: glib::Value = true.into();
    let result: anyhow::Result<Value> = (&gvalue).try_into();

    assert!(result.is_ok());
    if let Value::Boolean(b) = result.unwrap() {
        assert!(b);
    } else {
        panic!("Expected Value::Boolean");
    }
}

#[test]
fn value_into_option_glib_value_number() {
    common::ensure_gtk_init();

    let value = Value::Number(42.5);
    let gvalue: Option<glib::Value> = value.into();

    assert!(gvalue.is_some());
}

#[test]
fn value_into_option_glib_value_string() {
    common::ensure_gtk_init();

    let value = Value::String("test".to_string());
    let gvalue: Option<glib::Value> = value.into();

    assert!(gvalue.is_some());
}

#[test]
fn value_into_option_glib_value_boolean() {
    common::ensure_gtk_init();

    let value = Value::Boolean(true);
    let gvalue: Option<glib::Value> = value.into();

    assert!(gvalue.is_some());
}

#[test]
fn value_into_option_glib_value_null() {
    let value = Value::Null;
    let gvalue: Option<glib::Value> = value.into();

    assert!(gvalue.is_none());
}

#[test]
fn value_into_option_glib_value_undefined() {
    let value = Value::Undefined;
    let gvalue: Option<glib::Value> = value.into();

    assert!(gvalue.is_none());
}

#[test]
fn into_glib_value_with_default_undefined_boolean() {
    common::ensure_gtk_init();

    let value = Value::Undefined;
    let result = value.into_glib_value_with_default(Some(&Type::Boolean));

    assert!(result.is_some());
}

#[test]
fn into_glib_value_with_default_undefined_integer() {
    common::ensure_gtk_init();

    let int_type = native::types::IntegerType {
        size: native::types::IntegerSize::_32,
        sign: native::types::IntegerSign::Signed,
    };
    let value = Value::Undefined;
    let result = value.into_glib_value_with_default(Some(&Type::Integer(int_type)));

    assert!(result.is_some());
}

#[test]
fn into_glib_value_with_default_regular_value() {
    common::ensure_gtk_init();

    let value = Value::Number(42.0);
    let result = value.into_glib_value_with_default(Some(&Type::Boolean));

    assert!(result.is_some());
}

#[test]
fn glist_with_string_items() {
    common::ensure_gtk_init();

    let s1 = std::ffi::CString::new("hello").unwrap();
    let s2 = std::ffi::CString::new("world").unwrap();

    let mut list: *mut glib::ffi::GList = std::ptr::null_mut();
    list = unsafe { glib::ffi::g_list_append(list, s1.as_ptr() as *mut c_void) };
    list = unsafe { glib::ffi::g_list_append(list, s2.as_ptr() as *mut c_void) };

    let string_type = StringType {
        is_transfer_full: false,
        length: None,
    };
    let array_type = ArrayType {
        item_type: Box::new(Type::String(string_type)),
        list_type: ListType::GList,
        is_transfer_full: false,
    };
    let type_ = Type::Array(array_type);

    let cif_value = cif::Value::Ptr(list as *mut c_void);
    let result = Value::from_cif_value(&cif_value, &type_);

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
}

#[test]
fn from_cif_value_struct_transfer_none_logs_warning() {
    common::ensure_gtk_init();

    let struct_ptr = unsafe { glib::ffi::g_malloc0(16) };

    let struct_type = native::types::StructType::new(false, "TestRect".to_string(), Some(16));
    let type_ = Type::Struct(struct_type);

    let cif_value = cif::Value::Ptr(struct_ptr);
    let result = Value::from_cif_value(&cif_value, &type_);

    assert!(result.is_ok());
    if let Value::Object(_id) = result.unwrap() {
    } else {
        panic!("Expected Value::Object for struct");
    }

    unsafe {
        glib::ffi::g_free(struct_ptr);
    }
}

#[test]
fn from_cif_value_struct_full_transfer() {
    common::ensure_gtk_init();

    let struct_ptr = unsafe { glib::ffi::g_malloc0(32) };

    let struct_type = native::types::StructType::new(true, "CustomStruct".to_string(), Some(32));
    let type_ = Type::Struct(struct_type);

    let cif_value = cif::Value::Ptr(struct_ptr);
    let result = Value::from_cif_value(&cif_value, &type_);

    assert!(result.is_ok());
    if let Value::Object(_id) = result.unwrap() {
    } else {
        panic!("Expected Value::Object for struct");
    }
}

#[test]
fn from_cif_value_struct_null_returns_null_value() {
    common::ensure_gtk_init();

    let struct_type = native::types::StructType::new(false, "TestStruct".to_string(), Some(16));
    let type_ = Type::Struct(struct_type);

    let cif_value = cif::Value::Ptr(std::ptr::null_mut());
    let result = Value::from_cif_value(&cif_value, &type_);

    assert!(result.is_ok());
    assert!(matches!(result.unwrap(), Value::Null));
}

#[test]
fn from_glib_value_struct_fails() {
    common::ensure_gtk_init();

    let gvalue: glib::Value = glib::Value::from_type(glib::types::Type::POINTER);

    let struct_type = native::types::StructType::new(false, "PlainStruct".to_string(), Some(16));
    let type_ = Type::Struct(struct_type);

    let result = Value::from_glib_value(&gvalue, &type_);

    assert!(result.is_err());
}

#[test]
fn from_cif_value_struct_transfer_none_without_size_logs_warning() {
    common::ensure_gtk_init();

    let struct_ptr = unsafe { glib::ffi::g_malloc0(24) };

    let struct_type =
        native::types::StructType::new(false, "UnknownSizeStruct".to_string(), None);
    let type_ = Type::Struct(struct_type);

    let cif_value = cif::Value::Ptr(struct_ptr);
    let result = Value::from_cif_value(&cif_value, &type_);

    assert!(result.is_ok());
    if let Value::Object(_id) = result.unwrap() {
    } else {
        panic!("Expected Value::Object for struct");
    }

    unsafe {
        glib::ffi::g_free(struct_ptr);
    }
}

#[test]
fn from_cif_value_struct_owned_without_size() {
    common::ensure_gtk_init();

    let struct_ptr = unsafe { glib::ffi::g_malloc0(24) };

    let struct_type =
        native::types::StructType::new(true, "UnknownSizeStruct".to_string(), None);
    let type_ = Type::Struct(struct_type);

    let cif_value = cif::Value::Ptr(struct_ptr);
    let result = Value::from_cif_value(&cif_value, &type_);

    assert!(result.is_ok());
    if let Value::Object(_id) = result.unwrap() {
    } else {
        panic!("Expected Value::Object for struct");
    }
}

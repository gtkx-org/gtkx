mod common;

use std::ffi::{CString, c_void};
use std::sync::{
    Arc,
    atomic::{AtomicBool, AtomicUsize, Ordering},
};

use gtk4::glib;

use native::arg::Arg;
use native::cif::{OwnedPtr, Value, closure_ptr_for_transfer, closure_to_glib_full};
use native::types::{
    ArrayType, FloatSize, FloatType, IntegerSign, IntegerSize, IntegerType, ListType, StringType,
    Type,
};
use native::value;

#[test]
fn owned_ptr_new_stores_value_and_ptr() {
    let data = vec![1u32, 2, 3, 4, 5];
    let ptr = data.as_ptr() as *mut c_void;
    let owned = OwnedPtr::new(data, ptr);

    assert_eq!(owned.ptr, ptr);
}

#[test]
fn owned_ptr_from_vec_captures_correct_pointer() {
    let data = vec![10u64, 20, 30];
    let owned = OwnedPtr::from_vec(data);

    unsafe {
        let slice = std::slice::from_raw_parts(owned.ptr as *const u64, 3);
        assert_eq!(slice, &[10, 20, 30]);
    }
}

#[test]
fn owned_ptr_keeps_cstring_alive() {
    let cstring = CString::new("test string").unwrap();
    let ptr = cstring.as_ptr() as *mut c_void;
    let owned = OwnedPtr::new(cstring, ptr);

    unsafe {
        let s = std::ffi::CStr::from_ptr(owned.ptr as *const i8);
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

    let owned = OwnedPtr::new((strings, ptrs), tuple_ptr);

    unsafe {
        let ptr_slice = std::slice::from_raw_parts(owned.ptr as *const *const i8, 2);
        let s0 = std::ffi::CStr::from_ptr(ptr_slice[0]);
        let s1 = std::ffi::CStr::from_ptr(ptr_slice[1]);
        assert_eq!(s0.to_str().unwrap(), "hello");
        assert_eq!(s1.to_str().unwrap(), "world");
    }
}

#[test]
fn owned_ptr_drops_value_when_dropped() {
    let drop_counter = Arc::new(AtomicUsize::new(0));

    struct DropTracker {
        counter: Arc<AtomicUsize>,
    }

    impl Drop for DropTracker {
        fn drop(&mut self) {
            self.counter.fetch_add(1, Ordering::SeqCst);
        }
    }

    {
        let tracker = DropTracker {
            counter: Arc::clone(&drop_counter),
        };
        let _owned = OwnedPtr::new(tracker, std::ptr::null_mut());
    }

    assert_eq!(drop_counter.load(Ordering::SeqCst), 1);
}

#[test]
fn closure_to_glib_full_increments_refcount() {
    common::ensure_gtk_init();

    let closure = glib::Closure::new(|_| None::<glib::Value>);

    let initial_ref = {
        use glib::translate::ToGlibPtr as _;
        let ptr: *mut glib::gobject_ffi::GClosure = closure.to_glib_none().0;
        unsafe { (*ptr).ref_count }
    };

    let ptr = closure_to_glib_full(&closure);

    let after_ref = unsafe { (*(ptr as *mut glib::gobject_ffi::GClosure)).ref_count };

    assert!(after_ref > initial_ref);

    unsafe {
        glib::gobject_ffi::g_closure_unref(ptr as *mut _);
    }
}

#[test]
fn closure_ptr_for_transfer_returns_valid_ptr() {
    common::ensure_gtk_init();

    let invoked = Arc::new(AtomicBool::new(false));
    let invoked_clone = invoked.clone();

    let closure = glib::Closure::new(move |_| {
        invoked_clone.store(true, Ordering::SeqCst);
        None::<glib::Value>
    });

    let ptr = closure_ptr_for_transfer(closure);

    assert!(!ptr.is_null());

    unsafe {
        glib::gobject_ffi::g_closure_invoke(
            ptr as *mut glib::gobject_ffi::GClosure,
            std::ptr::null_mut(),
            0,
            std::ptr::null(),
            std::ptr::null_mut(),
        );
    }

    assert!(invoked.load(Ordering::SeqCst));

    unsafe {
        glib::gobject_ffi::g_closure_unref(ptr as *mut _);
    }
}

#[test]
fn closure_captured_values_survive_transfer() {
    common::ensure_gtk_init();

    let data = Arc::new(AtomicUsize::new(0));
    let data_clone = data.clone();

    let closure = glib::Closure::new(move |_| {
        data_clone.fetch_add(1, Ordering::SeqCst);
        None::<glib::Value>
    });

    let ptr = closure_ptr_for_transfer(closure);

    for _ in 0..5 {
        unsafe {
            glib::gobject_ffi::g_closure_invoke(
                ptr as *mut glib::gobject_ffi::GClosure,
                std::ptr::null_mut(),
                0,
                std::ptr::null(),
                std::ptr::null_mut(),
            );
        }
    }

    assert_eq!(data.load(Ordering::SeqCst), 5);

    unsafe {
        glib::gobject_ffi::g_closure_unref(ptr as *mut _);
    }
}

#[test]
fn try_from_integer_i8() {
    let arg = Arg::new(
        Type::Integer(IntegerType {
            size: IntegerSize::_8,
            sign: IntegerSign::Signed,
        }),
        value::Value::Number(-42.0),
    );

    let result = Value::try_from(arg);
    assert!(result.is_ok());
    if let Value::I8(v) = result.unwrap() {
        assert_eq!(v, -42);
    } else {
        panic!("Expected Value::I8");
    }
}

#[test]
fn try_from_integer_u8() {
    let arg = Arg::new(
        Type::Integer(IntegerType {
            size: IntegerSize::_8,
            sign: IntegerSign::Unsigned,
        }),
        value::Value::Number(200.0),
    );

    let result = Value::try_from(arg);
    assert!(result.is_ok());
    if let Value::U8(v) = result.unwrap() {
        assert_eq!(v, 200);
    } else {
        panic!("Expected Value::U8");
    }
}

#[test]
fn try_from_integer_i32() {
    let arg = Arg::new(
        Type::Integer(IntegerType {
            size: IntegerSize::_32,
            sign: IntegerSign::Signed,
        }),
        value::Value::Number(-123456.0),
    );

    let result = Value::try_from(arg);
    assert!(result.is_ok());
    if let Value::I32(v) = result.unwrap() {
        assert_eq!(v, -123456);
    } else {
        panic!("Expected Value::I32");
    }
}

#[test]
fn try_from_integer_u64() {
    let arg = Arg::new(
        Type::Integer(IntegerType {
            size: IntegerSize::_64,
            sign: IntegerSign::Unsigned,
        }),
        value::Value::Number(9999999999.0),
    );

    let result = Value::try_from(arg);
    assert!(result.is_ok());
    if let Value::U64(v) = result.unwrap() {
        assert_eq!(v, 9999999999);
    } else {
        panic!("Expected Value::U64");
    }
}

#[test]
fn try_from_integer_optional_null() {
    let arg = Arg {
        type_: Type::Integer(IntegerType {
            size: IntegerSize::_32,
            sign: IntegerSign::Signed,
        }),
        value: value::Value::Null,
        optional: true,
    };

    let result = Value::try_from(arg);
    assert!(result.is_ok());
    if let Value::I32(v) = result.unwrap() {
        assert_eq!(v, 0);
    } else {
        panic!("Expected Value::I32");
    }
}

#[test]
fn try_from_float_f32() {
    let arg = Arg::new(
        Type::Float(FloatType {
            size: FloatSize::_32,
        }),
        value::Value::Number(3.14),
    );

    let result = Value::try_from(arg);
    assert!(result.is_ok());
    if let Value::F32(v) = result.unwrap() {
        assert!((v - 3.14).abs() < 0.001);
    } else {
        panic!("Expected Value::F32");
    }
}

#[test]
fn try_from_float_f64() {
    let arg = Arg::new(
        Type::Float(FloatType {
            size: FloatSize::_64,
        }),
        value::Value::Number(2.718281828),
    );

    let result = Value::try_from(arg);
    assert!(result.is_ok());
    if let Value::F64(v) = result.unwrap() {
        assert!((v - 2.718281828).abs() < 0.0000001);
    } else {
        panic!("Expected Value::F64");
    }
}

#[test]
fn try_from_string() {
    let arg = Arg::new(
        Type::String(StringType {
            is_transfer_full: true,
            length: None,
        }),
        value::Value::String("hello world".to_string()),
    );

    let result = Value::try_from(arg);
    assert!(result.is_ok());
    if let Value::OwnedPtr(owned) = result.unwrap() {
        unsafe {
            let s = std::ffi::CStr::from_ptr(owned.ptr as *const i8);
            assert_eq!(s.to_str().unwrap(), "hello world");
        }
    } else {
        panic!("Expected Value::OwnedPtr");
    }
}

#[test]
fn try_from_string_null() {
    let arg = Arg::new(
        Type::String(StringType {
            is_transfer_full: true,
            length: None,
        }),
        value::Value::Null,
    );

    let result = Value::try_from(arg);
    assert!(result.is_ok());
    if let Value::Ptr(ptr) = result.unwrap() {
        assert!(ptr.is_null());
    } else {
        panic!("Expected Value::Ptr");
    }
}

#[test]
fn try_from_boolean_true() {
    let arg = Arg::new(Type::Boolean, value::Value::Boolean(true));

    let result = Value::try_from(arg);
    assert!(result.is_ok());
    if let Value::U8(v) = result.unwrap() {
        assert_eq!(v, 1);
    } else {
        panic!("Expected Value::U8");
    }
}

#[test]
fn try_from_boolean_false() {
    let arg = Arg::new(Type::Boolean, value::Value::Boolean(false));

    let result = Value::try_from(arg);
    assert!(result.is_ok());
    if let Value::U8(v) = result.unwrap() {
        assert_eq!(v, 0);
    } else {
        panic!("Expected Value::U8");
    }
}

#[test]
fn try_from_null() {
    let arg = Arg::new(Type::Null, value::Value::Null);

    let result = Value::try_from(arg);
    assert!(result.is_ok());
    if let Value::Ptr(ptr) = result.unwrap() {
        assert!(ptr.is_null());
    } else {
        panic!("Expected Value::Ptr");
    }
}

#[test]
fn try_from_undefined() {
    let arg = Arg::new(Type::Undefined, value::Value::Undefined);

    let result = Value::try_from(arg);
    assert!(result.is_ok());
    if let Value::Ptr(ptr) = result.unwrap() {
        assert!(ptr.is_null());
    } else {
        panic!("Expected Value::Ptr");
    }
}

#[test]
fn try_from_array_u8() {
    let arg = Arg::new(
        Type::Array(ArrayType {
            item_type: Box::new(Type::Integer(IntegerType {
                size: IntegerSize::_8,
                sign: IntegerSign::Unsigned,
            })),
            list_type: ListType::Array,
            is_transfer_full: true,
        }),
        value::Value::Array(vec![
            value::Value::Number(1.0),
            value::Value::Number(2.0),
            value::Value::Number(3.0),
        ]),
    );

    let result = Value::try_from(arg);
    assert!(result.is_ok());
    if let Value::OwnedPtr(owned) = result.unwrap() {
        unsafe {
            let slice = std::slice::from_raw_parts(owned.ptr as *const u8, 3);
            assert_eq!(slice, &[1, 2, 3]);
        }
    } else {
        panic!("Expected Value::OwnedPtr");
    }
}

#[test]
fn try_from_array_i32() {
    let arg = Arg::new(
        Type::Array(ArrayType {
            item_type: Box::new(Type::Integer(IntegerType {
                size: IntegerSize::_32,
                sign: IntegerSign::Signed,
            })),
            list_type: ListType::Array,
            is_transfer_full: true,
        }),
        value::Value::Array(vec![
            value::Value::Number(-10.0),
            value::Value::Number(0.0),
            value::Value::Number(10.0),
        ]),
    );

    let result = Value::try_from(arg);
    assert!(result.is_ok());
    if let Value::OwnedPtr(owned) = result.unwrap() {
        unsafe {
            let slice = std::slice::from_raw_parts(owned.ptr as *const i32, 3);
            assert_eq!(slice, &[-10, 0, 10]);
        }
    } else {
        panic!("Expected Value::OwnedPtr");
    }
}

#[test]
fn try_from_array_f64() {
    let arg = Arg::new(
        Type::Array(ArrayType {
            item_type: Box::new(Type::Float(FloatType {
                size: FloatSize::_64,
            })),
            list_type: ListType::Array,
            is_transfer_full: true,
        }),
        value::Value::Array(vec![value::Value::Number(1.1), value::Value::Number(2.2)]),
    );

    let result = Value::try_from(arg);
    assert!(result.is_ok());
    if let Value::OwnedPtr(owned) = result.unwrap() {
        unsafe {
            let slice = std::slice::from_raw_parts(owned.ptr as *const f64, 2);
            assert!((slice[0] - 1.1).abs() < 0.001);
            assert!((slice[1] - 2.2).abs() < 0.001);
        }
    } else {
        panic!("Expected Value::OwnedPtr");
    }
}

#[test]
fn try_from_array_string() {
    let arg = Arg::new(
        Type::Array(ArrayType {
            item_type: Box::new(Type::String(StringType {
                is_transfer_full: true,
                length: None,
            })),
            list_type: ListType::Array,
            is_transfer_full: true,
        }),
        value::Value::Array(vec![
            value::Value::String("foo".to_string()),
            value::Value::String("bar".to_string()),
        ]),
    );

    let result = Value::try_from(arg);
    assert!(result.is_ok());
    if let Value::OwnedPtr(owned) = result.unwrap() {
        unsafe {
            let ptrs = std::slice::from_raw_parts(owned.ptr as *const *const i8, 3);
            let s0 = std::ffi::CStr::from_ptr(ptrs[0]);
            let s1 = std::ffi::CStr::from_ptr(ptrs[1]);
            assert_eq!(s0.to_str().unwrap(), "foo");
            assert_eq!(s1.to_str().unwrap(), "bar");
            assert!(ptrs[2].is_null());
        }
    } else {
        panic!("Expected Value::OwnedPtr");
    }
}

#[test]
fn try_from_array_boolean() {
    let arg = Arg::new(
        Type::Array(ArrayType {
            item_type: Box::new(Type::Boolean),
            list_type: ListType::Array,
            is_transfer_full: true,
        }),
        value::Value::Array(vec![
            value::Value::Boolean(true),
            value::Value::Boolean(false),
            value::Value::Boolean(true),
        ]),
    );

    let result = Value::try_from(arg);
    assert!(result.is_ok());
    if let Value::OwnedPtr(owned) = result.unwrap() {
        unsafe {
            let slice = std::slice::from_raw_parts(owned.ptr as *const u8, 3);
            assert_eq!(slice, &[1, 0, 1]);
        }
    } else {
        panic!("Expected Value::OwnedPtr");
    }
}

#[test]
fn value_as_ptr_integer_types() {
    let v_u8 = Value::U8(42);
    let v_i32 = Value::I32(-100);
    let v_u64 = Value::U64(999);

    assert!(!v_u8.as_ptr().is_null());
    assert!(!v_i32.as_ptr().is_null());
    assert!(!v_u64.as_ptr().is_null());
}

#[test]
fn value_as_ptr_float_types() {
    let v_f32 = Value::F32(3.14);
    let v_f64 = Value::F64(2.718);

    assert!(!v_f32.as_ptr().is_null());
    assert!(!v_f64.as_ptr().is_null());
}

#[test]
fn value_as_ptr_void() {
    let v = Value::Void;
    assert!(v.as_ptr().is_null());
}

#[test]
fn value_as_ptr_null_ptr() {
    let v = Value::Ptr(std::ptr::null_mut());
    assert!(!v.as_ptr().is_null());
}

#[test]
fn value_to_libffi_arg_integers() {
    let v = Value::I32(42);
    let _arg: libffi::middle::Arg = (&v).into();
}

#[test]
fn value_to_libffi_arg_floats() {
    let v = Value::F64(3.14);
    let _arg: libffi::middle::Arg = (&v).into();
}

#[test]
fn value_to_libffi_arg_ptr() {
    let v = Value::Ptr(std::ptr::null_mut());
    let _arg: libffi::middle::Arg = (&v).into();
}

#[test]
fn value_to_libffi_arg_owned_ptr() {
    let owned = OwnedPtr::from_vec(vec![1u8, 2, 3]);
    let v = Value::OwnedPtr(owned);
    let _arg: libffi::middle::Arg = (&v).into();
}

#[test]
fn try_from_struct_null() {
    let struct_type = native::types::StructType::new(false, "TestStruct".to_string(), Some(16));
    let arg = Arg::new(Type::Struct(struct_type), value::Value::Null);

    let result = Value::try_from(arg);
    assert!(result.is_ok());
    if let Value::Ptr(ptr) = result.unwrap() {
        assert!(ptr.is_null());
    } else {
        panic!("Expected Value::Ptr for null struct");
    }
}

#[test]
fn try_from_struct_undefined() {
    let struct_type = native::types::StructType::new(true, "TestRect".to_string(), None);
    let arg = Arg::new(Type::Struct(struct_type), value::Value::Undefined);

    let result = Value::try_from(arg);
    assert!(result.is_ok());
    if let Value::Ptr(ptr) = result.unwrap() {
        assert!(ptr.is_null());
    } else {
        panic!("Expected Value::Ptr for undefined struct");
    }
}

#[test]
fn try_from_struct_invalid_type() {
    let struct_type = native::types::StructType::new(false, "TestStruct".to_string(), Some(16));
    let arg = Arg::new(
        Type::Struct(struct_type),
        value::Value::String("invalid".to_string()),
    );

    let result = Value::try_from(arg);
    assert!(result.is_err());
}

#[test]
fn try_from_struct_invalid_number() {
    let struct_type = native::types::StructType::new(false, "TestStruct".to_string(), Some(16));
    let arg = Arg::new(Type::Struct(struct_type), value::Value::Number(42.0));

    let result = Value::try_from(arg);
    assert!(result.is_err());
}

#[test]
fn try_from_struct_invalid_boolean() {
    let struct_type = native::types::StructType::new(true, "TestRect".to_string(), Some(8));
    let arg = Arg::new(Type::Struct(struct_type), value::Value::Boolean(true));

    let result = Value::try_from(arg);
    assert!(result.is_err());
}

#[test]
fn try_from_struct_transfer_none_vs_full() {
    let transfer_none_type =
        native::types::StructType::new(true, "TestStruct".to_string(), Some(16));
    let transfer_full_type =
        native::types::StructType::new(false, "TestStruct".to_string(), Some(16));

    let transfer_none_arg = Arg::new(Type::Struct(transfer_none_type), value::Value::Null);

    let transfer_full_arg = Arg::new(Type::Struct(transfer_full_type), value::Value::Null);

    let transfer_none_result = Value::try_from(transfer_none_arg);
    let transfer_full_result = Value::try_from(transfer_full_arg);

    assert!(transfer_none_result.is_ok());
    assert!(transfer_full_result.is_ok());

    if let (Value::Ptr(ptr1), Value::Ptr(ptr2)) =
        (transfer_none_result.unwrap(), transfer_full_result.unwrap())
    {
        assert!(ptr1.is_null());
        assert!(ptr2.is_null());
    } else {
        panic!("Expected Value::Ptr for both");
    }
}

use std::ffi::{CString, c_void};

use native::ffi::arg::Arg;
use native::ffi::descriptor::{
    ArrayDescriptor, ArrayKind, BooleanDescriptor, Descriptor, FloatKind, IntegerKind, Ownership,
    StringDescriptor, VoidDescriptor,
};
use native::ffi::value;
use native::ffi::{Stash, StashKind, StashedValue};

macro_rules! expect_variant {
    ($arg:expr, $variant:ident) => {{
        match StashedValue::try_from($arg).expect("conversion should succeed") {
            StashedValue::$variant(v) => v,
            other => panic!(
                "Expected StashedValue::{}, got {:?}",
                stringify!($variant),
                other
            ),
        }
    }};
}

fn u8_array_arg(value: value::Value) -> Arg {
    Arg::new(
        Descriptor::Array(ArrayDescriptor {
            item_descriptor: Box::new(Descriptor::Integer(IntegerKind::U8)),
            kind: ArrayKind::Array,
            ownership: Ownership::Full,
            element_size: None,
        }),
        value,
    )
}

#[test]
fn owned_ptr_new_stores_value_and_ptr() {
    let data = vec![1u32, 2, 3, 4, 5];
    let ptr = data.as_ptr() as *mut c_void;
    let owned = Stash::new(ptr, StashKind::U32Vec(data));

    assert_eq!(owned.ptr(), ptr);
}

#[test]
fn owned_ptr_from_vec_captures_correct_pointer() {
    let data = vec![10u64, 20, 30];
    let owned: Stash = data.into();

    // SAFETY: `owned` was built from the three-element `u64` vec and keeps it alive, so its pointer
    // addresses exactly three contiguous, correctly-typed `u64`s spanned by this slice.
    unsafe {
        let slice = std::slice::from_raw_parts(owned.ptr() as *const u64, 3);
        assert_eq!(slice, &[10, 20, 30]);
    }
}

#[test]
fn owned_ptr_keeps_cstring_alive() {
    let cstring = CString::new("test string").unwrap();
    let ptr = cstring.as_ptr() as *mut c_void;
    let owned = Stash::new(ptr, StashKind::CString(cstring));

    // SAFETY: `owned` keeps the source `CString` alive, so its pointer addresses a valid
    // NUL-terminated C string that `CStr::from_ptr` can read.
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

    let owned = Stash::new(tuple_ptr, StashKind::StringArray(strings, ptrs));

    // SAFETY: `owned` keeps both the `ptrs` vec and the backing `CString`s alive, so its pointer
    // addresses two contiguous `*const i8` entries, each a valid NUL-terminated C string.
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
    let owned = Stash::new(ptr, StashKind::U8Vec(data));

    drop(owned);
}

#[test]
fn try_from_integer_i8() {
    let arg = Arg::new(
        Descriptor::Integer(IntegerKind::I8),
        value::Value::Number(-42.0),
    );

    let v = expect_variant!(arg, I8);
    assert_eq!(v, -42);
}

#[test]
fn try_from_integer_u8() {
    let arg = Arg::new(
        Descriptor::Integer(IntegerKind::U8),
        value::Value::Number(200.0),
    );

    let v = expect_variant!(arg, U8);
    assert_eq!(v, 200);
}

#[test]
fn try_from_integer_i32() {
    let arg = Arg::new(
        Descriptor::Integer(IntegerKind::I32),
        value::Value::Number(-123_456.0),
    );

    let v = expect_variant!(arg, I32);
    assert_eq!(v, -123_456);
}

#[test]
fn try_from_integer_u64() {
    let arg = Arg::new(
        Descriptor::Integer(IntegerKind::U64),
        value::Value::Number(9_999_999_999.0),
    );

    let v = expect_variant!(arg, U64);
    assert_eq!(v, 9_999_999_999);
}

#[test]
fn try_from_integer_optional_null() {
    let arg = Arg {
        ty: Descriptor::Integer(IntegerKind::I32),
        value: value::Value::Null,
    };

    let v = expect_variant!(arg, I32);
    assert_eq!(v, 0);
}

#[test]
fn try_from_float_f32() {
    let arg = Arg::new(
        Descriptor::Float(FloatKind::F32),
        value::Value::Number(3.125),
    );

    let v = expect_variant!(arg, F32);
    assert!((v - 3.125).abs() < 0.001);
}

#[test]
fn try_from_float_f64() {
    let arg = Arg::new(
        Descriptor::Float(FloatKind::F64),
        value::Value::Number(2.625),
    );

    let v = expect_variant!(arg, F64);
    assert!((v - 2.625).abs() < 0.000_000_1);
}

#[test]
fn try_from_string_full() {
    let arg = Arg::new(
        Descriptor::String(StringDescriptor {
            ownership: Ownership::Full,
            length: None,
        }),
        value::Value::String("hello world".to_string()),
    );

    let encoded = StashedValue::try_from(arg).expect("full string should encode");
    encoded.disarm_pending_transfer();
    let StashedValue::Storage(storage) = &encoded else {
        panic!("Expected StashedValue::Storage, got {encoded:?}");
    };
    let ptr = storage.ptr();
    // SAFETY: the full-ownership string encode produced a freshly `g_malloc`-ed NUL-terminated
    // copy at `ptr` whose pending transfer was disarmed, so this code now owns it: `CStr::from_ptr`
    // reads the valid string and `g_free` releases it exactly once.
    unsafe {
        let s = std::ffi::CStr::from_ptr(ptr as *const i8);
        assert_eq!(s.to_str().unwrap(), "hello world");
        gtk4::glib::ffi::g_free(ptr);
    }
}

#[test]
fn try_from_string_borrowed() {
    let arg = Arg::new(
        Descriptor::String(StringDescriptor {
            ownership: Ownership::Borrowed,
            length: None,
        }),
        value::Value::String("hello world".to_string()),
    );

    let owned = expect_variant!(arg, Storage);
    // SAFETY: the borrowed string encode kept the source `CString` alive inside `owned`, so its
    // pointer addresses a valid NUL-terminated C string for `CStr::from_ptr`.
    unsafe {
        let s = std::ffi::CStr::from_ptr(owned.ptr() as *const i8);
        assert_eq!(s.to_str().unwrap(), "hello world");
    }
}

#[test]
fn try_from_string_null() {
    let arg = Arg::new(
        Descriptor::String(StringDescriptor {
            ownership: Ownership::Full,
            length: None,
        }),
        value::Value::Null,
    );

    let ptr = expect_variant!(arg, Ptr);
    assert!(ptr.is_null());
}

#[test]
fn try_from_boolean_true() {
    let arg = Arg::new(
        Descriptor::Boolean(BooleanDescriptor),
        value::Value::Boolean(true),
    );

    let v = expect_variant!(arg, I32);
    assert_eq!(v, 1);
}

#[test]
fn try_from_boolean_false() {
    let arg = Arg::new(
        Descriptor::Boolean(BooleanDescriptor),
        value::Value::Boolean(false),
    );

    let v = expect_variant!(arg, I32);
    assert_eq!(v, 0);
}

#[test]
fn try_from_null() {
    let arg = Arg::new(Descriptor::Void(VoidDescriptor), value::Value::Null);

    let ptr = expect_variant!(arg, Ptr);
    assert!(ptr.is_null());
}

#[test]
fn try_from_undefined() {
    let arg = Arg::new(Descriptor::Void(VoidDescriptor), value::Value::Undefined);

    let ptr = expect_variant!(arg, Ptr);
    assert!(ptr.is_null());
}

#[test]
fn try_from_array_u8() {
    let arg = u8_array_arg(value::Value::Array(vec![
        value::Value::Number(1.0),
        value::Value::Number(2.0),
        value::Value::Number(3.0),
    ]));

    let owned = expect_variant!(arg, Storage);
    // SAFETY: the array encode stored three `u8`s in `owned` and keeps them alive, so its pointer
    // addresses exactly three contiguous, correctly-typed bytes spanned by this slice.
    unsafe {
        let slice = std::slice::from_raw_parts(owned.ptr() as *const u8, 3);
        assert_eq!(slice, &[1, 2, 3]);
    }
}

#[test]
fn try_from_array_i32() {
    let arg = Arg::new(
        Descriptor::Array(ArrayDescriptor {
            item_descriptor: Box::new(Descriptor::Integer(IntegerKind::I32)),
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

    let owned = expect_variant!(arg, Storage);
    // SAFETY: the array encode stored three `i32`s in `owned` and keeps them alive, so its pointer
    // addresses exactly three contiguous, correctly-typed values spanned by this slice.
    unsafe {
        let slice = std::slice::from_raw_parts(owned.ptr() as *const i32, 3);
        assert_eq!(slice, &[-10, 0, 10]);
    }
}

#[test]
fn try_from_array_f64() {
    let arg = Arg::new(
        Descriptor::Array(ArrayDescriptor {
            item_descriptor: Box::new(Descriptor::Float(FloatKind::F64)),
            kind: ArrayKind::Array,
            ownership: Ownership::Full,
            element_size: None,
        }),
        value::Value::Array(vec![value::Value::Number(1.1), value::Value::Number(2.2)]),
    );

    let owned = expect_variant!(arg, Storage);
    // SAFETY: the array encode stored two `f64`s in `owned` and keeps them alive, so its pointer
    // addresses exactly two contiguous, correctly-typed values spanned by this slice.
    unsafe {
        let slice = std::slice::from_raw_parts(owned.ptr() as *const f64, 2);
        assert!((slice[0] - 1.1).abs() < 0.001);
        assert!((slice[1] - 2.2).abs() < 0.001);
    }
}

#[test]
fn try_from_array_string() {
    let arg = Arg::new(
        Descriptor::Array(ArrayDescriptor {
            item_descriptor: Box::new(Descriptor::String(StringDescriptor {
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

    let owned = expect_variant!(arg, Storage);
    // SAFETY: the string-array encode stored a NULL-terminated array of two `char*` in `owned` and
    // keeps the backing strings alive, so the pointer addresses three entries (two valid C strings
    // followed by the NULL terminator) spanned by this slice.
    unsafe {
        let ptrs = std::slice::from_raw_parts(owned.ptr() as *const *const i8, 3);
        let s0 = std::ffi::CStr::from_ptr(ptrs[0]);
        let s1 = std::ffi::CStr::from_ptr(ptrs[1]);
        assert_eq!(s0.to_str().unwrap(), "foo");
        assert_eq!(s1.to_str().unwrap(), "bar");
        assert!(ptrs[2].is_null());
    }
}

#[test]
fn try_from_array_boolean() {
    let arg = Arg::new(
        Descriptor::Array(ArrayDescriptor {
            item_descriptor: Box::new(Descriptor::Boolean(BooleanDescriptor)),
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

    let owned = expect_variant!(arg, Storage);
    // SAFETY: the boolean-array encode stored three `i32`s (1/0/1) in `owned` and keeps them alive,
    // so its pointer addresses exactly three contiguous, correctly-typed values spanned by this slice.
    unsafe {
        let slice = std::slice::from_raw_parts(owned.ptr() as *const i32, 3);
        assert_eq!(slice, &[1, 0, 1]);
    }
}

#[test]
fn value_as_ptr_integer_types_fail() {
    assert!(StashedValue::U8(42).as_ptr("test").is_err());
    assert!(StashedValue::I32(-100).as_ptr("test").is_err());
    assert!(StashedValue::U64(999).as_ptr("test").is_err());
}

#[test]
fn value_as_ptr_float_types_fail() {
    let v_f32 = StashedValue::F32(3.125);
    let v_f64 = StashedValue::F64(2.625);

    assert!(v_f32.as_ptr("test").is_err());
    assert!(v_f64.as_ptr("test").is_err());
}

#[test]
fn value_as_ptr_void() {
    let v = StashedValue::Void;
    assert!(v.as_ptr("test").is_err());
}

#[test]
fn value_as_ptr_null_ptr() {
    let v = StashedValue::Ptr(std::ptr::null_mut());
    assert!(v.as_ptr("test").unwrap().is_null());
}

#[test]
fn value_to_libffi_arg_integers() {
    let v = StashedValue::I32(42);
    let _arg: libffi::middle::Arg = (&v).into();
}

#[test]
fn value_to_libffi_arg_floats() {
    let v = StashedValue::F64(3.125);
    let _arg: libffi::middle::Arg = (&v).into();
}

#[test]
fn value_to_libffi_arg_ptr() {
    let v = StashedValue::Ptr(std::ptr::null_mut());
    let _arg: libffi::middle::Arg = (&v).into();
}

#[test]
fn value_to_libffi_arg_owned_ptr() {
    let storage: Stash = vec![1u8, 2, 3].into();
    let v = StashedValue::Storage(storage);
    let _arg: libffi::middle::Arg = (&v).into();
}

#[test]
fn try_from_struct_null() {
    let struct_type = native::ffi::descriptor::StructDescriptor {
        ownership: Ownership::Borrowed,
        size: Some(16),
        caller_allocated: false,
    };
    let arg = Arg::new(Descriptor::Struct(struct_type), value::Value::Null);

    let ptr = expect_variant!(arg, Ptr);
    assert!(ptr.is_null());
}

#[test]
fn try_from_struct_undefined() {
    let struct_type = native::ffi::descriptor::StructDescriptor {
        ownership: Ownership::Full,
        size: None,
        caller_allocated: false,
    };
    let arg = Arg::new(Descriptor::Struct(struct_type), value::Value::Undefined);

    let ptr = expect_variant!(arg, Ptr);
    assert!(ptr.is_null());
}

#[test]
fn try_from_array_optional_null_yields_null_ptr() {
    let arg = Arg {
        ty: Descriptor::Array(ArrayDescriptor {
            item_descriptor: Box::new(Descriptor::Integer(IntegerKind::U8)),
            kind: ArrayKind::Array,
            ownership: Ownership::Full,
            element_size: None,
        }),
        value: value::Value::Null,
    };

    match StashedValue::try_from(arg).unwrap() {
        StashedValue::Ptr(ptr) => assert!(ptr.is_null()),
        other => panic!("Expected null StashedValue::Ptr, got {other:?}"),
    }
}

#[test]
fn try_from_array_propagates_encode_error() {
    let arg = u8_array_arg(value::Value::Number(1.0));

    assert!(StashedValue::try_from(arg).is_err());
}

#[test]
fn try_from_array_f32_storage_converts_to_libffi_arg() {
    let arg = Arg::new(
        Descriptor::Array(ArrayDescriptor {
            item_descriptor: Box::new(Descriptor::Float(FloatKind::F32)),
            kind: ArrayKind::Array,
            ownership: Ownership::Full,
            element_size: None,
        }),
        value::Value::Array(vec![value::Value::Number(0.5)]),
    );

    let stashed_value = StashedValue::try_from(arg).unwrap();
    let _arg: libffi::middle::Arg = (&stashed_value).into();
}

#[test]
fn try_from_struct_transfer_none_vs_full() {
    let transfer_none_type = native::ffi::descriptor::StructDescriptor {
        ownership: Ownership::Full,
        size: Some(16),
        caller_allocated: false,
    };
    let transfer_full_type = native::ffi::descriptor::StructDescriptor {
        ownership: Ownership::Borrowed,
        size: Some(16),
        caller_allocated: false,
    };

    let transfer_none_arg = Arg::new(Descriptor::Struct(transfer_none_type), value::Value::Null);

    let transfer_full_arg = Arg::new(Descriptor::Struct(transfer_full_type), value::Value::Null);

    let transfer_none_result = StashedValue::try_from(transfer_none_arg);
    let transfer_full_result = StashedValue::try_from(transfer_full_arg);

    assert!(transfer_none_result.is_ok());
    assert!(transfer_full_result.is_ok());

    if let (StashedValue::Ptr(ptr1), StashedValue::Ptr(ptr2)) =
        (transfer_none_result.unwrap(), transfer_full_result.unwrap())
    {
        assert!(ptr1.is_null());
        assert!(ptr2.is_null());
    } else {
        panic!("Expected StashedValue::Ptr for both");
    }
}

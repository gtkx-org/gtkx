use std::ffi::{CString, c_void};

use native::ffi::codec::{
    ArrayCodec, ArrayKind, BooleanCodec, Codec, Encoder as _, FloatCodec, IntegerCodec, Ownership,
    StringCodec, VoidCodec,
};
use native::ffi::value;
use native::ffi::{Stash, StashStorage, StashedValue};

macro_rules! expect_variant {
    ($codec:expr, $value:expr, $variant:ident) => {{
        match $codec.encode(&$value).expect("conversion should succeed") {
            StashedValue::$variant(v) => v,
            other => panic!(
                "Expected StashedValue::{}, got {:?}",
                stringify!($variant),
                other
            ),
        }
    }};
}

fn u8_array_codec() -> Codec {
    Codec::Array(ArrayCodec {
        item_codec: Box::new(Codec::Integer(IntegerCodec::U8)),
        kind: ArrayKind::Array,
        ownership: Ownership::Full,
        size_param_index: None,
        fixed_size: None,
        element_size: None,
    })
}

#[test]
fn stash_new_stores_value_and_ptr() {
    let data = vec![1u32, 2, 3, 4, 5];
    let ptr = data.as_ptr() as *mut c_void;
    let owned = Stash::new(ptr, StashStorage::U32Vec(data));

    assert_eq!(owned.ptr(), ptr);
}

#[test]
fn stash_from_vec_captures_correct_pointer() {
    let data = vec![10u64, 20, 30];
    let owned: Stash = data.into();

    unsafe {
        let slice = std::slice::from_raw_parts(owned.ptr() as *const u64, 3);
        assert_eq!(slice, &[10, 20, 30]);
    }
}

#[test]
fn stash_keeps_cstring_alive() {
    let cstring = CString::new("test string").unwrap();
    let ptr = cstring.as_ptr() as *mut c_void;
    let owned = Stash::new(ptr, StashStorage::CString(cstring));

    unsafe {
        let s = std::ffi::CStr::from_ptr(owned.ptr() as *const i8);
        assert_eq!(s.to_str().unwrap(), "test string");
    }
}

#[test]
fn stash_tuple_keeps_both_alive() {
    let strings = vec![
        CString::new("hello").unwrap(),
        CString::new("world").unwrap(),
    ];
    let ptrs: Vec<*mut c_void> = strings.iter().map(|s| s.as_ptr() as *mut c_void).collect();
    let tuple_ptr = ptrs.as_ptr() as *mut c_void;

    let owned = Stash::new(tuple_ptr, StashStorage::StringArray(strings, ptrs));

    unsafe {
        let ptr_slice = std::slice::from_raw_parts(owned.ptr() as *const *const i8, 2);
        let s0 = std::ffi::CStr::from_ptr(ptr_slice[0]);
        let s1 = std::ffi::CStr::from_ptr(ptr_slice[1]);
        assert_eq!(s0.to_str().unwrap(), "hello");
        assert_eq!(s1.to_str().unwrap(), "world");
    }
}

#[test]
fn stash_drops_value_when_dropped() {
    let data = vec![1u8, 2, 3, 4, 5];
    let ptr = data.as_ptr() as *mut c_void;
    let owned = Stash::new(ptr, StashStorage::U8Vec(data));

    drop(owned);
}

#[test]
fn encode_integer_i8() {
    let v = expect_variant!(
        Codec::Integer(IntegerCodec::I8),
        value::Value::Number(-42.0),
        I8
    );
    assert_eq!(v, -42);
}

#[test]
fn encode_integer_u8() {
    let v = expect_variant!(
        Codec::Integer(IntegerCodec::U8),
        value::Value::Number(200.0),
        U8
    );
    assert_eq!(v, 200);
}

#[test]
fn encode_integer_i32() {
    let v = expect_variant!(
        Codec::Integer(IntegerCodec::I32),
        value::Value::Number(-123_456.0),
        I32
    );
    assert_eq!(v, -123_456);
}

#[test]
fn encode_integer_u64() {
    let v = expect_variant!(
        Codec::Integer(IntegerCodec::U64),
        value::Value::Number(9_999_999_999.0),
        U64
    );
    assert_eq!(v, 9_999_999_999);
}

#[test]
fn encode_integer_optional_null() {
    let v = expect_variant!(Codec::Integer(IntegerCodec::I32), value::Value::Null, I32);
    assert_eq!(v, 0);
}

#[test]
fn encode_float_f32() {
    let v = expect_variant!(
        Codec::Float(FloatCodec::F32),
        value::Value::Number(3.125),
        F32
    );
    assert!((v - 3.125).abs() < 0.001);
}

#[test]
fn encode_float_f64() {
    let v = expect_variant!(
        Codec::Float(FloatCodec::F64),
        value::Value::Number(2.625),
        F64
    );
    assert!((v - 2.625).abs() < 0.000_000_1);
}

#[test]
fn encode_string_full() {
    let codec = Codec::String(StringCodec {
        ownership: Ownership::Full,
        length: None,
    });
    let encoded = codec
        .encode(&value::Value::String("hello world".to_string()))
        .expect("full string should encode");
    encoded.disarm_pending_transfer();
    let StashedValue::Stashed(storage) = &encoded else {
        panic!("Expected StashedValue::Stashed, got {encoded:?}");
    };
    let ptr = storage.ptr();
    unsafe {
        let s = std::ffi::CStr::from_ptr(ptr as *const i8);
        assert_eq!(s.to_str().unwrap(), "hello world");
        gtk4::glib::ffi::g_free(ptr);
    }
}

#[test]
fn encode_string_borrowed() {
    let owned = expect_variant!(
        Codec::String(StringCodec {
            ownership: Ownership::Borrowed,
            length: None,
        }),
        value::Value::String("hello world".to_string()),
        Stashed
    );
    unsafe {
        let s = std::ffi::CStr::from_ptr(owned.ptr() as *const i8);
        assert_eq!(s.to_str().unwrap(), "hello world");
    }
}

#[test]
fn encode_string_null() {
    let ptr = expect_variant!(
        Codec::String(StringCodec {
            ownership: Ownership::Full,
            length: None,
        }),
        value::Value::Null,
        Ptr
    );
    assert!(ptr.is_null());
}

#[test]
fn encode_boolean_true() {
    let v = expect_variant!(
        Codec::Boolean(BooleanCodec),
        value::Value::Boolean(true),
        I32
    );
    assert_eq!(v, 1);
}

#[test]
fn encode_boolean_false() {
    let v = expect_variant!(
        Codec::Boolean(BooleanCodec),
        value::Value::Boolean(false),
        I32
    );
    assert_eq!(v, 0);
}

#[test]
fn encode_null() {
    let ptr = expect_variant!(Codec::Void(VoidCodec), value::Value::Null, Ptr);
    assert!(ptr.is_null());
}

#[test]
fn encode_undefined() {
    let ptr = expect_variant!(Codec::Void(VoidCodec), value::Value::Undefined, Ptr);
    assert!(ptr.is_null());
}

#[test]
fn encode_array_u8() {
    let owned = expect_variant!(
        u8_array_codec(),
        value::Value::Array(vec![
            value::Value::Number(1.0),
            value::Value::Number(2.0),
            value::Value::Number(3.0),
        ]),
        Stashed
    );
    unsafe {
        let slice = std::slice::from_raw_parts(owned.ptr() as *const u8, 3);
        assert_eq!(slice, &[1, 2, 3]);
    }
}

#[test]
fn encode_array_i32() {
    let owned = expect_variant!(
        Codec::Array(ArrayCodec {
            item_codec: Box::new(Codec::Integer(IntegerCodec::I32)),
            kind: ArrayKind::Array,
            ownership: Ownership::Full,
            size_param_index: None,
            fixed_size: None,
            element_size: None,
        }),
        value::Value::Array(vec![
            value::Value::Number(-10.0),
            value::Value::Number(0.0),
            value::Value::Number(10.0),
        ]),
        Stashed
    );
    unsafe {
        let slice = std::slice::from_raw_parts(owned.ptr() as *const i32, 3);
        assert_eq!(slice, &[-10, 0, 10]);
    }
}

#[test]
fn encode_array_f64() {
    let owned = expect_variant!(
        Codec::Array(ArrayCodec {
            item_codec: Box::new(Codec::Float(FloatCodec::F64)),
            kind: ArrayKind::Array,
            ownership: Ownership::Full,
            size_param_index: None,
            fixed_size: None,
            element_size: None,
        }),
        value::Value::Array(vec![value::Value::Number(1.1), value::Value::Number(2.2)]),
        Stashed
    );
    unsafe {
        let slice = std::slice::from_raw_parts(owned.ptr() as *const f64, 2);
        assert!((slice[0] - 1.1).abs() < 0.001);
        assert!((slice[1] - 2.2).abs() < 0.001);
    }
}

#[test]
fn encode_array_string() {
    let owned = expect_variant!(
        Codec::Array(ArrayCodec {
            item_codec: Box::new(Codec::String(StringCodec {
                ownership: Ownership::Full,
                length: None,
            })),
            kind: ArrayKind::Array,
            ownership: Ownership::Full,
            size_param_index: None,
            fixed_size: None,
            element_size: None,
        }),
        value::Value::Array(vec![
            value::Value::String("foo".to_string()),
            value::Value::String("bar".to_string()),
        ]),
        Stashed
    );
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
fn encode_array_boolean() {
    let owned = expect_variant!(
        Codec::Array(ArrayCodec {
            item_codec: Box::new(Codec::Boolean(BooleanCodec)),
            kind: ArrayKind::Array,
            ownership: Ownership::Full,
            size_param_index: None,
            fixed_size: None,
            element_size: None,
        }),
        value::Value::Array(vec![
            value::Value::Boolean(true),
            value::Value::Boolean(false),
            value::Value::Boolean(true),
        ]),
        Stashed
    );
    unsafe {
        let slice = std::slice::from_raw_parts(owned.ptr() as *const i32, 3);
        assert_eq!(slice, &[1, 0, 1]);
    }
}

#[test]
fn encode_struct_undefined() {
    let codec = Codec::Struct(native::ffi::codec::StructCodec {
        ownership: Ownership::Full,
        size: None,
        caller_allocated: false,
    });
    let ptr = expect_variant!(codec, value::Value::Undefined, Ptr);
    assert!(ptr.is_null());
}

#[test]
fn encode_array_optional_null_yields_null_ptr() {
    match u8_array_codec().encode(&value::Value::Null).unwrap() {
        StashedValue::Ptr(ptr) => assert!(ptr.is_null()),
        other => panic!("Expected null StashedValue::Ptr, got {other:?}"),
    }
}

#[test]
fn encode_array_propagates_encode_error() {
    assert!(u8_array_codec().encode(&value::Value::Number(1.0)).is_err());
}

#[test]
fn encode_array_f32_storage_converts_to_libffi_arg() {
    let codec = Codec::Array(ArrayCodec {
        item_codec: Box::new(Codec::Float(FloatCodec::F32)),
        kind: ArrayKind::Array,
        ownership: Ownership::Full,
        size_param_index: None,
        fixed_size: None,
        element_size: None,
    });
    let stashed_value = codec
        .encode(&value::Value::Array(vec![value::Value::Number(0.5)]))
        .unwrap();
    let _arg: libffi::middle::Arg = (&stashed_value).into();
}

#[test]
fn encode_struct_transfer_none_vs_full() {
    let transfer_none_codec = Codec::Struct(native::ffi::codec::StructCodec {
        ownership: Ownership::Full,
        size: Some(16),
        caller_allocated: false,
    });
    let transfer_full_codec = Codec::Struct(native::ffi::codec::StructCodec {
        ownership: Ownership::Borrowed,
        size: Some(16),
        caller_allocated: false,
    });

    let transfer_none_result = transfer_none_codec.encode(&value::Value::Null);
    let transfer_full_result = transfer_full_codec.encode(&value::Value::Null);

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

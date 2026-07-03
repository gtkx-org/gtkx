use test_support as helpers;

use std::ffi::{CString, c_char, c_void};

use gtk4::glib;

use native::Handle;
use native::ffi::codec::{
    ArrayCodec, ArrayKind, BigIntCodec, BooleanCodec, Codec, Decoder, Encoder, EnumFlagsCodec,
    EnumFlagsKind, FloatCodec, FundamentalCodec, IntegerCodec, ObjectCodec, Ownership, PtrWriter,
    ReadSource, RefCodec, StringCodec, StructCodec,
};
use native::ffi::value::Value;
use native::ffi::{GArrayData, ListData, ListPayload, Slot, Stash, StashData};

fn struct_item_codec() -> Codec {
    Codec::Struct(StructCodec {
        ownership: Ownership::Borrowed,
        size: Some(size_of::<gtk4::gdk::ffi::GdkRGBA>()),
        caller_allocated: false,
    })
}

fn string_item_codec(ownership: Ownership) -> Codec {
    Codec::String(StringCodec {
        ownership,
        length: None,
    })
}

fn enum_flags_item_codec() -> Codec {
    Codec::EnumFlags(EnumFlagsCodec {
        kind: EnumFlagsKind::Enum,
        shared_library: "Gtk".to_string(),
        get_type_fn_name: "gtk_orientation_get_type".to_string(),
        storage: IntegerCodec::I32,
    })
}

fn array_codec(item: Codec, kind: ArrayKind, ownership: Ownership) -> ArrayCodec {
    ArrayCodec::new(Box::new(item), kind, ownership, None, None, None).expect("valid array codec")
}

fn sized_array_type(item: Codec, size_index: u32, ownership: Ownership) -> ArrayCodec {
    ArrayCodec::new(
        Box::new(item),
        ArrayKind::Sized,
        ownership,
        Some(size_index),
        None,
        None,
    )
    .expect("valid sized array codec")
}

fn fixed_array_type(item: Codec, size: u32, ownership: Ownership) -> ArrayCodec {
    ArrayCodec::new(
        Box::new(item),
        ArrayKind::Fixed,
        ownership,
        None,
        Some(size),
        None,
    )
    .expect("valid fixed array codec")
}

use helpers::boxed_handle;

fn gobject_item_codec(ownership: Ownership) -> Codec {
    Codec::Object(ObjectCodec { ownership })
}

fn unresolvable_fundamental_item_codec() -> Codec {
    Codec::Fundamental(FundamentalCodec {
        ownership: Ownership::Full,
        shared_library: "libgobject-2.0.so.0".to_owned(),
        ref_fn_name: "no_such_array_ref_symbol_12345".to_owned(),
        unref_fn_name: "g_param_spec_unref".to_owned(),
    })
}

fn gobject_refcount(ptr: *mut std::ffi::c_void) -> u32 {
    unsafe { (*(ptr as *mut gtk4::glib::gobject_ffi::GObject)).ref_count }
}

fn new_gobject() -> (glib::Object, *mut c_void) {
    let obj = glib::Object::new::<glib::Object>();
    let ptr = glib::translate::ToGlibPtr::<*mut glib::gobject_ffi::GObject>::to_glib_none(&obj).0
        as *mut c_void;
    (obj, ptr)
}

fn assert_full_element_container_releases_on_drop(kind: ArrayKind, container: Ownership) {
    helpers::run(|| {
        let (_obj, obj_ptr) = new_gobject();
        let before = gobject_refcount(obj_ptr);

        let descriptor = array_codec(gobject_item_codec(Ownership::Full), kind, container);
        let val = Value::Array(vec![Value::Object(Handle::from_glib_borrow(obj_ptr))]);
        let encoded = descriptor.encode(&val).unwrap();
        assert_eq!(gobject_refcount(obj_ptr), before + 1);

        drop(encoded);
        assert_eq!(gobject_refcount(obj_ptr), before);
    });
}

fn assert_string_list_full_container_borrowed_elements_releases_spine(kind: ArrayKind) {
    helpers::run(|| {
        let descriptor = array_codec(
            string_item_codec(Ownership::Borrowed),
            kind,
            Ownership::Full,
        );
        let val = Value::Array(vec![Value::String("kept".to_string())]);
        let encoded = descriptor.encode(&val).unwrap();
        let Stash::Storage(storage) = &encoded else {
            panic!("expected storage")
        };
        let (items_duped, retained) = match storage.data() {
            StashData::List(ListData {
                payload:
                    ListPayload::Strings {
                        strings,
                        items_duped,
                    },
                ..
            }) => (*items_duped, strings.len()),
            other => panic!("expected string list storage, got {other:?}"),
        };
        assert!(!items_duped);
        assert_eq!(retained, 1);
        drop(encoded);
    });
}

#[test]
fn encode_glist_handles_full_ownership_releases_when_call_never_happens() {
    assert_full_element_container_releases_on_drop(ArrayKind::GList, Ownership::Full);
}

#[test]
fn encode_glist_handles_full_ownership_transfers_to_callee_when_disarmed() {
    helpers::run(|| {
        let (_obj, obj_ptr) = new_gobject();
        let before = gobject_refcount(obj_ptr);

        let descriptor = array_codec(
            gobject_item_codec(Ownership::Full),
            ArrayKind::GList,
            Ownership::Full,
        );
        let val = Value::Array(vec![Value::Object(Handle::from_glib_borrow(obj_ptr))]);
        let encoded = descriptor.encode(&val).unwrap();
        encoded.disarm_pending_transfer();

        let Stash::Storage(storage) = &encoded else {
            panic!("expected storage")
        };
        let list = storage.ptr() as *mut gtk4::glib::ffi::GList;
        unsafe {
            gtk4::glib::ffi::g_list_free(list);
            gtk4::glib::gobject_ffi::g_object_unref(obj_ptr.cast());
        }
        drop(encoded);
        assert_eq!(gobject_refcount(obj_ptr), before);
    });
}

#[test]
fn encode_glist_handles_releases_acquired_elements_when_later_element_is_null() {
    helpers::run(|| {
        let (_obj, obj_ptr) = new_gobject();
        let before = gobject_refcount(obj_ptr);

        let descriptor = array_codec(
            gobject_item_codec(Ownership::Full),
            ArrayKind::GList,
            Ownership::Full,
        );
        let val = Value::Array(vec![
            Value::Object(Handle::from_glib_borrow(obj_ptr)),
            Value::Object(Handle::from_glib_borrow(std::ptr::null_mut())),
        ]);
        assert!(descriptor.encode(&val).is_err());
        assert_eq!(gobject_refcount(obj_ptr), before);
    });
}

#[test]
fn encode_gslist_strings_full_container_releases_when_call_never_happens() {
    helpers::run(|| {
        let descriptor = array_codec(
            string_item_codec(Ownership::Full),
            ArrayKind::GSList,
            Ownership::Full,
        );
        let val = Value::Array(vec![Value::String("foo".to_string())]);
        let encoded = descriptor.encode(&val).unwrap();
        drop(encoded);
    });
}

#[test]
fn encode_garray_full_ownership_adopted_strings_release_when_call_never_happens() {
    helpers::run(|| {
        let descriptor = array_codec(
            string_item_codec(Ownership::Full),
            ArrayKind::GArray,
            Ownership::Full,
        );
        let val = Value::Array(vec![Value::String("foo".to_string())]);
        let encoded = descriptor.encode(&val).unwrap();
        drop(encoded);
    });
}

#[test]
fn decode_with_context_sized_enum_flags_elements_without_range_guard() {
    let descriptor = sized_array_type(enum_flags_item_codec(), 0, Ownership::Borrowed);
    let data: Vec<i32> = vec![0, 1, 2];
    let stash = Stash::Ptr(data.as_ptr() as *mut c_void);
    let ffi_args = [Stash::U32(3)];
    let arg_codecs = [Codec::Integer(IntegerCodec::U32)];
    let Value::Array(items) = descriptor
        .decode_with_context(&stash, &ffi_args, &arg_codecs)
        .unwrap()
    else {
        panic!("expected array")
    };
    assert_eq!(items.len(), 3);
    assert!(matches!(items[2], Value::Number(n) if n == 2.0));
}

#[test]
fn encode_optional_null_yields_null_ptr() {
    let descriptor = array_codec(
        Codec::Integer(IntegerCodec::U8),
        ArrayKind::Array,
        Ownership::Full,
    );
    match descriptor.encode(&Value::Null).unwrap() {
        Stash::Ptr(ptr) => assert!(ptr.is_null()),
        other => panic!("expected null ptr, got {other:?}"),
    }
    match descriptor.encode(&Value::Undefined).unwrap() {
        Stash::Ptr(ptr) => assert!(ptr.is_null()),
        other => panic!("expected null ptr, got {other:?}"),
    }
}

#[test]
fn encode_integer_array_extract_error() {
    let descriptor = array_codec(
        Codec::Integer(IntegerCodec::I32),
        ArrayKind::Array,
        Ownership::Full,
    );
    let val = Value::Array(vec![Value::Boolean(true)]);
    assert!(descriptor.encode(&val).is_err());
}

#[test]
fn encode_enum_flags_array_roundtrips_through_storage() {
    let descriptor = array_codec(enum_flags_item_codec(), ArrayKind::Array, Ownership::Full);
    let val = Value::Array(vec![Value::Number(0.0), Value::Number(1.0)]);
    let encoded = descriptor.encode(&val).unwrap();
    let Stash::Storage(storage) = &encoded else {
        panic!("expected storage")
    };
    let slice = unsafe { std::slice::from_raw_parts(storage.ptr() as *const i32, 2) };
    assert_eq!(slice, &[0, 1]);
}

#[test]
fn encode_float_f32_array_roundtrips() {
    let descriptor = array_codec(
        Codec::Float(FloatCodec::F32),
        ArrayKind::Array,
        Ownership::Full,
    );
    let val = Value::Array(vec![Value::Number(1.5), Value::Number(2.5)]);
    let encoded = descriptor.encode(&val).unwrap();
    let Stash::Storage(storage) = &encoded else {
        panic!("expected storage")
    };
    let slice = unsafe { std::slice::from_raw_parts(storage.ptr() as *const f32, 2) };
    assert_eq!(slice, &[1.5f32, 2.5]);
}

#[test]
fn encode_float_f64_array_roundtrips() {
    let descriptor = array_codec(
        Codec::Float(FloatCodec::F64),
        ArrayKind::Array,
        Ownership::Full,
    );
    let val = Value::Array(vec![Value::Number(1.25)]);
    let encoded = descriptor.encode(&val).unwrap();
    let Stash::Storage(storage) = &encoded else {
        panic!("expected storage")
    };
    let slice = unsafe { std::slice::from_raw_parts(storage.ptr() as *const f64, 1) };
    assert_eq!(slice, &[1.25f64]);
}

#[test]
fn encode_boolean_array_roundtrips() {
    let descriptor = array_codec(
        Codec::Boolean(BooleanCodec),
        ArrayKind::Array,
        Ownership::Full,
    );
    let val = Value::Array(vec![Value::Boolean(true), Value::Boolean(false)]);
    let encoded = descriptor.encode(&val).unwrap();
    let Stash::Storage(storage) = &encoded else {
        panic!("expected storage")
    };
    let slice = unsafe { std::slice::from_raw_parts(storage.ptr() as *const i32, 2) };
    assert_eq!(slice, &[1, 0]);
}

#[test]
fn encode_boolean_array_extract_error() {
    let descriptor = array_codec(
        Codec::Boolean(BooleanCodec),
        ArrayKind::Array,
        Ownership::Full,
    );
    let val = Value::Array(vec![Value::Number(1.0)]);
    assert!(descriptor.encode(&val).is_err());
}

#[test]
fn encode_string_array_extract_error() {
    let descriptor = array_codec(
        string_item_codec(Ownership::Full),
        ArrayKind::Array,
        Ownership::Full,
    );
    let val = Value::Array(vec![Value::Number(1.0)]);
    assert!(descriptor.encode(&val).is_err());
}

#[test]
fn encode_string_array_full_ownership_transfers_glib_container() {
    let descriptor = array_codec(
        string_item_codec(Ownership::Full),
        ArrayKind::Array,
        Ownership::Full,
    );
    let val = Value::Array(vec![
        Value::String("foo".to_string()),
        Value::String("bar".to_string()),
    ]);
    let encoded = descriptor.encode(&val).unwrap();
    encoded.disarm_pending_transfer();
    let Stash::Storage(storage) = &encoded else {
        panic!("expected storage")
    };

    let container = storage.ptr() as *mut *mut std::ffi::c_char;
    let first = unsafe { std::ffi::CStr::from_ptr(*container) };
    let second = unsafe { std::ffi::CStr::from_ptr(*container.add(1)) };
    assert_eq!(first.to_str().unwrap(), "foo");
    assert_eq!(second.to_str().unwrap(), "bar");
    assert!(unsafe { (*container.add(2)).is_null() });

    unsafe { glib::ffi::g_strfreev(container) };
}

#[test]
fn encode_string_array_full_ownership_releases_when_call_never_happens() {
    let descriptor = array_codec(
        string_item_codec(Ownership::Full),
        ArrayKind::Array,
        Ownership::Full,
    );
    let val = Value::Array(vec![Value::String("foo".to_string())]);
    let encoded = descriptor.encode(&val).unwrap();
    drop(encoded);
}

#[test]
fn encode_string_array_borrowed_container_and_elements_roundtrips() {
    let descriptor = array_codec(
        string_item_codec(Ownership::Borrowed),
        ArrayKind::Array,
        Ownership::Borrowed,
    );
    let val = Value::Array(vec![Value::String("foo".to_string())]);
    let encoded = descriptor.encode(&val).unwrap();
    let Stash::Storage(storage) = &encoded else {
        panic!("expected storage")
    };
    assert!(matches!(storage.data(), StashData::StrV(_)));

    let ptrs =
        unsafe { std::slice::from_raw_parts(storage.ptr() as *const *const std::ffi::c_char, 2) };
    let s = unsafe { std::ffi::CStr::from_ptr(ptrs[0]) };
    assert_eq!(s.to_str().unwrap(), "foo");
    assert!(ptrs[1].is_null());
}

#[test]
fn encode_string_array_element_transfer_hands_over_duplicates() {
    let descriptor = array_codec(
        string_item_codec(Ownership::Full),
        ArrayKind::Array,
        Ownership::Borrowed,
    );
    let val = Value::Array(vec![Value::String("foo".to_string())]);
    let encoded = descriptor.encode(&val).unwrap();
    encoded.disarm_pending_transfer();
    let Stash::Storage(storage) = &encoded else {
        panic!("expected storage")
    };
    let StashData::StringArray(retained, ptrs) = storage.data() else {
        panic!("expected string array storage")
    };
    assert!(retained.is_empty());
    assert_eq!(ptrs.len(), 2);
    assert!(ptrs[1].is_null());

    let dup = unsafe { std::ffi::CStr::from_ptr(ptrs[0] as *const std::ffi::c_char) };
    assert_eq!(dup.to_str().unwrap(), "foo");
    unsafe { glib::ffi::g_free(ptrs[0]) };
}

#[test]
fn encode_string_array_borrowed_keeps_elements() {
    let descriptor = array_codec(
        string_item_codec(Ownership::Borrowed),
        ArrayKind::Array,
        Ownership::Full,
    );
    let val = Value::Array(vec![Value::String("foo".to_string())]);
    let encoded = descriptor.encode(&val).unwrap();
    let Stash::Storage(storage) = &encoded else {
        panic!("expected storage")
    };
    let ptrs =
        unsafe { std::slice::from_raw_parts(storage.ptr() as *const *const std::ffi::c_char, 2) };
    let s = unsafe { std::ffi::CStr::from_ptr(ptrs[0]) };
    assert_eq!(s.to_str().unwrap(), "foo");
    assert!(ptrs[1].is_null());
}

#[test]
fn encode_pointer_array_with_element_size_copies_into_buffer() {
    let mut descriptor = array_codec(struct_item_codec(), ArrayKind::Array, Ownership::Full);
    descriptor.element_size = Some(size_of::<gtk4::gdk::ffi::GdkRGBA>());
    let handle = boxed_handle();
    let val = Value::Array(vec![Value::Object(handle)]);
    let encoded = descriptor.encode(&val).unwrap();
    assert!(matches!(encoded, Stash::Storage(_)));
}

#[test]
fn encode_pointer_array_with_element_size_rejects_null_handle() {
    let mut descriptor = array_codec(struct_item_codec(), ArrayKind::Array, Ownership::Full);
    descriptor.element_size = Some(8);
    let val = Value::Array(vec![Value::Object(Handle::from_glib_borrow(
        std::ptr::null_mut(),
    ))]);
    assert!(descriptor.encode(&val).is_err());
}

#[test]
fn encode_pointer_array_extract_error() {
    let descriptor = array_codec(struct_item_codec(), ArrayKind::Array, Ownership::Full);
    let val = Value::Array(vec![Value::Number(1.0)]);
    assert!(descriptor.encode(&val).is_err());
}

#[test]
fn encode_pointer_array_full_ownership_transfers_glib_container() {
    let descriptor = array_codec(struct_item_codec(), ArrayKind::Array, Ownership::Full);
    let val = Value::Array(vec![Value::Object(boxed_handle())]);
    let encoded = descriptor.encode(&val).unwrap();
    encoded.disarm_pending_transfer();
    let Stash::Storage(storage) = &encoded else {
        panic!("expected storage")
    };
    let StashData::ObjectArray(handles, ptrs) = storage.data() else {
        panic!("expected object array storage")
    };
    assert_eq!(handles.len(), 1);
    assert!(ptrs.is_empty());

    let container = storage.ptr() as *mut *mut std::ffi::c_void;
    assert!(!unsafe { *container }.is_null());
    assert!(unsafe { *container.add(1) }.is_null());

    unsafe { glib::ffi::g_free(container as *mut std::ffi::c_void) };
}

#[test]
fn encode_pointer_array_null_terminated_with_handles() {
    let descriptor = array_codec(struct_item_codec(), ArrayKind::Array, Ownership::Borrowed);
    let val = Value::Array(vec![Value::Object(boxed_handle())]);
    let encoded = descriptor.encode(&val).unwrap();
    let Stash::Storage(storage) = encoded else {
        panic!("expected storage")
    };
    let StashData::ObjectArray(_, ptrs) = storage.data() else {
        panic!("expected object array storage")
    };
    assert_eq!(ptrs.len(), 2);
    assert!(ptrs[1].is_null());
}

#[test]
fn encode_pointer_array_null_terminated_empty_has_sentinel() {
    let descriptor = array_codec(struct_item_codec(), ArrayKind::Array, Ownership::Borrowed);
    let encoded = descriptor.encode(&Value::Array(vec![])).unwrap();
    let Stash::Storage(storage) = encoded else {
        panic!("expected storage")
    };
    let StashData::ObjectArray(_, ptrs) = storage.data() else {
        panic!("expected object array storage")
    };
    assert_eq!(ptrs.len(), 1);
    assert!(ptrs[0].is_null());
}

#[test]
fn encode_pointer_array_null_terminated_rejects_null_handle() {
    let descriptor = array_codec(struct_item_codec(), ArrayKind::Array, Ownership::Full);
    let val = Value::Array(vec![Value::Object(Handle::from_glib_borrow(
        std::ptr::null_mut(),
    ))]);
    assert!(descriptor.encode(&val).is_err());
}

#[test]
fn encode_glist_strings_full_ownership_dups_elements() {
    helpers::run(|| {
        let descriptor = array_codec(
            string_item_codec(Ownership::Full),
            ArrayKind::GList,
            Ownership::Borrowed,
        );
        let val = Value::Array(vec![
            Value::String("a".to_string()),
            Value::String("b".to_string()),
        ]);
        let encoded = descriptor.encode(&val).unwrap();
        assert!(matches!(encoded, Stash::Storage(_)));
    });
}

#[test]
fn encode_glist_strings_borrowed_roundtrips() {
    helpers::run(|| {
        let descriptor = array_codec(
            string_item_codec(Ownership::Borrowed),
            ArrayKind::GList,
            Ownership::Borrowed,
        );
        let val = Value::Array(vec![
            Value::String("a".to_string()),
            Value::String("b".to_string()),
        ]);
        let encoded = descriptor.encode(&val).unwrap();
        let Value::Array(items) = descriptor.decode(&encoded).unwrap() else {
            panic!("expected array")
        };
        assert_eq!(items.len(), 2);
    });
}

#[test]
fn encode_glist_handles_roundtrips() {
    helpers::run(|| {
        let descriptor = array_codec(struct_item_codec(), ArrayKind::GList, Ownership::Borrowed);
        let val = Value::Array(vec![Value::Object(boxed_handle())]);
        let encoded = descriptor.encode(&val).unwrap();
        let Value::Array(items) = descriptor.decode(&encoded).unwrap() else {
            panic!("expected array")
        };
        assert_eq!(items.len(), 1);
    });
}

#[test]
fn encode_glist_handles_rejects_null() {
    helpers::run(|| {
        let descriptor = array_codec(struct_item_codec(), ArrayKind::GList, Ownership::Borrowed);
        let val = Value::Array(vec![Value::Object(Handle::from_glib_borrow(
            std::ptr::null_mut(),
        ))]);
        assert!(descriptor.encode(&val).is_err());
    });
}

#[test]
fn encode_gslist_strings_full_ownership_dups_elements() {
    helpers::run(|| {
        let descriptor = array_codec(
            string_item_codec(Ownership::Full),
            ArrayKind::GSList,
            Ownership::Borrowed,
        );
        let val = Value::Array(vec![
            Value::String("x".to_string()),
            Value::String("y".to_string()),
        ]);
        let encoded = descriptor.encode(&val).unwrap();
        assert!(matches!(encoded, Stash::Storage(_)));
    });
}

#[test]
fn encode_gslist_strings_borrowed_roundtrips() {
    helpers::run(|| {
        let descriptor = array_codec(
            string_item_codec(Ownership::Borrowed),
            ArrayKind::GSList,
            Ownership::Borrowed,
        );
        let val = Value::Array(vec![
            Value::String("x".to_string()),
            Value::String("y".to_string()),
        ]);
        let encoded = descriptor.encode(&val).unwrap();
        let Value::Array(items) = descriptor.decode(&encoded).unwrap() else {
            panic!("expected array")
        };
        assert_eq!(items.len(), 2);
    });
}

#[test]
fn encode_gslist_handles_roundtrips() {
    helpers::run(|| {
        let descriptor = array_codec(struct_item_codec(), ArrayKind::GSList, Ownership::Borrowed);
        let val = Value::Array(vec![Value::Object(boxed_handle())]);
        let encoded = descriptor.encode(&val).unwrap();
        let Value::Array(items) = descriptor.decode(&encoded).unwrap() else {
            panic!("expected array")
        };
        assert_eq!(items.len(), 1);
    });
}

#[test]
fn encode_gslist_handles_rejects_null() {
    helpers::run(|| {
        let descriptor = array_codec(struct_item_codec(), ArrayKind::GSList, Ownership::Borrowed);
        let val = Value::Array(vec![Value::Object(Handle::from_glib_borrow(
            std::ptr::null_mut(),
        ))]);
        assert!(descriptor.encode(&val).is_err());
    });
}

#[test]
fn encode_gbytearray_roundtrips() {
    helpers::run(|| {
        let descriptor = array_codec(
            Codec::Integer(IntegerCodec::U8),
            ArrayKind::GByteArray,
            Ownership::Borrowed,
        );
        let val = Value::Array(vec![
            Value::Number(1.0),
            Value::Number(2.0),
            Value::Number(255.0),
        ]);
        let encoded = descriptor.encode(&val).unwrap();
        let Value::Array(items) = descriptor.decode(&encoded).unwrap() else {
            panic!("expected array")
        };
        assert_eq!(items.len(), 3);
    });
}

#[test]
fn encode_garray_integer_roundtrips() {
    helpers::run(|| {
        let descriptor = array_codec(
            Codec::Integer(IntegerCodec::I32),
            ArrayKind::GArray,
            Ownership::Borrowed,
        );
        let val = Value::Array(vec![Value::Number(10.0), Value::Number(-20.0)]);
        let encoded = descriptor.encode(&val).unwrap();
        let Value::Array(items) = descriptor.decode(&encoded).unwrap() else {
            panic!("expected array")
        };
        assert_eq!(items.len(), 2);
    });
}

#[test]
fn encode_garray_float_f32_roundtrips() {
    helpers::run(|| {
        let descriptor = array_codec(
            Codec::Float(FloatCodec::F32),
            ArrayKind::GArray,
            Ownership::Borrowed,
        );
        let val = Value::Array(vec![Value::Number(1.5)]);
        let encoded = descriptor.encode(&val).unwrap();
        let Value::Array(items) = descriptor.decode(&encoded).unwrap() else {
            panic!("expected array")
        };
        assert_eq!(items.len(), 1);
    });
}

#[test]
fn encode_garray_float_f64_roundtrips() {
    helpers::run(|| {
        let descriptor = array_codec(
            Codec::Float(FloatCodec::F64),
            ArrayKind::GArray,
            Ownership::Borrowed,
        );
        let val = Value::Array(vec![Value::Number(2.75)]);
        let encoded = descriptor.encode(&val).unwrap();
        let Value::Array(items) = descriptor.decode(&encoded).unwrap() else {
            panic!("expected array")
        };
        assert_eq!(items.len(), 1);
    });
}

#[test]
fn encode_garray_boolean_roundtrips() {
    helpers::run(|| {
        let descriptor = array_codec(
            Codec::Boolean(BooleanCodec),
            ArrayKind::GArray,
            Ownership::Borrowed,
        );
        let val = Value::Array(vec![Value::Boolean(true), Value::Boolean(false)]);
        let encoded = descriptor.encode(&val).unwrap();
        let Value::Array(items) = descriptor.decode(&encoded).unwrap() else {
            panic!("expected array")
        };
        assert_eq!(items.len(), 2);
    });
}

#[test]
fn encode_garray_enum_flags_roundtrips() {
    helpers::run(|| {
        let descriptor = array_codec(
            enum_flags_item_codec(),
            ArrayKind::GArray,
            Ownership::Borrowed,
        );
        let val = Value::Array(vec![Value::Number(1.0)]);
        let encoded = descriptor.encode(&val).unwrap();
        assert!(matches!(encoded, Stash::Storage(_)));
    });
}

#[test]
fn encode_garray_handles_roundtrips() {
    helpers::run(|| {
        let descriptor = array_codec(struct_item_codec(), ArrayKind::GArray, Ownership::Borrowed);
        let val = Value::Array(vec![Value::Object(boxed_handle())]);
        let encoded = descriptor.encode(&val).unwrap();
        let Value::Array(items) = descriptor.decode(&encoded).unwrap() else {
            panic!("expected array")
        };
        assert_eq!(items.len(), 1);
    });
}

#[test]
fn encode_garray_handles_rejects_null() {
    helpers::run(|| {
        let descriptor = array_codec(struct_item_codec(), ArrayKind::GArray, Ownership::Borrowed);
        let val = Value::Array(vec![Value::Object(Handle::from_glib_borrow(
            std::ptr::null_mut(),
        ))]);
        assert!(descriptor.encode(&val).is_err());
    });
}

#[test]
fn encode_garray_strings_roundtrips() {
    helpers::run(|| {
        let descriptor = array_codec(
            string_item_codec(Ownership::Full),
            ArrayKind::GArray,
            Ownership::Borrowed,
        );
        let val = Value::Array(vec![Value::String("hello".to_string())]);
        let encoded = descriptor.encode(&val).unwrap();
        assert!(matches!(encoded, Stash::Storage(_)));
    });
}

#[test]
fn encode_garray_explicit_element_size_used() {
    helpers::run(|| {
        let mut descriptor = array_codec(
            Codec::Integer(IntegerCodec::I32),
            ArrayKind::GArray,
            Ownership::Borrowed,
        );
        descriptor.element_size = Some(size_of::<i32>());
        let val = Value::Array(vec![Value::Number(7.0)]);
        let encoded = descriptor.encode(&val).unwrap();
        assert!(matches!(encoded, Stash::Storage(_)));
    });
}

#[test]
fn decode_zero_terminated_scalar_array_reads_with_scalar_stride() {
    helpers::run(|| {
        let descriptor = array_codec(
            Codec::Integer(IntegerCodec::I32),
            ArrayKind::Array,
            Ownership::Borrowed,
        );
        let buffer: [i32; 4] = [7, 8, 9, 0];
        let decoded = descriptor
            .decode(&Stash::Ptr(buffer.as_ptr() as *mut std::ffi::c_void))
            .expect("zero-terminated scalar decode should succeed");
        let Value::Array(items) = decoded else {
            panic!("expected array")
        };
        assert_eq!(items.len(), 3);
        assert!(matches!(items[0], Value::Number(n) if n == 7.0));
        assert!(matches!(items[2], Value::Number(n) if n == 9.0));
    });
}

#[test]
fn encode_bigint_array_roundtrips_through_storage() {
    for kind in [BigIntCodec::I64, BigIntCodec::U64] {
        let descriptor = array_codec(Codec::BigInt(kind), ArrayKind::Array, Ownership::Full);
        let big = i128::from(u32::MAX) + 1;
        let val = Value::Array(vec![Value::BigInt(big), Value::BigInt(7)]);
        let encoded = descriptor.encode(&val).unwrap();
        let Stash::Storage(storage) = &encoded else {
            panic!("expected storage")
        };
        match kind {
            BigIntCodec::I64 => {
                let slice = unsafe { std::slice::from_raw_parts(storage.ptr() as *const i64, 2) };
                assert_eq!(slice, &[big as i64, 7]);
            }
            BigIntCodec::U64 => {
                let slice = unsafe { std::slice::from_raw_parts(storage.ptr() as *const u64, 2) };
                assert_eq!(slice, &[big as u64, 7]);
            }
        }
    }
}

#[test]
fn encode_garray_bigint_roundtrips() {
    helpers::run(|| {
        for kind in [BigIntCodec::I64, BigIntCodec::U64] {
            let descriptor =
                array_codec(Codec::BigInt(kind), ArrayKind::GArray, Ownership::Borrowed);
            let big = i128::from(u32::MAX) + 5;
            let val = Value::Array(vec![Value::BigInt(10), Value::BigInt(big)]);
            let encoded = descriptor.encode(&val).unwrap();
            let Value::Array(items) = descriptor.decode(&encoded).unwrap() else {
                panic!("expected array")
            };
            assert_eq!(items.len(), 2);
            assert!(matches!(items[1], Value::BigInt(v) if v == big));
        }
    });
}

#[test]
fn decode_contiguous_bigint_elements() {
    for kind in [BigIntCodec::I64, BigIntCodec::U64] {
        let descriptor = fixed_array_type(Codec::BigInt(kind), 2, Ownership::Borrowed);
        let data: Vec<i64> = vec![100, 42];
        let Value::Array(items) = descriptor
            .decode_with_context(&Stash::Ptr(data.as_ptr() as *mut c_void), &[], &[])
            .unwrap()
        else {
            panic!("expected array")
        };
        assert_eq!(items.len(), 2);
        assert!(matches!(items[1], Value::BigInt(v) if v == 42));
    }
}

#[test]
fn decode_zero_terminated_bigint_array() {
    let descriptor = array_codec(
        Codec::BigInt(BigIntCodec::U64),
        ArrayKind::Array,
        Ownership::Borrowed,
    );
    let buffer: [u64; 3] = [5, 9, 0];
    let decoded = descriptor
        .decode(&Stash::Ptr(buffer.as_ptr() as *mut c_void))
        .expect("zero-terminated bigint decode should succeed");
    let Value::Array(items) = decoded else {
        panic!("expected array")
    };
    assert_eq!(items.len(), 2);
    assert!(matches!(items[0], Value::BigInt(v) if v == 5));
}

#[test]
fn encode_bigint_array_rejects_out_of_range() {
    let neg = array_codec(
        Codec::BigInt(BigIntCodec::U64),
        ArrayKind::Array,
        Ownership::Full,
    );
    assert!(neg.encode(&Value::Array(vec![Value::BigInt(-1)])).is_err());

    let over = array_codec(
        Codec::BigInt(BigIntCodec::I64),
        ArrayKind::Array,
        Ownership::Full,
    );
    assert!(
        over.encode(&Value::Array(vec![Value::BigInt(i128::from(i64::MAX) + 1)]))
            .is_err()
    );
}

#[test]
fn decode_gptrarray_frees_container_when_element_decode_fails() {
    helpers::run(|| {
        let ptr_array = unsafe { glib::ffi::g_ptr_array_new() };
        unsafe { glib::ffi::g_ptr_array_add(ptr_array, std::ptr::without_provenance_mut(0x4)) };
        unsafe { glib::ffi::g_ptr_array_ref(ptr_array) };

        let descriptor = array_codec(
            Codec::Integer(IntegerCodec::I32),
            ArrayKind::GPtrArray,
            Ownership::Full,
        );
        assert!(
            descriptor
                .decode(&Stash::Ptr(ptr_array as *mut std::ffi::c_void))
                .is_err()
        );

        unsafe { glib::ffi::g_ptr_array_unref(ptr_array) };
    });
}

#[test]
fn decode_glist_frees_spine_when_element_decode_fails() {
    helpers::run(|| {
        let list = unsafe {
            glib::ffi::g_list_append(std::ptr::null_mut(), std::ptr::without_provenance_mut(0x4))
        };

        let descriptor = array_codec(
            Codec::Integer(IntegerCodec::I32),
            ArrayKind::GList,
            Ownership::Full,
        );
        assert!(
            descriptor
                .decode(&Stash::Ptr(list as *mut std::ffi::c_void))
                .is_err()
        );
    });
}

#[test]
fn encode_garray_append_error_unrefs_and_propagates() {
    helpers::run(|| {
        let descriptor = array_codec(
            Codec::Integer(IntegerCodec::I32),
            ArrayKind::GArray,
            Ownership::Borrowed,
        );
        let val = Value::Array(vec![Value::Boolean(true)]);
        assert!(descriptor.encode(&val).is_err());
    });
}

#[test]
fn encode_gptrarray_uses_null_terminated_layout() {
    let descriptor = array_codec(struct_item_codec(), ArrayKind::GPtrArray, Ownership::Full);
    let val = Value::Array(vec![Value::Object(boxed_handle())]);
    let encoded = descriptor.encode(&val).unwrap();
    assert!(matches!(encoded, Stash::Storage(_)));
}

#[test]
fn encode_integer_array_into_storage() {
    let descriptor = array_codec(
        Codec::Integer(IntegerCodec::U16),
        ArrayKind::Array,
        Ownership::Full,
    );
    let encoded = descriptor
        .encode(&Value::Array(vec![Value::Number(1.0), Value::Number(2.0)]))
        .unwrap();
    let Stash::Storage(storage) = &encoded else {
        panic!("expected storage")
    };
    let slice = unsafe { std::slice::from_raw_parts(storage.ptr() as *const u16, 2) };
    assert_eq!(slice, &[1u16, 2]);
}

#[test]
fn decode_null_ptr_yields_empty_array() {
    let descriptor = array_codec(
        Codec::Integer(IntegerCodec::U8),
        ArrayKind::Array,
        Ownership::Full,
    );
    let Value::Array(items) = descriptor
        .decode(&Stash::Ptr(std::ptr::null_mut()))
        .unwrap()
    else {
        panic!("expected array")
    };
    assert!(items.is_empty());
}

#[test]
fn decode_null_terminated_string_array_from_ptr() {
    let descriptor = array_codec(
        string_item_codec(Ownership::Borrowed),
        ArrayKind::Array,
        Ownership::Borrowed,
    );
    let s0 = CString::new("first").unwrap();
    let s1 = CString::new("second").unwrap();
    let mut ptrs: Vec<*const c_char> = vec![s0.as_ptr(), s1.as_ptr(), std::ptr::null()];
    let Value::Array(items) = descriptor
        .decode(&Stash::Ptr(ptrs.as_mut_ptr() as *mut c_void))
        .unwrap()
    else {
        panic!("expected array")
    };
    assert_eq!(items.len(), 2);
}

#[test]
fn decode_null_terminated_string_array_full_ownership_frees() {
    helpers::run(|| {
        let descriptor = array_codec(
            string_item_codec(Ownership::Full),
            ArrayKind::Array,
            Ownership::Full,
        );
        let strv = unsafe {
            let arr = glib::ffi::g_malloc0(size_of::<*mut c_char>() * 3) as *mut *mut c_char;
            *arr = glib::ffi::g_strdup(c"a".as_ptr());
            *arr.add(1) = glib::ffi::g_strdup(c"b".as_ptr());
            arr
        };
        let Value::Array(items) = descriptor.decode(&Stash::Ptr(strv as *mut c_void)).unwrap()
        else {
            panic!("expected array")
        };
        assert_eq!(items.len(), 2);
    });
}

#[test]
fn decode_null_terminated_borrowed_string_array_full_ownership_frees_vector_only() {
    helpers::run(|| {
        let descriptor = array_codec(
            string_item_codec(Ownership::Borrowed),
            ArrayKind::Array,
            Ownership::Full,
        );
        let strv = unsafe {
            let arr = glib::ffi::g_malloc0(size_of::<*mut c_char>() * 2) as *mut *mut c_char;
            *arr = c"borrowed".as_ptr().cast_mut();
            arr
        };
        let Value::Array(items) = descriptor.decode(&Stash::Ptr(strv as *mut c_void)).unwrap()
        else {
            panic!("expected array")
        };
        assert!(matches!(items.first(), Some(Value::String(s)) if s == "borrowed"));
    });
}

#[test]
fn decode_null_terminated_ptr_array_from_ptr() {
    let descriptor = array_codec(struct_item_codec(), ArrayKind::Array, Ownership::Borrowed);
    let h0 = boxed_handle();
    let h1 = boxed_handle();
    let mut ptrs: Vec<*mut c_void> = vec![h0.as_ptr(), h1.as_ptr(), std::ptr::null_mut()];
    let Value::Array(items) = descriptor
        .decode(&Stash::Ptr(ptrs.as_mut_ptr() as *mut c_void))
        .unwrap()
    else {
        panic!("expected array")
    };
    assert_eq!(items.len(), 2);
}

#[test]
fn decode_null_terminated_ptr_array_full_ownership_frees() {
    helpers::run(|| {
        let descriptor = array_codec(struct_item_codec(), ArrayKind::Array, Ownership::Full);
        let arr = unsafe {
            let mem = glib::ffi::g_malloc0(size_of::<*mut c_void>() * 2) as *mut *mut c_void;
            *mem = boxed_handle().as_ptr();
            mem
        };
        let Value::Array(items) = descriptor.decode(&Stash::Ptr(arr as *mut c_void)).unwrap()
        else {
            panic!("expected array")
        };
        assert_eq!(items.len(), 1);
    });
}

#[test]
fn decode_glist_empty_and_populated() {
    helpers::run(|| {
        let descriptor = array_codec(struct_item_codec(), ArrayKind::GList, Ownership::Full);
        let Value::Array(empty) = descriptor
            .decode(&Stash::Ptr(std::ptr::null_mut()))
            .unwrap()
        else {
            panic!("expected array")
        };
        assert!(empty.is_empty());

        let list =
            unsafe { glib::ffi::g_list_append(std::ptr::null_mut(), boxed_handle().as_ptr()) };
        let Value::Array(items) = descriptor.decode(&Stash::Ptr(list as *mut c_void)).unwrap()
        else {
            panic!("expected array")
        };
        assert_eq!(items.len(), 1);
    });
}

#[test]
fn decode_gslist_full_ownership_frees_list() {
    helpers::run(|| {
        let descriptor = array_codec(struct_item_codec(), ArrayKind::GSList, Ownership::Full);
        let list =
            unsafe { glib::ffi::g_slist_append(std::ptr::null_mut(), boxed_handle().as_ptr()) };
        let Value::Array(items) = descriptor.decode(&Stash::Ptr(list as *mut c_void)).unwrap()
        else {
            panic!("expected array")
        };
        assert_eq!(items.len(), 1);
    });
}

#[test]
fn decode_garray_from_borrowed_ptr() {
    helpers::run(|| {
        let descriptor = array_codec(
            Codec::Integer(IntegerCodec::I32),
            ArrayKind::GArray,
            Ownership::Full,
        );
        let g_array = unsafe { glib::ffi::g_array_sized_new(0, 0, size_of::<i32>() as u32, 0) };
        let value: i32 = 42;
        unsafe {
            glib::ffi::g_array_append_vals(g_array, &value as *const i32 as *const c_void, 1);
        }
        let Value::Array(items) = descriptor
            .decode(&Stash::Ptr(g_array as *mut c_void))
            .unwrap()
        else {
            panic!("expected array")
        };
        assert_eq!(items.len(), 1);
    });
}

#[test]
fn decode_garray_null_yields_empty() {
    helpers::run(|| {
        let descriptor = array_codec(
            Codec::Integer(IntegerCodec::I32),
            ArrayKind::GArray,
            Ownership::Full,
        );
        let Value::Array(items) = descriptor
            .decode(&Stash::Ptr(std::ptr::null_mut()))
            .unwrap()
        else {
            panic!("expected array")
        };
        assert!(items.is_empty());
    });
}

#[test]
fn decode_garray_storage_owned_does_not_double_free() {
    helpers::run(|| {
        let descriptor = array_codec(
            Codec::Integer(IntegerCodec::I32),
            ArrayKind::GArray,
            Ownership::Full,
        );
        let g_array = unsafe { glib::ffi::g_array_sized_new(0, 0, size_of::<i32>() as u32, 0) };
        let storage = native::ffi::StashStorage::new(
            g_array as *mut c_void,
            native::ffi::StashData::GArray(GArrayData {
                ptr: g_array,
                should_free: true,
            }),
        );
        let Value::Array(items) = descriptor.decode(&Stash::Storage(storage)).unwrap() else {
            panic!("expected array")
        };
        assert!(items.is_empty());
    });
}

#[test]
fn decode_gptrarray_from_ptr() {
    helpers::run(|| {
        let descriptor = array_codec(struct_item_codec(), ArrayKind::GPtrArray, Ownership::Full);
        let ptr_array = unsafe { glib::ffi::g_ptr_array_new() };
        unsafe { glib::ffi::g_ptr_array_add(ptr_array, boxed_handle().as_ptr()) };
        let Value::Array(items) = descriptor
            .decode(&Stash::Ptr(ptr_array as *mut c_void))
            .unwrap()
        else {
            panic!("expected array")
        };
        assert_eq!(items.len(), 1);
    });
}

#[test]
fn decode_gptrarray_null_yields_empty() {
    let descriptor = array_codec(struct_item_codec(), ArrayKind::GPtrArray, Ownership::Full);
    let Value::Array(items) = descriptor
        .decode(&Stash::Ptr(std::ptr::null_mut()))
        .unwrap()
    else {
        panic!("expected array")
    };
    assert!(items.is_empty());
}

#[test]
fn decode_gbytearray_from_ptr_and_empty() {
    helpers::run(|| {
        let descriptor = array_codec(
            Codec::Integer(IntegerCodec::U8),
            ArrayKind::GByteArray,
            Ownership::Borrowed,
        );
        let bytes = [1u8, 2, 3];
        let ba = unsafe {
            let ba = glib::ffi::g_byte_array_sized_new(3);
            glib::ffi::g_byte_array_append(ba, bytes.as_ptr(), 3);
            ba
        };
        let Value::Array(items) = descriptor.decode(&Stash::Ptr(ba as *mut c_void)).unwrap() else {
            panic!("expected array")
        };
        assert_eq!(items.len(), 3);
        unsafe { glib::ffi::g_byte_array_unref(ba) };

        let empty = unsafe { glib::ffi::g_byte_array_new() };
        let Value::Array(items) = descriptor
            .decode(&Stash::Ptr(empty as *mut c_void))
            .unwrap()
        else {
            panic!("expected array")
        };
        assert!(items.is_empty());
        unsafe { glib::ffi::g_byte_array_unref(empty) };
    });
}

#[test]
fn decode_gbytearray_full_ownership_unrefs_raw_ptr() {
    helpers::run(|| {
        let descriptor = array_codec(
            Codec::Integer(IntegerCodec::U8),
            ArrayKind::GByteArray,
            Ownership::Full,
        );
        let bytes = [7u8, 8];
        let ba = unsafe {
            let ba = glib::ffi::g_byte_array_sized_new(2);
            glib::ffi::g_byte_array_append(ba, bytes.as_ptr(), 2);
            glib::ffi::g_byte_array_ref(ba)
        };
        let Value::Array(items) = descriptor.decode(&Stash::Ptr(ba as *mut c_void)).unwrap() else {
            panic!("expected array")
        };
        assert_eq!(items.len(), 2);
        unsafe { glib::ffi::g_byte_array_unref(ba) };
    });
}

#[test]
fn decode_gbytearray_null_yields_empty() {
    let descriptor = array_codec(
        Codec::Integer(IntegerCodec::U8),
        ArrayKind::GByteArray,
        Ownership::Full,
    );
    let Value::Array(items) = descriptor
        .decode(&Stash::Ptr(std::ptr::null_mut()))
        .unwrap()
    else {
        panic!("expected array")
    };
    assert!(items.is_empty());
}

#[test]
fn decode_with_context_sized_array() {
    let descriptor = sized_array_type(Codec::Integer(IntegerCodec::I32), 0, Ownership::Borrowed);
    let data: Vec<i32> = vec![5, 6, 7];
    let stash = Stash::Ptr(data.as_ptr() as *mut c_void);
    let ffi_args = [Stash::U32(3)];
    let arg_codecs = [Codec::Integer(IntegerCodec::U32)];
    let Value::Array(items) = descriptor
        .decode_with_context(&stash, &ffi_args, &arg_codecs)
        .unwrap()
    else {
        panic!("expected array")
    };
    assert_eq!(items.len(), 3);
}

#[test]
fn decode_with_context_sized_array_null_ptr() {
    let descriptor = sized_array_type(Codec::Integer(IntegerCodec::I32), 0, Ownership::Borrowed);
    let stash = Stash::Ptr(std::ptr::null_mut());
    let ffi_args = [Stash::U32(3)];
    let arg_codecs = [Codec::Integer(IntegerCodec::U32)];
    let Value::Array(items) = descriptor
        .decode_with_context(&stash, &ffi_args, &arg_codecs)
        .unwrap()
    else {
        panic!("expected array")
    };
    assert!(items.is_empty());
}

#[test]
fn decode_with_context_sized_rejects_non_ptr() {
    let descriptor = sized_array_type(Codec::Integer(IntegerCodec::I32), 0, Ownership::Borrowed);
    let storage = native::ffi::StashStorage::from(vec![1i32, 2]);
    let stash = Stash::Storage(storage);
    let ffi_args = [Stash::U32(2)];
    let arg_codecs = [Codec::Integer(IntegerCodec::U32)];
    assert!(
        descriptor
            .decode_with_context(&stash, &ffi_args, &arg_codecs)
            .is_err()
    );
}

#[test]
fn decode_with_context_fixed_array() {
    let descriptor = fixed_array_type(Codec::Float(FloatCodec::F64), 2, Ownership::Borrowed);
    let data: Vec<f64> = vec![1.0, 2.0];
    let stash = Stash::Ptr(data.as_ptr() as *mut c_void);
    let Value::Array(items) = descriptor.decode_with_context(&stash, &[], &[]).unwrap() else {
        panic!("expected array")
    };
    assert_eq!(items.len(), 2);
}

#[test]
fn decode_with_context_fixed_array_null_ptr() {
    let descriptor = fixed_array_type(Codec::Float(FloatCodec::F64), 2, Ownership::Borrowed);
    let stash = Stash::Ptr(std::ptr::null_mut());
    let Value::Array(items) = descriptor.decode_with_context(&stash, &[], &[]).unwrap() else {
        panic!("expected array")
    };
    assert!(items.is_empty());
}

#[test]
fn decode_with_context_fixed_rejects_non_ptr() {
    let descriptor = fixed_array_type(Codec::Integer(IntegerCodec::I32), 1, Ownership::Borrowed);
    let storage = native::ffi::StashStorage::from(vec![9i32]);
    assert!(
        descriptor
            .decode_with_context(&Stash::Storage(storage), &[], &[])
            .is_err()
    );
}

#[test]
fn decode_with_context_array_kind_rejects_non_ptr() {
    let descriptor = array_codec(
        Codec::Integer(IntegerCodec::I32),
        ArrayKind::Array,
        Ownership::Borrowed,
    );
    let storage = native::ffi::StashStorage::from(vec![1i32]);
    assert!(
        descriptor
            .decode_with_context(&Stash::Storage(storage), &[], &[])
            .is_err()
    );
}

#[test]
fn decode_contiguous_empty_and_null() {
    let descriptor = fixed_array_type(Codec::Integer(IntegerCodec::I32), 0, Ownership::Borrowed);
    let data: Vec<i32> = vec![1];
    let Value::Array(items) = descriptor
        .decode_with_context(&Stash::Ptr(data.as_ptr() as *mut c_void), &[], &[])
        .unwrap()
    else {
        panic!("expected array")
    };
    assert!(items.is_empty());
}

#[test]
fn decode_contiguous_pointer_elements() {
    let descriptor = fixed_array_type(struct_item_codec(), 1, Ownership::Borrowed);
    let handle = boxed_handle();
    let data: Vec<*mut c_void> = vec![handle.as_ptr()];
    let Value::Array(items) = descriptor
        .decode_with_context(&Stash::Ptr(data.as_ptr() as *mut c_void), &[], &[])
        .unwrap()
    else {
        panic!("expected array")
    };
    assert_eq!(items.len(), 1);
}

#[test]
fn decode_contiguous_float_and_boolean() {
    let f32_ty = fixed_array_type(Codec::Float(FloatCodec::F32), 1, Ownership::Borrowed);
    let f32_data: Vec<f32> = vec![1.5];
    assert!(matches!(
        f32_ty
            .decode_with_context(&Stash::Ptr(f32_data.as_ptr() as *mut c_void), &[], &[])
            .unwrap(),
        Value::Array(_)
    ));

    let bool_ty = fixed_array_type(Codec::Boolean(BooleanCodec), 1, Ownership::Borrowed);
    let bool_data: Vec<i32> = vec![1];
    assert!(matches!(
        bool_ty
            .decode_with_context(&Stash::Ptr(bool_data.as_ptr() as *mut c_void), &[], &[])
            .unwrap(),
        Value::Array(_)
    ));
}
#[test]
fn encode_storage_pointer_elements() {
    let descriptor = array_codec(struct_item_codec(), ArrayKind::Array, Ownership::Full);
    let encoded = descriptor
        .encode(&Value::Array(vec![Value::Object(boxed_handle())]))
        .unwrap();
    let Stash::Storage(storage) = &encoded else {
        panic!("expected storage")
    };
    let ptrs = unsafe { std::slice::from_raw_parts(storage.ptr() as *const *mut c_void, 2) };
    assert!(!ptrs[0].is_null());
    assert!(ptrs[1].is_null());
}

#[test]
fn ptr_to_value_null_yields_empty() {
    let descriptor = array_codec(
        Codec::Integer(IntegerCodec::I32),
        ArrayKind::Array,
        Ownership::Borrowed,
    );
    let value =
        unsafe { descriptor.read(ReadSource::Value(std::ptr::null_mut(), "array")) }.unwrap();
    assert!(matches!(value, Value::Array(items) if items.is_empty()));
}

#[test]
fn ptr_to_value_gptrarray() {
    helpers::run(|| {
        let descriptor = array_codec(
            struct_item_codec(),
            ArrayKind::GPtrArray,
            Ownership::Borrowed,
        );
        let ptr_array = unsafe { glib::ffi::g_ptr_array_new() };
        unsafe { glib::ffi::g_ptr_array_add(ptr_array, boxed_handle().as_ptr()) };
        let value =
            unsafe { descriptor.read(ReadSource::Value(ptr_array as *mut c_void, "array")) }
                .unwrap();
        assert!(matches!(value, Value::Array(items) if items.len() == 1));
        unsafe { glib::ffi::g_ptr_array_unref(ptr_array) };
    });
}

#[test]
fn ptr_to_value_gbytearray() {
    helpers::run(|| {
        let descriptor = array_codec(
            Codec::Integer(IntegerCodec::U8),
            ArrayKind::GByteArray,
            Ownership::Borrowed,
        );
        let bytes = [9u8];
        let ba = unsafe {
            let ba = glib::ffi::g_byte_array_sized_new(1);
            glib::ffi::g_byte_array_append(ba, bytes.as_ptr(), 1);
            ba
        };
        let value =
            unsafe { descriptor.read(ReadSource::Value(ba as *mut c_void, "array")) }.unwrap();
        assert!(matches!(value, Value::Array(items) if items.len() == 1));
        unsafe { glib::ffi::g_byte_array_unref(ba) };
    });
}

#[test]
fn ptr_to_value_garray() {
    helpers::run(|| {
        let descriptor = array_codec(
            Codec::Integer(IntegerCodec::I32),
            ArrayKind::GArray,
            Ownership::Borrowed,
        );
        let g_array = unsafe { glib::ffi::g_array_sized_new(0, 0, size_of::<i32>() as u32, 0) };
        let value: i32 = 1;
        unsafe {
            glib::ffi::g_array_append_vals(g_array, &value as *const i32 as *const c_void, 1)
        };
        let decoded =
            unsafe { descriptor.read(ReadSource::Value(g_array as *mut c_void, "array")) }.unwrap();
        assert!(matches!(decoded, Value::Array(items) if items.len() == 1));
        unsafe { glib::ffi::g_array_unref(g_array) };
    });
}

#[test]
fn ptr_to_value_glist() {
    helpers::run(|| {
        let descriptor = array_codec(struct_item_codec(), ArrayKind::GList, Ownership::Borrowed);
        let list =
            unsafe { glib::ffi::g_list_append(std::ptr::null_mut(), boxed_handle().as_ptr()) };
        let decoded =
            unsafe { descriptor.read(ReadSource::Value(list as *mut c_void, "array")) }.unwrap();
        assert!(matches!(decoded, Value::Array(items) if items.len() == 1));
        unsafe { glib::ffi::g_list_free(list) };
    });
}

#[test]
fn ptr_to_value_plain_array() {
    helpers::run(|| {
        let descriptor = array_codec(struct_item_codec(), ArrayKind::Array, Ownership::Borrowed);
        let h0 = boxed_handle();
        let mut data: Vec<*mut c_void> = vec![h0.as_ptr(), std::ptr::null_mut()];
        let decoded = unsafe {
            descriptor.read(ReadSource::Value(data.as_mut_ptr() as *mut c_void, "array"))
        }
        .unwrap();
        assert!(matches!(decoded, Value::Array(items) if items.len() == 1));
    });
}

#[test]
fn size_from_args_reads_integer_argument() {
    let descriptor = sized_array_type(Codec::Integer(IntegerCodec::I32), 0, Ownership::Borrowed);
    let data: Vec<i32> = vec![10, 20];
    let stash = Stash::Ptr(data.as_ptr() as *mut c_void);
    let ffi_args = [Stash::I32(2)];
    let arg_codecs = [Codec::Integer(IntegerCodec::I32)];
    let Value::Array(items) = descriptor
        .decode_with_context(&stash, &ffi_args, &arg_codecs)
        .unwrap()
    else {
        panic!("expected array")
    };
    assert_eq!(items.len(), 2);
}

#[test]
fn size_from_args_reads_ref_integer_storage() {
    let descriptor = sized_array_type(Codec::Integer(IntegerCodec::I32), 0, Ownership::Borrowed);
    let data: Vec<i32> = vec![10, 20];
    let stash = Stash::Ptr(data.as_ptr() as *mut c_void);
    let size_storage = native::ffi::StashStorage::from(vec![2i32]);
    let ffi_args = [Stash::Storage(size_storage)];
    let arg_codecs = [Codec::Ref(
        RefCodec::new(Codec::Integer(IntegerCodec::I32)).expect("valid Ref inner"),
    )];
    let Value::Array(items) = descriptor
        .decode_with_context(&stash, &ffi_args, &arg_codecs)
        .unwrap()
    else {
        panic!("expected array")
    };
    assert_eq!(items.len(), 2);
}

#[test]
fn size_from_args_reads_ref_integer_ptr() {
    let descriptor = sized_array_type(Codec::Integer(IntegerCodec::I32), 0, Ownership::Borrowed);
    let data: Vec<i32> = vec![10, 20];
    let stash = Stash::Ptr(data.as_ptr() as *mut c_void);
    let size: i32 = 2;
    let ffi_args = [Stash::Ptr(&size as *const i32 as *mut c_void)];
    let arg_codecs = [Codec::Ref(
        RefCodec::new(Codec::Integer(IntegerCodec::I32)).expect("valid Ref inner"),
    )];
    let Value::Array(items) = descriptor
        .decode_with_context(&stash, &ffi_args, &arg_codecs)
        .unwrap()
    else {
        panic!("expected array")
    };
    assert_eq!(items.len(), 2);
}

#[test]
fn size_from_args_ref_null_ptr_falls_through_to_error() {
    let descriptor = sized_array_type(Codec::Integer(IntegerCodec::I32), 0, Ownership::Borrowed);
    let data: Vec<i32> = vec![1];
    let stash = Stash::Ptr(data.as_ptr() as *mut c_void);
    let ffi_args = [Stash::Ptr(std::ptr::null_mut())];
    let arg_codecs = [Codec::Ref(
        RefCodec::new(Codec::Integer(IntegerCodec::I32)).expect("valid Ref inner"),
    )];
    assert!(
        descriptor
            .decode_with_context(&stash, &ffi_args, &arg_codecs)
            .is_err()
    );
}

#[test]
fn item_codec_resolves_pointer_kinds() {
    let descriptor = array_codec(struct_item_codec(), ArrayKind::Array, Ownership::Full);
    let encoded = descriptor.encode(&Value::Array(vec![])).unwrap();
    assert!(matches!(encoded, Stash::Storage(_)));
}

#[test]
fn trait_methods_delegate_to_inherent_implementations() {
    helpers::run(|| {
        let descriptor = array_codec(
            Codec::Integer(IntegerCodec::I32),
            ArrayKind::Array,
            Ownership::Borrowed,
        );

        let encoded =
            Encoder::encode(&descriptor, &Value::Array(vec![Value::Number(1.0)])).unwrap();
        let Stash::Storage(storage) = &encoded else {
            panic!("expected storage")
        };
        let slice = unsafe { std::slice::from_raw_parts(storage.ptr() as *const i32, 1) };
        assert_eq!(slice, &[1]);

        let ptr_ty = array_codec(struct_item_codec(), ArrayKind::Array, Ownership::Borrowed);
        let h0 = boxed_handle();
        let mut data: Vec<*mut c_void> = vec![h0.as_ptr(), std::ptr::null_mut()];
        let from_ptr = unsafe {
            Decoder::read(
                &ptr_ty,
                ReadSource::Value(data.as_mut_ptr() as *mut c_void, "ctx"),
            )
        }
        .unwrap();
        assert!(matches!(from_ptr, Value::Array(items) if items.len() == 1));
    });
}

#[test]
fn encode_string_array_dup_elements_failure_frees_earlier_duplicates() {
    let descriptor = array_codec(
        string_item_codec(Ownership::Full),
        ArrayKind::Array,
        Ownership::Borrowed,
    );
    let val = Value::Array(vec![Value::String("first".to_string()), Value::Number(2.0)]);
    let err = descriptor
        .encode(&val)
        .expect_err("a non-string element after a duplicated one must fail");
    assert!(err.to_string().contains("Expected a String"));
}

#[test]
fn encode_pointer_array_borrowed_container_full_elements_releases_when_call_never_happens() {
    assert_full_element_container_releases_on_drop(ArrayKind::Array, Ownership::Borrowed);
}

#[test]
fn encode_glist_handles_borrowed_container_full_elements_releases_when_call_never_happens() {
    assert_full_element_container_releases_on_drop(ArrayKind::GList, Ownership::Borrowed);
}

#[test]
fn encode_gslist_handles_borrowed_container_full_elements_releases_when_call_never_happens() {
    assert_full_element_container_releases_on_drop(ArrayKind::GSList, Ownership::Borrowed);
}

#[test]
fn encode_gslist_handles_full_ownership_releases_when_call_never_happens() {
    assert_full_element_container_releases_on_drop(ArrayKind::GSList, Ownership::Full);
}

#[test]
fn encode_glist_handles_fails_and_unwinds_when_element_transfer_fails() {
    helpers::run(|| {
        let pspec = helpers::make_bool_param_spec();
        let before = helpers::param_spec_refcount(pspec);

        let descriptor = array_codec(
            unresolvable_fundamental_item_codec(),
            ArrayKind::GList,
            Ownership::Full,
        );
        let val = Value::Array(vec![Value::Object(Handle::from_glib_borrow(pspec))]);
        let err = descriptor
            .encode(&val)
            .expect_err("an unresolvable element ref function must fail the transfer");
        assert!(err.to_string().contains("Failed to find symbol"));
        assert_eq!(helpers::param_spec_refcount(pspec), before);

        unsafe { glib::gobject_ffi::g_param_spec_unref(pspec.cast()) };
    });
}

#[test]
fn encode_glist_strings_full_container_full_elements_releases_when_call_never_happens() {
    helpers::run(|| {
        let descriptor = array_codec(
            string_item_codec(Ownership::Full),
            ArrayKind::GList,
            Ownership::Full,
        );
        let val = Value::Array(vec![
            Value::String("a".to_string()),
            Value::String("b".to_string()),
        ]);
        let encoded = descriptor.encode(&val).unwrap();
        let Stash::Storage(storage) = &encoded else {
            panic!("expected storage")
        };
        let StashData::List(data) = storage.data() else {
            panic!("expected string glist storage")
        };
        let ListPayload::Strings { items_duped, .. } = &data.payload else {
            panic!("expected string payload")
        };
        assert!(*items_duped);
        assert!(!data.should_free);
        let first = unsafe {
            std::ffi::CStr::from_ptr((*(data.ptr as *mut glib::ffi::GList)).data as *const c_char)
        };
        assert_eq!(first.to_str().unwrap(), "a");
        drop(encoded);
    });
}

#[test]
fn encode_glist_strings_full_container_borrowed_elements_releases_spine_when_call_never_happens() {
    assert_string_list_full_container_borrowed_elements_releases_spine(ArrayKind::GList);
}

#[test]
fn encode_gslist_strings_full_container_borrowed_elements_releases_spine_when_call_never_happens() {
    assert_string_list_full_container_borrowed_elements_releases_spine(ArrayKind::GSList);
}

#[test]
fn encode_gbytearray_full_ownership_releases_when_call_never_happens() {
    helpers::run(|| {
        let descriptor = array_codec(
            Codec::Integer(IntegerCodec::U8),
            ArrayKind::GByteArray,
            Ownership::Full,
        );
        let val = Value::Array(vec![Value::Number(1.0), Value::Number(2.0)]);
        let encoded = descriptor.encode(&val).unwrap();
        let Stash::Storage(storage) = &encoded else {
            panic!("expected storage")
        };
        assert!(!storage.ptr().is_null());
        assert!(matches!(storage.data(), StashData::GByteArray(None)));
        drop(encoded);
    });
}

#[test]
fn encode_garray_borrowed_strings_installs_clear_func_and_roundtrips() {
    helpers::run(|| {
        let descriptor = array_codec(
            string_item_codec(Ownership::Borrowed),
            ArrayKind::GArray,
            Ownership::Borrowed,
        );
        let val = Value::Array(vec![
            Value::String("hello".to_string()),
            Value::String("world".to_string()),
        ]);
        let encoded = descriptor.encode(&val).unwrap();
        let Value::Array(items) = descriptor.decode(&encoded).unwrap() else {
            panic!("expected array")
        };
        assert!(matches!(items.first(), Some(Value::String(s)) if s == "hello"));
        assert!(matches!(items.get(1), Some(Value::String(s)) if s == "world"));
        drop(encoded);
    });
}

#[test]
fn decode_zero_terminated_scalar_array_full_ownership_frees_buffer() {
    helpers::run(|| {
        let descriptor = array_codec(
            Codec::Integer(IntegerCodec::I32),
            ArrayKind::Array,
            Ownership::Full,
        );
        let buffer = unsafe {
            let mem = glib::ffi::g_malloc0(size_of::<i32>() * 4) as *mut i32;
            *mem = 7;
            *mem.add(1) = 8;
            *mem.add(2) = 9;
            mem
        };
        let Value::Array(items) = descriptor
            .decode(&Stash::Ptr(buffer as *mut c_void))
            .unwrap()
        else {
            panic!("expected array")
        };
        assert_eq!(items.len(), 3);
        assert!(matches!(items[0], Value::Number(n) if n == 7.0));
        assert!(matches!(items[2], Value::Number(n) if n == 9.0));
    });
}

#[test]
fn write_return_to_pointer_full_string_array_hands_caller_owned_container() {
    helpers::run(|| {
        let descriptor = array_codec(
            string_item_codec(Ownership::Full),
            ArrayKind::Array,
            Ownership::Full,
        );
        let val = Value::Array(vec![
            Value::String("alpha".to_string()),
            Value::String("beta".to_string()),
        ]);
        let mut slot: *mut c_void = std::ptr::null_mut();
        let ret = &mut slot as *mut *mut c_void as *mut c_void;
        PtrWriter::write_return_to_ptr(&descriptor, unsafe { Slot::new(ret) }, &Ok(val));
        assert!(!slot.is_null());
        let strv = unsafe { glib::StrV::from_glib_full(slot as *mut *mut c_char) };
        let items: Vec<String> = strv
            .iter()
            .map(|item| unsafe { glib::GStr::from_ptr_lossy(item.as_ptr()) }.to_string())
            .collect();
        assert_eq!(items, vec!["alpha".to_string(), "beta".to_string()]);
    });
}

#[test]
fn write_return_to_pointer_null_err_and_non_array_write_null() {
    let descriptor = array_codec(
        string_item_codec(Ownership::Full),
        ArrayKind::Array,
        Ownership::Full,
    );
    let mut slot: *mut c_void = 7 as *mut c_void;
    let ret = &mut slot as *mut *mut c_void as *mut c_void;
    PtrWriter::write_return_to_ptr(&descriptor, unsafe { Slot::new(ret) }, &Ok(Value::Null));
    assert!(slot.is_null());

    slot = 7 as *mut c_void;
    PtrWriter::write_return_to_ptr(&descriptor, unsafe { Slot::new(ret) }, &Err(()));
    assert!(slot.is_null());

    slot = 7 as *mut c_void;
    PtrWriter::write_return_to_ptr(
        &descriptor,
        unsafe { Slot::new(ret) },
        &Ok(Value::Number(1.0)),
    );
    assert!(slot.is_null());
}

#[test]
fn write_return_to_pointer_encode_error_writes_null() {
    helpers::run(|| {
        let descriptor = array_codec(
            Codec::Integer(IntegerCodec::I32),
            ArrayKind::Array,
            Ownership::Full,
        );
        let val = Value::Array(vec![Value::String("not a number".to_string())]);
        let mut slot: *mut c_void = 7 as *mut c_void;
        let ret = &mut slot as *mut *mut c_void as *mut c_void;
        PtrWriter::write_return_to_ptr(&descriptor, unsafe { Slot::new(ret) }, &Ok(val));
        assert!(slot.is_null());
    });
}

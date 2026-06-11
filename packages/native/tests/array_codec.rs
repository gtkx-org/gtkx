mod common;

use std::ffi::{CString, c_char, c_void};

use gtk4::glib;
use gtk4::prelude::StaticType as _;

use native::NativeHandle;
use native::arg::Arg;
use native::ffi::{FfiStorageKind, FfiValue, GArrayData};
use native::types::{
    ArrayKind, ArrayType, BooleanType, FfiDecoder, FfiEncoder, FloatKind, FundamentalType,
    GObjectType, IntegerKind, Ownership, RawPtrCodec, RefType, StringType, StructType, TaggedKind,
    TaggedType, Type, VoidType,
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

fn gobject_item_type(ownership: Ownership) -> Type {
    Type::GObject(GObjectType { ownership })
}

fn unresolvable_fundamental_item_type() -> Type {
    Type::Fundamental(FundamentalType {
        ownership: Ownership::Full,
        library: "libgobject-2.0.so.0".to_owned(),
        ref_func: "no_such_array_ref_symbol_12345".to_owned(),
        unref_func: "g_param_spec_unref".to_owned(),
        type_name: Some("GParam".to_owned()),
    })
}

fn gobject_refcount(ptr: *mut std::ffi::c_void) -> u32 {
    // SAFETY: The test holds a live reference to the object for the whole
    // read.
    unsafe { (*(ptr as *mut gtk4::glib::gobject_ffi::GObject)).ref_count }
}

fn new_gobject() -> (glib::Object, *mut c_void) {
    let obj = glib::Object::new::<glib::Object>();
    let ptr = glib::translate::ToGlibPtr::<*mut glib::gobject_ffi::GObject>::to_glib_none(&obj).0
        as *mut c_void;
    (obj, ptr)
}

/// Encodes one full-ownership `GObject` element into the given container
/// shape, asserting the encode acquires exactly one reference and that
/// dropping the encoded value without a disarm releases it again.
fn assert_full_element_container_releases_on_drop(kind: ArrayKind, container: Ownership) {
    common::run(|| {
        let (_obj, obj_ptr) = new_gobject();
        let before = gobject_refcount(obj_ptr);

        let ty = array_type(gobject_item_type(Ownership::Full), kind, container);
        let val = Value::Array(vec![Value::Object(NativeHandle::borrowed(obj_ptr))]);
        let encoded = ty.encode(&val, false).unwrap();
        assert_eq!(gobject_refcount(obj_ptr), before + 1);

        drop(encoded);
        assert_eq!(gobject_refcount(obj_ptr), before);
    });
}

/// Encodes one borrowed string element into a transfer-full list container,
/// asserting the storage retains the caller-owned `CString` and arms only the
/// spine for release on drop.
fn assert_string_list_full_container_borrowed_elements_releases_spine(kind: ArrayKind) {
    common::run(|| {
        let ty = array_type(string_item_type(Ownership::Borrowed), kind, Ownership::Full);
        let val = Value::Array(vec![Value::String("kept".to_string())]);
        let encoded = ty.encode(&val, false).unwrap();
        let FfiValue::Storage(storage) = &encoded else {
            panic!("expected storage")
        };
        let (elements_duped, retained) = match storage.kind() {
            FfiStorageKind::StringGList(data) => (data.elements_duped, data.strings.len()),
            FfiStorageKind::StringGSList(data) => (data.elements_duped, data.strings.len()),
            other => panic!("expected string list storage, got {other:?}"),
        };
        assert!(!elements_duped);
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
    common::run(|| {
        let (_obj, obj_ptr) = new_gobject();
        let before = gobject_refcount(obj_ptr);

        let ty = array_type(
            gobject_item_type(Ownership::Full),
            ArrayKind::GList,
            Ownership::Full,
        );
        let val = Value::Array(vec![Value::Object(NativeHandle::borrowed(obj_ptr))]);
        let encoded = ty.encode(&val, false).unwrap();
        encoded.disarm_pending_transfer();

        let FfiValue::Storage(storage) = &encoded else {
            panic!("expected storage")
        };
        let list = storage.ptr() as *mut gtk4::glib::ffi::GList;
        // SAFETY: The disarmed transfer makes this test the callee, owning
        // the spine and the one element reference the encode acquired.
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
    common::run(|| {
        let (_obj, obj_ptr) = new_gobject();
        let before = gobject_refcount(obj_ptr);

        let ty = array_type(
            gobject_item_type(Ownership::Full),
            ArrayKind::GList,
            Ownership::Full,
        );
        let val = Value::Array(vec![
            Value::Object(NativeHandle::borrowed(obj_ptr)),
            Value::Object(NativeHandle::borrowed(std::ptr::null_mut())),
        ]);
        assert!(ty.encode(&val, false).is_err());
        assert_eq!(gobject_refcount(obj_ptr), before);
    });
}

#[test]
fn encode_gslist_strings_full_container_releases_when_call_never_happens() {
    common::run(|| {
        let ty = array_type(
            string_item_type(Ownership::Full),
            ArrayKind::GSList,
            Ownership::Full,
        );
        let val = Value::Array(vec![Value::String("foo".to_string())]);
        let encoded = ty.encode(&val, false).unwrap();
        drop(encoded);
    });
}

#[test]
fn encode_garray_full_ownership_adopted_strings_release_when_call_never_happens() {
    common::run(|| {
        let ty = array_type(
            string_item_type(Ownership::Full),
            ArrayKind::GArray,
            Ownership::Full,
        );
        let val = Value::Array(vec![Value::String("foo".to_string())]);
        let encoded = ty.encode(&val, false).unwrap();
        drop(encoded);
    });
}

#[test]
fn ptr_to_value_sized_reads_explicit_length() {
    let ty = array_type(
        Type::Integer(IntegerKind::I32),
        ArrayKind::Sized { size_index: 1 },
        Ownership::Borrowed,
    );
    let data: Vec<i32> = vec![7, 8, 9];
    // SAFETY: `data` provides exactly three contiguous i32 elements.
    let value =
        unsafe { ty.ptr_to_value_sized(data.as_ptr() as *mut std::ffi::c_void, 3) }.unwrap();
    let Value::Array(items) = value else {
        panic!("expected array")
    };
    assert_eq!(items.len(), 3);
    assert!(matches!(items[0], Value::Number(n) if n == 7.0));

    // SAFETY: A null pointer takes the empty-array short circuit.
    let empty = unsafe { ty.ptr_to_value_sized(std::ptr::null_mut(), 5) }.unwrap();
    assert!(matches!(empty, Value::Array(items) if items.is_empty()));
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
fn encode_string_array_full_ownership_transfers_glib_container() {
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
    encoded.disarm_pending_transfer();
    let FfiValue::Storage(storage) = &encoded else {
        panic!("expected storage")
    };

    let container = storage.ptr() as *mut *mut std::ffi::c_char;
    // SAFETY: The container holds live NUL-terminated duplicates.
    let first = unsafe { std::ffi::CStr::from_ptr(*container) };
    // SAFETY: The container holds live NUL-terminated duplicates.
    let second = unsafe { std::ffi::CStr::from_ptr(*container.add(1)) };
    assert_eq!(first.to_str().unwrap(), "foo");
    assert_eq!(second.to_str().unwrap(), "bar");
    // SAFETY: The container is a live three-slot block ending in NULL.
    assert!(unsafe { (*container.add(2)).is_null() });

    // SAFETY: Frees the NULL-terminated container and strings this test owns.
    unsafe { glib::ffi::g_strfreev(container) };
}

#[test]
fn encode_string_array_full_ownership_releases_when_call_never_happens() {
    let ty = array_type(
        string_item_type(Ownership::Full),
        ArrayKind::Array,
        Ownership::Full,
    );
    let val = Value::Array(vec![Value::String("foo".to_string())]);
    let encoded = ty.encode(&val, false).unwrap();
    drop(encoded);
}

#[test]
fn encode_string_array_borrowed_container_and_elements_roundtrips() {
    let ty = array_type(
        string_item_type(Ownership::Borrowed),
        ArrayKind::Array,
        Ownership::Borrowed,
    );
    let val = Value::Array(vec![Value::String("foo".to_string())]);
    let encoded = ty.encode(&val, false).unwrap();
    let FfiValue::Storage(storage) = &encoded else {
        panic!("expected storage")
    };
    assert!(matches!(storage.kind(), FfiStorageKind::StrV(_)));

    let Value::Array(items) = ty.decode(&encoded).unwrap() else {
        panic!("expected array")
    };
    assert!(matches!(&items[0], Value::String(s) if s == "foo"));
}

#[test]
fn encode_string_array_element_transfer_hands_over_duplicates() {
    let ty = array_type(
        string_item_type(Ownership::Full),
        ArrayKind::Array,
        Ownership::Borrowed,
    );
    let val = Value::Array(vec![Value::String("foo".to_string())]);
    let encoded = ty.encode(&val, false).unwrap();
    encoded.disarm_pending_transfer();
    let FfiValue::Storage(storage) = &encoded else {
        panic!("expected storage")
    };
    let FfiStorageKind::StringArray(retained, ptrs) = storage.kind() else {
        panic!("expected string array storage")
    };
    assert!(retained.is_empty());
    assert_eq!(ptrs.len(), 2);
    assert!(ptrs[1].is_null());

    // SAFETY: The staged element is a live NUL-terminated duplicate.
    let dup = unsafe { std::ffi::CStr::from_ptr(ptrs[0] as *const std::ffi::c_char) };
    assert_eq!(dup.to_str().unwrap(), "foo");
    // SAFETY: Frees the duplicate this test owns.
    unsafe { glib::ffi::g_free(ptrs[0]) };
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
fn encode_pointer_array_full_ownership_transfers_glib_container() {
    let ty = array_type(struct_item_type(), ArrayKind::Array, Ownership::Full);
    let val = Value::Array(vec![Value::Object(boxed_handle())]);
    let encoded = ty.encode(&val, false).unwrap();
    encoded.disarm_pending_transfer();
    let FfiValue::Storage(storage) = &encoded else {
        panic!("expected storage")
    };
    let FfiStorageKind::ObjectArray(handles, ptrs) = storage.kind() else {
        panic!("expected object array storage")
    };
    assert_eq!(handles.len(), 1);
    assert!(ptrs.is_empty());

    let container = storage.ptr() as *mut *mut std::ffi::c_void;
    // SAFETY: The container is a live two-slot block ending in NULL.
    assert!(!unsafe { *container }.is_null());
    // SAFETY: The container is a live two-slot block ending in NULL.
    assert!(unsafe { *container.add(1) }.is_null());

    // SAFETY: Frees the container this test owns.
    unsafe { glib::ffi::g_free(container as *mut std::ffi::c_void) };
}

#[test]
fn encode_pointer_array_null_terminated_with_handles() {
    let ty = array_type(struct_item_type(), ArrayKind::Array, Ownership::Borrowed);
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
    let ty = array_type(struct_item_type(), ArrayKind::Array, Ownership::Borrowed);
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
fn encode_garray_element_size_mismatch_fails() {
    common::run(|| {
        let mut ty = array_type(
            Type::Integer(IntegerKind::I32),
            ArrayKind::GArray,
            Ownership::Borrowed,
        );
        ty.element_size = Some(64);
        let err = ty
            .encode(&Value::Array(vec![Value::Number(1.0)]), false)
            .expect_err("an element size mismatching the item layout must fail");
        assert!(err.to_string().contains("does not match"));
    });
}

#[test]
fn decode_zero_terminated_scalar_array_reads_with_scalar_stride() {
    common::run(|| {
        let ty = array_type(
            Type::Integer(IntegerKind::I32),
            ArrayKind::Array,
            Ownership::Borrowed,
        );
        let buffer: [i32; 4] = [7, 8, 9, 0];
        let decoded = ty
            .decode(&FfiValue::Ptr(buffer.as_ptr() as *mut std::ffi::c_void))
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
fn decode_gptrarray_frees_container_when_element_decode_fails() {
    common::run(|| {
        // SAFETY: Creating an empty GPtrArray has no pointer preconditions.
        let ptr_array = unsafe { glib::ffi::g_ptr_array_new() };
        // SAFETY: `ptr_array` is the live array created above.
        unsafe { glib::ffi::g_ptr_array_add(ptr_array, std::ptr::without_provenance_mut(0x4)) };
        // SAFETY: `ptr_array` is the live array created above; the extra reference balances the decode's release.
        unsafe { glib::ffi::g_ptr_array_ref(ptr_array) };

        let ty = array_type(
            Type::Integer(IntegerKind::I32),
            ArrayKind::GPtrArray,
            Ownership::Full,
        );
        assert!(
            ty.decode(&FfiValue::Ptr(ptr_array as *mut std::ffi::c_void))
                .is_err()
        );

        // SAFETY: Releases the reference this test owns on the live GPtrArray.
        unsafe { glib::ffi::g_ptr_array_unref(ptr_array) };
    });
}

#[test]
fn decode_glist_frees_spine_when_element_decode_fails() {
    common::run(|| {
        // SAFETY: Appending to a (possibly null) GList head only requires a valid element pointer.
        let list = unsafe {
            glib::ffi::g_list_append(std::ptr::null_mut(), std::ptr::without_provenance_mut(0x4))
        };

        let ty = array_type(
            Type::Integer(IntegerKind::I32),
            ArrayKind::GList,
            Ownership::Full,
        );
        assert!(
            ty.decode(&FfiValue::Ptr(list as *mut std::ffi::c_void))
                .is_err()
        );
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
        // SAFETY: g_malloc0 aborts on failure, so the slots are writable; each element is a fresh GLib duplicate.
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
        // SAFETY: g_malloc0 aborts on failure, so the slots are writable; the element is a static literal the decode only borrows.
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
        // SAFETY: g_malloc0 aborts on failure, so the slots are writable; the element is a live boxed pointer.
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

        // SAFETY: Appending to a (possibly null) GList head only requires a valid element pointer.
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
        // SAFETY: Appending to a (possibly null) GSList head only requires a valid element pointer.
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
        // SAFETY: Creating a GArray from size parameters has no pointer preconditions.
        let g_array = unsafe { glib::ffi::g_array_sized_new(0, 0, size_of::<i32>() as u32, 0) };
        let value: i32 = 42;
        // SAFETY: `g_array` is the live array created above, and `value` is one element of its declared width.
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
        // SAFETY: Creating a GArray from size parameters has no pointer preconditions.
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
        // SAFETY: Creating an empty GPtrArray has no pointer preconditions.
        let ptr_array = unsafe { glib::ffi::g_ptr_array_new() };
        // SAFETY: `ptr_array` is the live array created above.
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
        // SAFETY: Building a fresh GByteArray from a live local byte buffer has no other preconditions.
        let ba = unsafe {
            let ba = glib::ffi::g_byte_array_sized_new(3);
            glib::ffi::g_byte_array_append(ba, bytes.as_ptr(), 3);
            ba
        };
        let Value::Array(items) = ty.decode(&FfiValue::Ptr(ba as *mut c_void)).unwrap() else {
            panic!("expected array")
        };
        assert_eq!(items.len(), 3);
        // SAFETY: Releases the reference this test owns on the live GByteArray.
        unsafe { glib::ffi::g_byte_array_unref(ba) };

        // SAFETY: Creating an empty GByteArray has no pointer preconditions.
        let empty = unsafe { glib::ffi::g_byte_array_new() };
        let Value::Array(items) = ty.decode(&FfiValue::Ptr(empty as *mut c_void)).unwrap() else {
            panic!("expected array")
        };
        assert!(items.is_empty());
        // SAFETY: Releases the reference this test owns on the live GByteArray.
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
        // SAFETY: Building a fresh GByteArray from a live local byte buffer has no other preconditions.
        let ba = unsafe {
            let ba = glib::ffi::g_byte_array_sized_new(2);
            glib::ffi::g_byte_array_append(ba, bytes.as_ptr(), 2);
            glib::ffi::g_byte_array_ref(ba)
        };
        let Value::Array(items) = ty.decode(&FfiValue::Ptr(ba as *mut c_void)).unwrap() else {
            panic!("expected array")
        };
        assert_eq!(items.len(), 2);
        // SAFETY: Releases the reference this test owns on the live GByteArray.
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
    // SAFETY: Null short-circuits before any read.
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
        // SAFETY: Creating an empty GPtrArray has no pointer preconditions.
        let ptr_array = unsafe { glib::ffi::g_ptr_array_new() };
        // SAFETY: `ptr_array` is the live array created above.
        unsafe { glib::ffi::g_ptr_array_add(ptr_array, boxed_handle().ptr()) };
        // SAFETY: `ptr_array` is the live GPtrArray built above.
        let value = unsafe { ty.ptr_to_value(ptr_array as *mut c_void) }.unwrap();
        assert!(matches!(value, Value::Array(items) if items.len() == 1));
        // SAFETY: Releases the reference this test owns on the live GPtrArray.
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
        // SAFETY: Building a fresh GByteArray from a live local byte buffer has no other preconditions.
        let ba = unsafe {
            let ba = glib::ffi::g_byte_array_sized_new(1);
            glib::ffi::g_byte_array_append(ba, bytes.as_ptr(), 1);
            ba
        };
        // SAFETY: `ba` is the live GByteArray built above.
        let value = unsafe { ty.ptr_to_value(ba as *mut c_void) }.unwrap();
        assert!(matches!(value, Value::Array(items) if items.len() == 1));
        // SAFETY: Releases the reference this test owns on the live GByteArray.
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
        // SAFETY: Creating a GArray from size parameters has no pointer preconditions.
        let g_array = unsafe { glib::ffi::g_array_sized_new(0, 0, size_of::<i32>() as u32, 0) };
        let value: i32 = 1;
        // SAFETY: `g_array` is the live array created above, and `value` is one element of its declared width.
        unsafe {
            glib::ffi::g_array_append_vals(g_array, &value as *const i32 as *const c_void, 1)
        };
        // SAFETY: `g_array` is the live GArray built above.
        let decoded = unsafe { ty.ptr_to_value(g_array as *mut c_void) }.unwrap();
        assert!(matches!(decoded, Value::Array(items) if items.len() == 1));
        // SAFETY: Releases the reference this test owns on the live GArray.
        unsafe { glib::ffi::g_array_unref(g_array) };
    });
}

#[test]
fn ptr_to_value_glist() {
    common::run(|| {
        let ty = array_type(struct_item_type(), ArrayKind::GList, Ownership::Borrowed);
        // SAFETY: Appending to a (possibly null) GList head only requires a valid element pointer.
        let list = unsafe { glib::ffi::g_list_append(std::ptr::null_mut(), boxed_handle().ptr()) };
        // SAFETY: `list` is the live GList built above.
        let decoded = unsafe { ty.ptr_to_value(list as *mut c_void) }.unwrap();
        assert!(matches!(decoded, Value::Array(items) if items.len() == 1));
        // SAFETY: Frees the list this test owns.
        unsafe { glib::ffi::g_list_free(list) };
    });
}

#[test]
fn ptr_to_value_plain_array() {
    common::run(|| {
        let ty = array_type(struct_item_type(), ArrayKind::Array, Ownership::Borrowed);
        let h0 = boxed_handle();
        let mut data: Vec<*mut c_void> = vec![h0.ptr(), std::ptr::null_mut()];
        // SAFETY: `data` is a live null-terminated local array of boxed pointers.
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
        // SAFETY: `data` is a live null-terminated local array of boxed
        // pointers.
        let from_ptr =
            unsafe { RawPtrCodec::ptr_to_value(&ptr_ty, data.as_mut_ptr() as *mut c_void, "ctx") }
                .unwrap();
        assert!(matches!(from_ptr, Value::Array(items) if items.len() == 1));
    });
}

#[test]
fn encode_string_array_dup_elements_failure_frees_earlier_duplicates() {
    let ty = array_type(
        string_item_type(Ownership::Full),
        ArrayKind::Array,
        Ownership::Borrowed,
    );
    let val = Value::Array(vec![Value::String("first".to_string()), Value::Number(2.0)]);
    let err = ty
        .encode(&val, false)
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
    common::run(|| {
        // SAFETY: Creating a GParamSpec from static NUL-terminated literals
        // has no pointer preconditions.
        let pspec = unsafe {
            glib::gobject_ffi::g_param_spec_boolean(
                c"array-codec-cov".as_ptr(),
                c"Cov".as_ptr(),
                c"A coverage parameter".as_ptr(),
                glib::ffi::GFALSE,
                glib::gobject_ffi::G_PARAM_READABLE,
            ) as *mut c_void
        };
        let before = common::param_spec_refcount(pspec);

        let ty = array_type(
            unresolvable_fundamental_item_type(),
            ArrayKind::GList,
            Ownership::Full,
        );
        let val = Value::Array(vec![Value::Object(NativeHandle::borrowed(pspec))]);
        let err = ty
            .encode(&val, false)
            .expect_err("an unresolvable element ref function must fail the transfer");
        assert!(err.to_string().contains("Failed to find ref symbol"));
        assert_eq!(common::param_spec_refcount(pspec), before);

        // SAFETY: Releases the reference this test owns on the live
        // GParamSpec.
        unsafe { glib::gobject_ffi::g_param_spec_unref(pspec.cast()) };
    });
}

#[test]
fn encode_glist_strings_full_container_full_elements_releases_when_call_never_happens() {
    common::run(|| {
        let ty = array_type(
            string_item_type(Ownership::Full),
            ArrayKind::GList,
            Ownership::Full,
        );
        let val = Value::Array(vec![
            Value::String("a".to_string()),
            Value::String("b".to_string()),
        ]);
        let encoded = ty.encode(&val, false).unwrap();
        let FfiValue::Storage(storage) = &encoded else {
            panic!("expected storage")
        };
        let FfiStorageKind::StringGList(data) = storage.kind() else {
            panic!("expected string glist storage")
        };
        assert!(data.elements_duped);
        assert!(!data.should_free);
        // SAFETY: The encoded list head is a live node whose data pointer is
        // a live NUL-terminated duplicate.
        let first = unsafe { std::ffi::CStr::from_ptr((*data.list_ptr).data as *const c_char) };
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
fn encode_string_array_borrowed_rejects_interior_nul() {
    common::run(|| {
        let ty = array_type(
            string_item_type(Ownership::Borrowed),
            ArrayKind::Array,
            Ownership::Borrowed,
        );
        let val = Value::Array(vec![Value::String("a\0b".to_string())]);
        let err = ty
            .encode(&val, false)
            .expect_err("interior NUL should fail to encode");
        assert!(err.to_string().contains("interior NUL"));
    });
}

#[test]
fn encode_string_array_full_container_borrowed_elements_rejects_non_string() {
    let ty = array_type(
        string_item_type(Ownership::Borrowed),
        ArrayKind::Array,
        Ownership::Full,
    );
    let err = ty
        .encode(&Value::Array(vec![Value::Number(1.0)]), false)
        .expect_err("a non-string element must fail extraction");
    assert!(err.to_string().contains("Expected a String"));
}

#[test]
fn encode_gbytearray_full_ownership_releases_when_call_never_happens() {
    common::run(|| {
        let ty = array_type(
            Type::Integer(IntegerKind::U8),
            ArrayKind::GByteArray,
            Ownership::Full,
        );
        let val = Value::Array(vec![Value::Number(1.0), Value::Number(2.0)]);
        let encoded = ty.encode(&val, false).unwrap();
        let FfiValue::Storage(storage) = &encoded else {
            panic!("expected storage")
        };
        assert!(!storage.ptr().is_null());
        assert!(matches!(storage.kind(), FfiStorageKind::GByteArray(None)));
        drop(encoded);
    });
}

/// Borrowed string elements install a slot-dereferencing clear function, so
/// the storage drop releases both the duplicated strings and the spine.
#[test]
fn encode_garray_borrowed_strings_installs_clear_func_and_roundtrips() {
    common::run(|| {
        let ty = array_type(
            string_item_type(Ownership::Borrowed),
            ArrayKind::GArray,
            Ownership::Borrowed,
        );
        let val = Value::Array(vec![
            Value::String("hello".to_string()),
            Value::String("world".to_string()),
        ]);
        let encoded = ty.encode(&val, false).unwrap();
        let Value::Array(items) = ty.decode(&encoded).unwrap() else {
            panic!("expected array")
        };
        assert!(matches!(items.first(), Some(Value::String(s)) if s == "hello"));
        assert!(matches!(items.get(1), Some(Value::String(s)) if s == "world"));
        drop(encoded);
    });
}

#[test]
fn decode_zero_terminated_scalar_array_full_ownership_frees_buffer() {
    common::run(|| {
        let ty = array_type(
            Type::Integer(IntegerKind::I32),
            ArrayKind::Array,
            Ownership::Full,
        );
        // SAFETY: g_malloc0 aborts on failure, so the four i32 slots are
        // writable; the final slot stays zero as the terminator.
        let buffer = unsafe {
            let mem = glib::ffi::g_malloc0(size_of::<i32>() * 4) as *mut i32;
            *mem = 7;
            *mem.add(1) = 8;
            *mem.add(2) = 9;
            mem
        };
        let Value::Array(items) = ty.decode(&FfiValue::Ptr(buffer as *mut c_void)).unwrap() else {
            panic!("expected array")
        };
        assert_eq!(items.len(), 3);
        assert!(matches!(items[0], Value::Number(n) if n == 7.0));
        assert!(matches!(items[2], Value::Number(n) if n == 9.0));
    });
}

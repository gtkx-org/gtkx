mod common;

use std::ffi::c_void;

use gtk4::gdk;
use gtk4::glib;
use gtk4::glib::translate::IntoGlib as _;
use gtk4::prelude::ObjectType as _;
use gtk4::prelude::StaticType as _;

use native::ffi;
use native::types::{
    ArrayKind, ArrayType, BoxedType, FfiDecoder, GObjectType, Ownership, StringType, Type,
};
use native::value::Value;

use common::get_gobject_refcount;

fn gobject_type_of(ownership: Ownership) -> Type {
    Type::GObject(GObjectType { ownership })
}

fn string_type_of(ownership: Ownership) -> Type {
    Type::String(StringType {
        ownership,
        length: None,
    })
}

fn rgba_boxed_type_of(ownership: Ownership) -> Type {
    Type::Boxed(BoxedType {
        ownership,
        type_name: "GdkRGBA".to_string(),
        library: None,
        get_type_fn: None,
        free_fn: None,
    })
}

fn gvariant_fundamental_type_of(ownership: Ownership) -> Type {
    Type::Fundamental(native::types::FundamentalType {
        ownership,
        library: "libglib-2.0.so.0".to_string(),
        ref_func: "g_variant_ref_sink".to_string(),
        unref_func: "g_variant_unref".to_string(),
        type_name: Some("GVariant".to_string()),
    })
}

fn struct_type_of(ownership: Ownership, size: Option<usize>) -> Type {
    Type::Struct(native::types::StructType { ownership, size })
}

fn gobject_glist_type_of(container: Ownership) -> Type {
    Type::Array(ArrayType {
        item_type: Box::new(gobject_type_of(Ownership::Borrowed)),
        kind: ArrayKind::GList,
        ownership: container,
        element_size: None,
    })
}

fn string_array_type_of(item: Ownership, container: Ownership, kind: ArrayKind) -> Type {
    Type::Array(ArrayType {
        item_type: Box::new(string_type_of(item)),
        kind,
        ownership: container,
        element_size: None,
    })
}

/// Decodes `ptr` with `ty`, asserting the decode succeeds.
fn decode_ptr(ty: &Type, ptr: *mut c_void) -> Value {
    ty.decode(&ffi::FfiValue::Ptr(ptr))
        .expect("decode should succeed")
}

fn assert_null_ptr_decodes_to_null(ty: &Type) {
    assert!(matches!(decode_ptr(ty, std::ptr::null_mut()), Value::Null));
}

fn assert_ptr_decodes_to_string(ty: &Type, ptr: *mut c_void, expected: &str) {
    let Value::String(s) = decode_ptr(ty, ptr) else {
        panic!("Expected Value::String");
    };
    assert_eq!(s, expected);
}

fn decode_array(ty: &Type, ptr: *mut c_void) -> Vec<Value> {
    let Value::Array(items) = decode_ptr(ty, ptr) else {
        panic!("Expected Value::Array");
    };
    items
}

fn assert_string_item(items: &[Value], index: usize, expected: &str) {
    if let Some(Value::String(s)) = items.get(index) {
        assert_eq!(s, expected);
    }
}

/// Builds a `GList` of `count` fresh `GObjects`, taking one extra reference
/// per element that the caller balances.
fn build_gobject_glist(count: usize) -> *mut glib::ffi::GList {
    let mut list: *mut glib::ffi::GList = std::ptr::null_mut();
    for _ in 0..count {
        let obj = glib::Object::new::<glib::Object>();
        // SAFETY: Takes a reference on the live GObject; the caller balances it.
        unsafe {
            glib::gobject_ffi::g_object_ref(obj.as_ptr());
        }
        // SAFETY: Appending to a (possibly null) GList head only requires a valid element pointer.
        list = unsafe { glib::ffi::g_list_append(list, obj.as_ptr() as *mut c_void) };
    }
    list
}

/// Builds the scalar out-parameter slot a `Ref` scalar encode produces: an
/// aligned `u64`-backed storage seeded with the scalar payload of `value`.
fn scalar_slot_storage(value: &ffi::FfiValue) -> ffi::FfiValue {
    let storage = ffi::FfiStorage::from(vec![0u64]);
    // SAFETY: The storage is a live, aligned 8-byte slot.
    unsafe { value.write_scalar_to(storage.ptr()) }.expect("scalar payload should write");
    ffi::FfiValue::Storage(storage)
}

/// Decodes a seeded scalar out slot through `Ref<inner>`, asserting the
/// decoded number equals `expected`.
fn assert_scalar_ref_decodes_to_number(inner: Type, seeded: &ffi::FfiValue, expected: f64) {
    let cif_value = scalar_slot_storage(seeded);
    let type_ = Type::Ref(native::types::RefType::new(inner));
    let Value::Number(n) = type_.decode(&cif_value).expect("Ref decode failed") else {
        panic!("Expected Value::Number");
    };
    assert_eq!(n, expected);
}

/// Builds the pointer out-parameter slot a `Ref` pointer encode produces,
/// seeded with `ptr` as the value the callee wrote.
fn ptr_slot_storage(ptr: *mut c_void) -> ffi::FfiValue {
    let mut slot: Vec<*mut c_void> = vec![ptr];
    let storage_ptr = slot.as_mut_ptr() as *mut c_void;
    ffi::FfiValue::Storage(ffi::FfiStorage::new(
        storage_ptr,
        ffi::FfiStorageKind::PtrStorage(slot),
    ))
}

/// Decodes a `g_malloc0`'d allocation of `bytes` through a plain struct type,
/// asserting an object handle results. Borrowed decodes leave the allocation
/// caller-owned, so the helper frees it; full decodes hand it to the handle.
fn assert_struct_alloc_decodes_to_object(ownership: Ownership, size: Option<usize>, bytes: usize) {
    // SAFETY: Allocating zeroed memory has no pointer preconditions.
    let struct_ptr = unsafe { glib::ffi::g_malloc0(bytes) };

    let result = decode_ptr(&struct_type_of(ownership, size), struct_ptr);
    assert!(
        matches!(result, Value::Object(_)),
        "Expected Value::Object for struct"
    );

    if ownership.is_borrowed() {
        // SAFETY: Frees the allocation this test owns.
        unsafe { glib::ffi::g_free(struct_ptr) };
    }
}

/// Asserts an accessor-style predicate holds for every sample value.
fn assert_for_each(samples: Vec<Value>, predicate: impl Fn(&Value) -> bool) {
    for sample in samples {
        assert!(predicate(&sample), "predicate failed for {sample:?}");
    }
}

#[test]
fn gobject_transfer_none_does_not_take_ownership() {
    common::run(|| {
        let obj = glib::Object::new::<glib::Object>();
        let obj_ptr = obj.as_ptr();

        let initial_ref = get_gobject_refcount(obj_ptr);

        let result = decode_ptr(
            &gobject_type_of(Ownership::Borrowed),
            obj_ptr as *mut c_void,
        );

        assert_eq!(get_gobject_refcount(obj_ptr), initial_ref + 1);

        // The handle is a non-owning pointer carrier; dropping it releases nothing.
        // The pending reference is consumed by `setWrapper` in production.
        drop(result);
        assert_eq!(get_gobject_refcount(obj_ptr), initial_ref + 1);

        // SAFETY: Releases a reference this test owns on the live GObject.
        unsafe { glib::gobject_ffi::g_object_unref(obj_ptr) };
        assert_eq!(get_gobject_refcount(obj_ptr), initial_ref);
    });
}

#[test]
fn gobject_full_transfer_keeps_pending_reference() {
    common::run(|| {
        let obj = glib::Object::new::<glib::Object>();
        let obj_ptr = obj.as_ptr();

        // SAFETY: Takes a reference on the live GObject; this test balances it itself.
        unsafe {
            glib::gobject_ffi::g_object_ref(obj_ptr);
        }

        let ref_before_transfer = get_gobject_refcount(obj_ptr);

        let result = decode_ptr(&gobject_type_of(Ownership::Full), obj_ptr as *mut c_void);

        // Transfer-full keeps the caller's reference as the single pending ref.
        assert_eq!(get_gobject_refcount(obj_ptr), ref_before_transfer);

        // The non-owning handle releases nothing on drop; `setWrapper` consumes
        // the pending reference in production.
        drop(result);
        assert_eq!(get_gobject_refcount(obj_ptr), ref_before_transfer);

        // SAFETY: Releases a reference this test owns on the live GObject.
        unsafe { glib::gobject_ffi::g_object_unref(obj_ptr) };
        assert_eq!(get_gobject_refcount(obj_ptr), ref_before_transfer - 1);
    });
}

#[test]
fn gobject_null_returns_null_value() {
    common::run(|| {
        assert_null_ptr_decodes_to_null(&gobject_type_of(Ownership::Full));
    });
}

#[test]
fn gobject_floating_ref_gets_sunk() {
    common::run(|| {
        let obj = glib::Object::new::<glib::Object>();
        let obj_ptr = obj.as_ptr();

        // SAFETY: `obj_ptr` is a live GObject this test owns; the forced floating state is consumed by the decode.
        unsafe {
            glib::gobject_ffi::g_object_ref(obj_ptr);
            glib::gobject_ffi::g_object_force_floating(obj_ptr);
        }

        // SAFETY: `obj_ptr` is a live GObject.
        let is_floating_before = unsafe { glib::gobject_ffi::g_object_is_floating(obj_ptr) != 0 };
        assert!(is_floating_before);

        decode_ptr(&gobject_type_of(Ownership::Full), obj_ptr as *mut c_void);

        // SAFETY: `obj_ptr` is a live GObject.
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

        assert_ptr_decodes_to_string(&string_type_of(Ownership::Borrowed), ptr, test_string);

        // SAFETY: `c_string` is a live NUL-terminated local.
        let still_valid = unsafe { std::ffi::CStr::from_ptr(c_string.as_ptr()) };
        assert_eq!(still_valid.to_str().unwrap(), test_string);
    });
}

#[test]
fn string_full_transfer_frees_memory() {
    common::run(|| {
        let test_string = "allocated string";
        let c_string = std::ffi::CString::new(test_string).unwrap();
        // SAFETY: Duplicating a live NUL-terminated local has no other preconditions.
        let allocated_ptr = unsafe { glib::ffi::g_strdup(c_string.as_ptr()) };

        assert_ptr_decodes_to_string(
            &string_type_of(Ownership::Full),
            allocated_ptr as *mut c_void,
            test_string,
        );
    });
}

#[test]
fn string_null_returns_null_value() {
    common::run(|| {
        assert_null_ptr_decodes_to_null(&string_type_of(Ownership::Full));
    });
}

#[test]
fn boxed_transfer_none_creates_copy() {
    common::run(|| {
        let gtype = gdk::RGBA::static_type();
        let original_ptr = common::allocate_test_boxed(gtype);

        decode_ptr(&rgba_boxed_type_of(Ownership::Borrowed), original_ptr);

        assert!(common::is_valid_boxed_ptr(original_ptr, gtype));

        // SAFETY: Frees the boxed allocation this test owns.
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

        decode_ptr(&rgba_boxed_type_of(Ownership::Full), ptr);
    });
}

#[test]
fn boxed_null_returns_null_value() {
    common::run(|| {
        assert_null_ptr_decodes_to_null(&rgba_boxed_type_of(Ownership::Full));
    });
}

#[test]
fn glist_transfer_none_does_not_free_list() {
    common::run(|| {
        let list = build_gobject_glist(3);

        let items = decode_array(
            &gobject_glist_type_of(Ownership::Borrowed),
            list as *mut c_void,
        );
        assert_eq!(items.len(), 3);

        assert!(!list.is_null());

        // SAFETY: `list` is a live GList built by this test.
        let length = unsafe { glib::ffi::g_list_length(list) };
        for index in 0..length {
            // SAFETY: `list` is a live GList built by this test.
            let data = unsafe { glib::ffi::g_list_nth_data(list, index) };
            if !data.is_null() {
                // SAFETY: Releases the reference this test took for the list element.
                unsafe {
                    glib::gobject_ffi::g_object_unref(data as *mut glib::gobject_ffi::GObject);
                }
            }
        }
        // SAFETY: Frees the list this test owns.
        unsafe {
            glib::ffi::g_list_free(list);
        }
    });
}

#[test]
fn glist_full_transfer_frees_list() {
    common::run(|| {
        let list = build_gobject_glist(3);

        let items = decode_array(&gobject_glist_type_of(Ownership::Full), list as *mut c_void);
        assert_eq!(items.len(), 3);
    });
}

#[test]
fn glist_null_returns_empty_array() {
    common::run(|| {
        let items = decode_array(
            &gobject_glist_type_of(Ownership::Full),
            std::ptr::null_mut(),
        );
        assert!(items.is_empty());
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

        let items = decode_array(
            &string_array_type_of(Ownership::Borrowed, Ownership::Borrowed, ArrayKind::Array),
            ptrs.as_ptr() as *mut c_void,
        );
        assert_eq!(items.len(), 2);
        assert_string_item(&items, 0, "hello");
        assert_string_item(&items, 1, "world");

        assert_eq!(
            // SAFETY: The decoded StrV elements are live NUL-terminated strings.
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
        // SAFETY: Duplicating a static NUL-terminated literal has no pointer preconditions.
        let s1 = unsafe { glib::ffi::g_strdup(c"hello".as_ptr()) };
        // SAFETY: Duplicating a static NUL-terminated literal has no pointer preconditions.
        let s2 = unsafe { glib::ffi::g_strdup(c"world".as_ptr()) };

        // SAFETY: g_malloc aborts on failure, so the three-slot buffer is writable; `s1` and `s2` are live duplicates.
        let strv = unsafe {
            let ptr = glib::ffi::g_malloc(3 * std::mem::size_of::<*mut i8>()) as *mut *mut i8;
            *ptr = s1;
            *ptr.add(1) = s2;
            *ptr.add(2) = std::ptr::null_mut();
            ptr
        };

        let items = decode_array(
            &string_array_type_of(Ownership::Full, Ownership::Full, ArrayKind::Array),
            strv as *mut c_void,
        );
        assert_eq!(items.len(), 2);
    });
}

#[test]
fn from_cif_value_fundamental_gvariant_transfer_none() {
    common::run(|| {
        // SAFETY: Creating and sinking a fresh GVariant has no pointer preconditions.
        let variant = unsafe {
            let ptr = glib::ffi::g_variant_new_int32(42);
            glib::ffi::g_variant_ref_sink(ptr);
            ptr
        };

        let result = decode_ptr(
            &gvariant_fundamental_type_of(Ownership::Borrowed),
            variant as *mut c_void,
        );
        assert!(matches!(result, Value::Object(_)), "Expected Value::Object");

        // SAFETY: Releases the reference this test owns on the live GVariant.
        unsafe {
            glib::ffi::g_variant_unref(variant);
        }
    });
}

#[test]
fn from_cif_value_fundamental_null() {
    common::run(|| {
        assert_null_ptr_decodes_to_null(&gvariant_fundamental_type_of(Ownership::Full));
    });
}

#[test]
fn from_cif_value_ref_integer() {
    common::run(|| {
        assert_scalar_ref_decodes_to_number(
            Type::Integer(native::types::IntegerKind::I32),
            &ffi::FfiValue::I32(12345),
            12345.0,
        );
    });
}

#[test]
fn from_cif_value_ref_float() {
    common::run(|| {
        assert_scalar_ref_decodes_to_number(
            Type::Float(native::types::FloatKind::F64),
            &ffi::FfiValue::F64(3.15625),
            3.15625,
        );
    });
}

#[test]
fn from_cif_value_ref_gobject() {
    common::run(|| {
        let obj = glib::Object::new::<glib::Object>();
        let obj_ptr = obj.as_ptr() as *mut c_void;

        let cif_value = ptr_slot_storage(obj_ptr);
        let type_ = Type::Ref(native::types::RefType::new(gobject_type_of(
            Ownership::Borrowed,
        )));

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
        let cif_value = ptr_slot_storage(std::ptr::null_mut());
        let type_ = Type::Ref(native::types::RefType::new(gobject_type_of(
            Ownership::Borrowed,
        )));

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

        let cif_value = ptr_slot_storage(boxed_ptr);
        let type_ = Type::Ref(native::types::RefType::new(rgba_boxed_type_of(
            Ownership::Borrowed,
        )));

        let result = type_.decode(&cif_value).expect("Ref<Boxed> decode failed");
        assert!(matches!(result, Value::Object(_)));

        // SAFETY: Frees the boxed allocation this test owns.
        unsafe {
            glib::gobject_ffi::g_boxed_free(gtype.into_glib(), boxed_ptr);
        }
    });
}

#[test]
fn glist_with_string_items() {
    common::run(|| {
        let s1 = std::ffi::CString::new("hello").unwrap();
        let s2 = std::ffi::CString::new("world").unwrap();

        let mut list: *mut glib::ffi::GList = std::ptr::null_mut();
        // SAFETY: Appending to a (possibly null) GList head only requires a valid element pointer.
        list = unsafe { glib::ffi::g_list_append(list, s1.as_ptr() as *mut c_void) };
        // SAFETY: Appending to a (possibly null) GList head only requires a valid element pointer.
        list = unsafe { glib::ffi::g_list_append(list, s2.as_ptr() as *mut c_void) };

        let items = decode_array(
            &string_array_type_of(Ownership::Borrowed, Ownership::Borrowed, ArrayKind::GList),
            list as *mut c_void,
        );
        assert_eq!(items.len(), 2);
        assert_string_item(&items, 0, "hello");
        assert_string_item(&items, 1, "world");

        // SAFETY: Frees the list this test owns.
        unsafe {
            glib::ffi::g_list_free(list);
        }
    });
}

#[test]
fn from_cif_value_struct_transfer_none_logs_warning() {
    common::run(|| {
        assert_struct_alloc_decodes_to_object(Ownership::Borrowed, Some(16), 16);
    });
}

#[test]
fn from_cif_value_struct_full_transfer() {
    common::run(|| {
        assert_struct_alloc_decodes_to_object(Ownership::Full, Some(32), 32);
    });
}

#[test]
fn from_cif_value_struct_null_returns_null_value() {
    common::run(|| {
        assert_null_ptr_decodes_to_null(&struct_type_of(Ownership::Borrowed, Some(16)));
    });
}

#[test]
fn from_cif_value_struct_transfer_none_without_size_creates_unowned() {
    common::run(|| {
        assert_struct_alloc_decodes_to_object(Ownership::Borrowed, None, 24);
    });
}

#[test]
fn from_cif_value_struct_owned_without_size() {
    common::run(|| {
        assert_struct_alloc_decodes_to_object(Ownership::Full, None, 24);
    });
}

#[test]
fn result_to_ptr_returns_handle_pointer_for_object() {
    common::run(|| {
        let obj = glib::Object::new::<glib::Object>();
        let obj_ptr = obj.as_ptr() as *mut c_void;
        let handle = native::NativeHandle::borrowed_gobject(obj.as_ptr() as *mut c_void);

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
    assert_for_each(
        vec![
            Value::String("x".to_string()),
            Value::Boolean(true),
            Value::Null,
            Value::Undefined,
        ],
        |v| v.as_number().is_none(),
    );
}

#[test]
fn as_string_extracts_string_payload() {
    assert_eq!(Value::String("x".to_string()).as_string(), Some("x"));
}

#[test]
fn as_string_is_none_for_other_variants() {
    assert_for_each(
        vec![
            Value::Number(3.5),
            Value::Boolean(true),
            Value::Null,
            Value::Undefined,
        ],
        |v| v.as_string().is_none(),
    );
}

#[test]
fn as_array_extracts_array_elements() {
    let value = Value::Array(vec![Value::Number(1.0), Value::Number(2.0)]);
    let items = value
        .as_array()
        .expect("array variant should yield its elements");
    assert_eq!(items.len(), 2);
    assert_eq!(items[0].as_number(), Some(1.0));
    assert_eq!(items[1].as_number(), Some(2.0));
}

#[test]
fn as_array_is_none_for_other_variants() {
    assert_for_each(
        vec![
            Value::Number(3.5),
            Value::String("x".to_string()),
            Value::Boolean(true),
            Value::Null,
            Value::Undefined,
        ],
        |v| v.as_array().is_none(),
    );
}

#[test]
fn object_ptr_returns_handle_pointer() {
    common::run(|| {
        let obj = glib::Object::new::<glib::Object>();
        let obj_ptr = obj.as_ptr() as *mut c_void;
        let handle = native::NativeHandle::borrowed_gobject(obj.as_ptr() as *mut c_void);

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
    assert_for_each(
        vec![
            Value::Number(1.0),
            Value::String("s".to_string()),
            Value::Boolean(false),
            Value::Array(vec![]),
        ],
        |v| v.object_ptr("GObject").is_err(),
    );
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

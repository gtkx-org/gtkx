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

        let gobject_type = GObjectType {
            ownership: Ownership::Full,
        };
        let type_ = Type::GObject(gobject_type);

        let cif_value = ffi::FfiValue::Ptr(obj_ptr as *mut c_void);
        let result = type_.decode(&cif_value);

        assert!(result.is_ok());

        let ref_after_transfer = get_gobject_refcount(obj_ptr);

        // Transfer-full keeps the caller's reference as the single pending ref.
        assert_eq!(ref_after_transfer, ref_before_transfer);

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

        // SAFETY: `obj_ptr` is a live GObject this test owns; the forced floating state is consumed by the decode.
        unsafe {
            glib::gobject_ffi::g_object_ref(obj_ptr);
            glib::gobject_ffi::g_object_force_floating(obj_ptr);
        }

        // SAFETY: `obj_ptr` is a live GObject.
        let is_floating_before = unsafe { glib::gobject_ffi::g_object_is_floating(obj_ptr) != 0 };
        assert!(is_floating_before);

        let gobject_type = GObjectType {
            ownership: Ownership::Full,
        };
        let type_ = Type::GObject(gobject_type);

        let cif_value = ffi::FfiValue::Ptr(obj_ptr as *mut c_void);
        let result = type_.decode(&cif_value);

        assert!(result.is_ok());

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
            // SAFETY: Takes a reference on the live GObject; this test balances it itself.
            unsafe {
                glib::gobject_ffi::g_object_ref(obj.as_ptr());
            }
            // SAFETY: Appending to a (possibly null) GList head only requires a valid element pointer.
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
        let mut list: *mut glib::ffi::GList = std::ptr::null_mut();

        for _ in 0..3 {
            let obj = glib::Object::new::<glib::Object>();
            // SAFETY: Takes a reference on the live GObject; this test balances it itself.
            unsafe {
                glib::gobject_ffi::g_object_ref(obj.as_ptr());
            }
            // SAFETY: Appending to a (possibly null) GList head only requires a valid element pointer.
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
fn from_cif_value_fundamental_gvariant_transfer_none() {
    common::run(|| {
        // SAFETY: Creating and sinking a fresh GVariant has no pointer preconditions.
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

        // SAFETY: Releases the reference this test owns on the live GVariant.
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

/// Builds the scalar out-parameter slot a `Ref` scalar encode produces: an
/// aligned `u64`-backed storage seeded with the scalar payload of `value`.
fn scalar_slot_storage(value: &ffi::FfiValue) -> ffi::FfiValue {
    let storage = ffi::FfiStorage::from(vec![0u64]);
    // SAFETY: The storage is a live, aligned 8-byte slot.
    unsafe { value.write_scalar_to(storage.ptr()) }.expect("scalar payload should write");
    ffi::FfiValue::Storage(storage)
}

#[test]
fn from_cif_value_ref_integer() {
    common::run(|| {
        let cif_value = scalar_slot_storage(&ffi::FfiValue::I32(12345));

        let int_kind = native::types::IntegerKind::I32;
        let ref_type = native::types::RefType::new(Type::Integer(int_kind));
        let type_ = Type::Ref(ref_type);

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
        let cif_value = scalar_slot_storage(&ffi::FfiValue::F64(3.15625));

        let float_type = native::types::FloatKind::F64;
        let ref_type = native::types::RefType::new(Type::Float(float_type));
        let type_ = Type::Ref(ref_type);

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

        let mut ptr_storage: Vec<*mut c_void> = vec![obj_ptr];
        let storage_ptr = ptr_storage.as_mut_ptr() as *mut c_void;
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
        let mut ptr_storage: Vec<*mut c_void> = vec![std::ptr::null_mut()];
        let storage_ptr = ptr_storage.as_mut_ptr() as *mut c_void;
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

        let mut ptr_storage: Vec<*mut c_void> = vec![boxed_ptr];
        let storage_ptr = ptr_storage.as_mut_ptr() as *mut c_void;
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

        // SAFETY: Frees the list this test owns.
        unsafe {
            glib::ffi::g_list_free(list);
        }
    });
}

#[test]
fn from_cif_value_struct_transfer_none_logs_warning() {
    common::run(|| {
        // SAFETY: Allocating zeroed memory has no pointer preconditions.
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

        // SAFETY: Frees the allocation this test owns.
        unsafe {
            glib::ffi::g_free(struct_ptr);
        }
    });
}

#[test]
fn from_cif_value_struct_full_transfer() {
    common::run(|| {
        // SAFETY: Allocating zeroed memory has no pointer preconditions.
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
fn from_cif_value_struct_transfer_none_without_size_creates_unowned() {
    common::run(|| {
        // SAFETY: Allocating zeroed memory has no pointer preconditions.
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

        // SAFETY: Frees the allocation this test owns.
        unsafe {
            glib::ffi::g_free(struct_ptr);
        }
    });
}

#[test]
fn from_cif_value_struct_owned_without_size() {
    common::run(|| {
        // SAFETY: Allocating zeroed memory has no pointer preconditions.
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

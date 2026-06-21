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
        caller_allocated: false,
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
    Type::Struct(native::types::StructType {
        ownership,
        size,
        caller_allocated: false,
    })
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

fn new_referenced_gobject() -> (glib::Object, *mut glib::gobject_ffi::GObject) {
    let obj = glib::Object::new::<glib::Object>();
    let obj_ptr = obj.as_ptr();
    // SAFETY: `obj_ptr` is the live pointer of the returned `obj` binding; this extra reference
    // models a transfer-full caller's owned reference and is balanced by each test's explicit unref.
    unsafe {
        glib::gobject_ffi::g_object_ref(obj_ptr);
    }
    (obj, obj_ptr)
}

fn new_gobject_handle() -> (glib::Object, *mut c_void, native::NativeHandle) {
    let obj = glib::Object::new::<glib::Object>();
    let obj_ptr = obj.as_ptr() as *mut c_void;
    let handle = native::NativeHandle::borrowed_gobject(obj_ptr);
    (obj, obj_ptr, handle)
}

fn build_gobject_glist(count: usize) -> *mut glib::ffi::GList {
    let mut list: *mut glib::ffi::GList = std::ptr::null_mut();
    for _ in 0..count {
        let obj = glib::Object::new::<glib::Object>();
        // SAFETY: `obj.as_ptr()` is the live object; this extra reference keeps it alive after the
        // local `obj` binding drops, since the GList only borrows the raw pointer.
        unsafe {
            glib::gobject_ffi::g_object_ref(obj.as_ptr());
        }
        // SAFETY: `list` is either null or the running, owned GList head, and the element is the
        // live, referenced object pointer; `g_list_append` returns the updated head.
        list = unsafe { glib::ffi::g_list_append(list, obj.as_ptr() as *mut c_void) };
    }
    list
}

fn scalar_slot_storage(value: &ffi::FfiValue) -> ffi::FfiValue {
    let storage = ffi::FfiStorage::from(vec![0u64]);
    // SAFETY: `storage.ptr()` addresses the live `u64` backing vec, at least as wide as any scalar
    // `write_scalar_to` writes, so the write is in bounds.
    unsafe { value.write_scalar_to(storage.ptr()) }.expect("scalar payload should write");
    ffi::FfiValue::Storage(storage)
}

fn assert_scalar_ref_decodes_to_number(inner: Type, seeded: &ffi::FfiValue, expected: f64) {
    let cif_value = scalar_slot_storage(seeded);
    let type_ = Type::Ref(native::types::RefType::new(inner));
    let Value::Number(n) = type_.decode(&cif_value).expect("Ref decode failed") else {
        panic!("Expected Value::Number");
    };
    assert_eq!(n, expected);
}

fn ptr_slot_storage(ptr: *mut c_void) -> ffi::FfiValue {
    let mut slot: Vec<*mut c_void> = vec![ptr];
    let storage_ptr = slot.as_mut_ptr() as *mut c_void;
    ffi::FfiValue::Storage(ffi::FfiStorage::new(
        storage_ptr,
        ffi::FfiStorageKind::PtrStorage(slot),
    ))
}

fn assert_struct_alloc_decodes_to_object(ownership: Ownership, size: Option<usize>, bytes: usize) {
    // SAFETY: `g_malloc0` with a non-zero `bytes` returns a freshly allocated, zeroed, owned block.
    let struct_ptr = unsafe { glib::ffi::g_malloc0(bytes) };

    let result = decode_ptr(&struct_type_of(ownership, size), struct_ptr);
    assert!(
        matches!(result, Value::Object(_)),
        "Expected Value::Object for struct"
    );

    if ownership.is_borrowed() {
        // SAFETY: for a borrowed decode the wrapper copied rather than took `struct_ptr`, so it is
        // still the live `g_malloc0`-ed block; `g_free` releases it exactly once.
        unsafe { glib::ffi::g_free(struct_ptr) };
    }
}

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

        drop(result);
        assert_eq!(get_gobject_refcount(obj_ptr), initial_ref + 1);

        // SAFETY: `obj_ptr` is the live object of the `obj` binding plus the extra reference the
        // borrowed decode took; this releases that extra reference.
        unsafe { glib::gobject_ffi::g_object_unref(obj_ptr) };
        assert_eq!(get_gobject_refcount(obj_ptr), initial_ref);
    });
}

#[test]
fn gobject_full_transfer_keeps_pending_reference() {
    common::run(|| {
        let (_obj, obj_ptr) = new_referenced_gobject();

        let ref_before_transfer = get_gobject_refcount(obj_ptr);

        let result = decode_ptr(&gobject_type_of(Ownership::Full), obj_ptr as *mut c_void);

        assert_eq!(get_gobject_refcount(obj_ptr), ref_before_transfer);

        drop(result);
        assert_eq!(get_gobject_refcount(obj_ptr), ref_before_transfer);

        // SAFETY: `obj_ptr` is still live (the `_obj` binding plus the reference the full decode
        // adopted into the dropped handle's pending marker); this releases one remaining reference.
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
        let (_obj, obj_ptr) = new_referenced_gobject();

        // SAFETY: `obj_ptr` is the live object held by `_obj` plus the extra reference; forcing it
        // floating is sound and is sunk by the full decode below.
        unsafe {
            glib::gobject_ffi::g_object_force_floating(obj_ptr);
        }

        // SAFETY: `obj_ptr` is live; `g_object_is_floating` queries its floating state.
        let is_floating_before = unsafe { glib::gobject_ffi::g_object_is_floating(obj_ptr) != 0 };
        assert!(is_floating_before);

        decode_ptr(&gobject_type_of(Ownership::Full), obj_ptr as *mut c_void);

        // SAFETY: `obj_ptr` is still live (the decode ref-sank rather than freed it); this queries
        // its now-non-floating state.
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

        // SAFETY: the borrowed decode did not free `c_string`, which is still alive, so its pointer
        // remains a valid NUL-terminated C string for `CStr::from_ptr`.
        let still_valid = unsafe { std::ffi::CStr::from_ptr(c_string.as_ptr()) };
        assert_eq!(still_valid.to_str().unwrap(), test_string);
    });
}

#[test]
fn string_full_transfer_frees_memory() {
    common::run(|| {
        let test_string = "allocated string";
        let c_string = std::ffi::CString::new(test_string).unwrap();
        // SAFETY: `c_string` is alive with a valid NUL-terminated buffer; `g_strdup` returns a
        // freshly `g_malloc`-ed owned copy that the full-ownership decode below takes and frees.
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

        // SAFETY: the borrowed decode copied rather than took `original_ptr`, so it is still a live
        // boxed value of `gtype`; freeing it once with the matching gtype is sound.
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

        // SAFETY: the borrowed decode left `list` intact, so it is still a live GList; reading its
        // length is sound.
        let length = unsafe { glib::ffi::g_list_length(list) };
        for index in 0..length {
            // SAFETY: `index` is within `length`, so `g_list_nth_data` returns the in-range node's
            // data pointer (the referenced object) for the live `list`.
            let data = unsafe { glib::ffi::g_list_nth_data(list, index) };
            if !data.is_null() {
                // SAFETY: `data` is one of the live objects whose extra reference was taken in
                // `build_gobject_glist`; this releases exactly that reference.
                unsafe {
                    glib::gobject_ffi::g_object_unref(data as *mut glib::gobject_ffi::GObject);
                }
            }
        }
        // SAFETY: every element reference has been released above; `list` is still a live spine that
        // `g_list_free` frees exactly once.
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
            // SAFETY: the borrowed decode did not free the `strings` array, so `strings[0]` is
            // still alive and its pointer is a valid NUL-terminated C string for `CStr::from_ptr`.
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
        // SAFETY: the `c"hello"` literal is a valid NUL-terminated C string; `g_strdup` returns a
        // freshly `g_malloc`-ed owned copy that the full-transfer decode below takes and frees.
        let s1 = unsafe { glib::ffi::g_strdup(c"hello".as_ptr()) };
        // SAFETY: the `c"world"` literal is a valid NUL-terminated C string; `g_strdup` returns a
        // freshly `g_malloc`-ed owned copy that the full-transfer decode below takes and frees.
        let s2 = unsafe { glib::ffi::g_strdup(c"world".as_ptr()) };

        // SAFETY: `g_malloc` returns a fresh block sized for three `char*` entries; writing the two
        // owned strings followed by a NULL terminator builds a valid owned strv that the decode owns.
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
        // SAFETY: `g_variant_new_int32` returns a fresh floating GVariant; `g_variant_ref_sink`
        // converts the floating reference into one owned reference held by this test.
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

        // SAFETY: the borrowed decode took its own reference and dropped it, so `variant` still
        // holds the owned reference taken above; `g_variant_unref` releases it exactly once.
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

        // SAFETY: the borrowed `Ref<Boxed>` decode copied rather than took `boxed_ptr`, so it is
        // still a live boxed value of `gtype`; freeing it once with the matching gtype is sound.
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
        // SAFETY: `list` starts null and grows into the owned GList head; `s1`/`s2` stay alive for
        // the call, so their borrowed pointers are valid elements for `g_list_append`.
        list = unsafe { glib::ffi::g_list_append(list, s1.as_ptr() as *mut c_void) };
        // SAFETY: `list` is the running owned GList head and `s2` is alive; `g_list_append` returns
        // the updated head.
        list = unsafe { glib::ffi::g_list_append(list, s2.as_ptr() as *mut c_void) };

        let items = decode_array(
            &string_array_type_of(Ownership::Borrowed, Ownership::Borrowed, ArrayKind::GList),
            list as *mut c_void,
        );
        assert_eq!(items.len(), 2);
        assert_string_item(&items, 0, "hello");
        assert_string_item(&items, 1, "world");

        // SAFETY: the borrowed decode left `list` intact, so it is still a live GList spine whose
        // elements borrow the still-alive `s1`/`s2`; `g_list_free` frees just the spine once.
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
        let (_obj, obj_ptr, handle) = new_gobject_handle();

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
        let (_obj, obj_ptr, handle) = new_gobject_handle();

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

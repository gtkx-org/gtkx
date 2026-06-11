mod common;

use std::ffi::{CStr, CString, c_char, c_void};

use gtk4::glib;
use native::ffi::{
    FfiStorage, FfiStorageKind, FfiValue, GArrayData, GListData, GSListData, HashTableData,
    StringGListData, StringGSListData,
};
use native::types::{ArrayKind, ArrayType, IntegerKind, Ownership, StringType, Type};
use native::value::Value;

fn make_glist_one() -> *mut glib::ffi::GList {
    // SAFETY: Appending to a (possibly null) GList head only requires a valid element pointer.
    unsafe { glib::ffi::g_list_append(std::ptr::null_mut(), std::ptr::without_provenance_mut(1)) }
}

fn make_gslist_one() -> *mut glib::ffi::GSList {
    // SAFETY: Appending to a (possibly null) GSList head only requires a valid element pointer.
    unsafe { glib::ffi::g_slist_append(std::ptr::null_mut(), std::ptr::without_provenance_mut(1)) }
}

fn make_g_array() -> *mut glib::ffi::GArray {
    // SAFETY: Creating a GArray from size parameters has no pointer preconditions.
    unsafe { glib::ffi::g_array_sized_new(0, 0, size_of::<i32>() as u32, 0) }
}

fn make_g_byte_array() -> *mut glib::ffi::GByteArray {
    // SAFETY: Creating an empty GByteArray has no pointer preconditions.
    unsafe { glib::ffi::g_byte_array_sized_new(0) }
}

fn make_hash_table() -> *mut glib::ffi::GHashTable {
    // SAFETY: Creating a GHashTable from hash/equal function pointers has no pointer preconditions.
    unsafe {
        glib::ffi::g_hash_table_new_full(
            Some(glib::ffi::g_direct_hash),
            Some(glib::ffi::g_direct_equal),
            None,
            None,
        )
    }
}

fn glist_storage(list_ptr: *mut glib::ffi::GList, should_free: bool) -> FfiStorage {
    FfiStorage::new(
        list_ptr as *mut c_void,
        FfiStorageKind::GList(GListData {
            handles: Vec::new(),
            list_ptr,
            should_free,
        }),
    )
}

fn gslist_storage(list_ptr: *mut glib::ffi::GSList, should_free: bool) -> FfiStorage {
    FfiStorage::new(
        list_ptr as *mut c_void,
        FfiStorageKind::GSList(GSListData {
            handles: Vec::new(),
            list_ptr,
            should_free,
        }),
    )
}

fn garray_storage(array_ptr: *mut glib::ffi::GArray, should_free: bool) -> FfiStorage {
    FfiStorage::new(
        array_ptr as *mut c_void,
        FfiStorageKind::GArray(GArrayData {
            array_ptr,
            should_free,
        }),
    )
}

fn gbytearray_storage(array_ptr: *mut glib::ffi::GByteArray, should_free: bool) -> FfiStorage {
    let owned: Option<glib::ByteArray> =
        // SAFETY: The fresh GByteArray's one reference is adopted by the wrapper.
        should_free.then(|| unsafe { glib::translate::from_glib_full(array_ptr) });
    FfiStorage::new(array_ptr as *mut c_void, FfiStorageKind::GByteArray(owned))
}

fn hashtable_storage(handle: *mut glib::ffi::GHashTable, should_free: bool) -> FfiStorage {
    FfiStorage::new(
        handle as *mut c_void,
        FfiStorageKind::HashTable(HashTableData {
            handle,
            should_free,
        }),
    )
}

fn string_glist_storage(
    strings: Vec<CString>,
    list_ptr: *mut glib::ffi::GList,
    should_free: bool,
    elements_duped: bool,
) -> FfiStorage {
    FfiStorage::new(
        list_ptr as *mut c_void,
        FfiStorageKind::StringGList(StringGListData {
            strings,
            list_ptr,
            should_free,
            elements_duped,
        }),
    )
}

fn string_gslist_storage(
    strings: Vec<CString>,
    list_ptr: *mut glib::ffi::GSList,
    should_free: bool,
    elements_duped: bool,
) -> FfiStorage {
    FfiStorage::new(
        list_ptr as *mut c_void,
        FfiStorageKind::StringGSList(StringGSListData {
            strings,
            list_ptr,
            should_free,
            elements_duped,
        }),
    )
}

#[test]
fn hashtable_storage_unrefs_on_drop() {
    common::run(|| {
        let hash_table = make_hash_table();

        // SAFETY: `hash_table` is the live table created above; the extra reference balances the storage's release.
        unsafe { glib::ffi::g_hash_table_ref(hash_table) };

        {
            let _storage = hashtable_storage(hash_table, true);
        }

        // SAFETY: Releases a reference this test owns on the live GHashTable.
        unsafe { glib::ffi::g_hash_table_unref(hash_table) };
    });
}

#[test]
fn hashtable_storage_null_handle_safe_on_drop() {
    {
        let _storage = FfiStorage::new(
            std::ptr::null_mut(),
            FfiStorageKind::HashTable(HashTableData {
                handle: std::ptr::null_mut(),
                should_free: true,
            }),
        );
    }
}

#[test]
fn unit_storage_carries_provided_pointer() {
    let ptr = std::ptr::without_provenance_mut::<c_void>(0x10);
    let storage = FfiStorage::unit(ptr);
    assert_eq!(storage.ptr(), ptr);
    assert!(matches!(storage.kind(), FfiStorageKind::Unit));
}

#[test]
fn storage_ptr_ref_borrows_the_pointer() {
    let storage: FfiStorage = vec![1u8].into();
    assert_eq!(*storage.ptr_ref(), storage.ptr());
}

#[test]
fn as_numeric_slice_matches_every_integer_kind() {
    let cases: [(IntegerKind, FfiStorage); 8] = [
        (IntegerKind::U8, vec![1u8, 2].into()),
        (IntegerKind::I8, vec![-1i8, 2].into()),
        (IntegerKind::U16, vec![1u16, 2].into()),
        (IntegerKind::I16, vec![-1i16, 2].into()),
        (IntegerKind::U32, vec![1u32, 2].into()),
        (IntegerKind::I32, vec![-1i32, 2].into()),
        (IntegerKind::U64, vec![1u64, 2].into()),
        (IntegerKind::I64, vec![-1i64, 2].into()),
    ];
    for (kind, storage) in &cases {
        let slice = storage.as_numeric_slice(*kind).expect("kind should match");
        assert_eq!(slice.len(), 2);
    }
}

#[test]
fn as_numeric_slice_rejects_mismatched_kind() {
    let storage: FfiStorage = vec![1u8].into();
    assert!(storage.as_numeric_slice(IntegerKind::I64).is_err());
}

#[test]
fn as_f32_slice_success_and_mismatch() {
    let f32_storage: FfiStorage = vec![1.0f32, 2.0].into();
    assert_eq!(f32_storage.as_f32_slice().unwrap(), &[1.0f32, 2.0]);

    let other: FfiStorage = vec![1u8].into();
    assert!(other.as_f32_slice().is_err());
}

#[test]
fn as_f64_slice_success_and_mismatch() {
    let f64_storage: FfiStorage = vec![1.0f64, 2.0].into();
    assert_eq!(f64_storage.as_f64_slice().unwrap(), &[1.0f64, 2.0]);

    let other: FfiStorage = vec![1u8].into();
    assert!(other.as_f64_slice().is_err());
}

#[test]
fn as_cstring_array_success_and_mismatch() {
    let strings = vec![CString::new("a").unwrap()];
    let ptrs: Vec<*mut c_void> = strings.iter().map(|s| s.as_ptr() as *mut c_void).collect();
    let storage = FfiStorage::new(
        ptrs.as_ptr() as *mut c_void,
        FfiStorageKind::StringArray(strings, ptrs),
    );
    assert_eq!(storage.as_cstring_array().unwrap().len(), 1);

    let other: FfiStorage = vec![1u8].into();
    assert!(other.as_cstring_array().is_err());
}

#[test]
fn as_bool_slice_success_and_mismatch() {
    let bool_storage: FfiStorage = vec![1i32, 0].into();
    assert_eq!(bool_storage.as_bool_slice().unwrap(), &[1i32, 0]);

    let other: FfiStorage = vec![1u8].into();
    assert!(other.as_bool_slice().is_err());
}

#[test]
fn as_object_array_success_and_mismatch() {
    let handles: Vec<native::NativeHandle> = Vec::new();
    let ptrs: Vec<*mut c_void> = Vec::new();
    let storage = FfiStorage::new(
        std::ptr::null_mut(),
        FfiStorageKind::ObjectArray(handles, ptrs),
    );
    assert!(storage.as_object_array().unwrap().is_empty());

    let other: FfiStorage = vec![1u8].into();
    assert!(other.as_object_array().is_err());
}

#[test]
fn from_vec_covers_every_integer_and_float_type() {
    let u8s: FfiStorage = vec![1u8].into();
    assert!(matches!(u8s.kind(), FfiStorageKind::U8Vec(_)));
    let i8s: FfiStorage = vec![1i8].into();
    assert!(matches!(i8s.kind(), FfiStorageKind::I8Vec(_)));
    let u16s: FfiStorage = vec![1u16].into();
    assert!(matches!(u16s.kind(), FfiStorageKind::U16Vec(_)));
    let i16s: FfiStorage = vec![1i16].into();
    assert!(matches!(i16s.kind(), FfiStorageKind::I16Vec(_)));
    let u32s: FfiStorage = vec![1u32].into();
    assert!(matches!(u32s.kind(), FfiStorageKind::U32Vec(_)));
    let i32s: FfiStorage = vec![1i32].into();
    assert!(matches!(i32s.kind(), FfiStorageKind::I32Vec(_)));
    let u64s: FfiStorage = vec![1u64].into();
    assert!(matches!(u64s.kind(), FfiStorageKind::U64Vec(_)));
    let i64s: FfiStorage = vec![1i64].into();
    assert!(matches!(i64s.kind(), FfiStorageKind::I64Vec(_)));
    let f32s: FfiStorage = vec![1.0f32].into();
    assert!(matches!(f32s.kind(), FfiStorageKind::F32Vec(_)));
    let f64s: FfiStorage = vec![1.0f64].into();
    assert!(matches!(f64s.kind(), FfiStorageKind::F64Vec(_)));
}

#[test]
fn drop_no_op_kinds_do_not_crash() {
    let unit = FfiStorage::unit(std::ptr::null_mut());
    drop(unit);
    let cstring = FfiStorage::new(
        std::ptr::null_mut(),
        FfiStorageKind::CString(CString::new("x").unwrap()),
    );
    drop(cstring);
    let buffer = FfiStorage::new(std::ptr::null_mut(), FfiStorageKind::Buffer(vec![1u8]));
    drop(buffer);
    let ptr_storage = FfiStorage::new(
        std::ptr::null_mut(),
        FfiStorageKind::PtrStorage(vec![std::ptr::null_mut()]),
    );
    drop(ptr_storage);
}

#[test]
fn glist_storage_frees_when_should_free() {
    common::run(|| {
        let list = make_glist_one();
        {
            let _storage = glist_storage(list, true);
        }
    });
}

#[test]
fn glist_storage_keeps_when_not_freed() {
    common::run(|| {
        let list = make_glist_one();
        {
            let _storage = glist_storage(list, false);
        }
        // SAFETY: `list` is the live GList built by this test.
        let len = unsafe { glib::ffi::g_list_length(list) };
        assert_eq!(len, 1);
        // SAFETY: Frees the list this test owns.
        unsafe { glib::ffi::g_list_free(list) };
    });
}

#[test]
fn glist_storage_null_ptr_safe_on_drop() {
    let _storage = FfiStorage::new(
        std::ptr::null_mut(),
        FfiStorageKind::GList(GListData {
            handles: Vec::new(),
            list_ptr: std::ptr::null_mut(),
            should_free: true,
        }),
    );
}

#[test]
fn gslist_storage_frees_when_should_free() {
    common::run(|| {
        let list = make_gslist_one();
        {
            let _storage = gslist_storage(list, true);
        }
    });
}

#[test]
fn gslist_storage_keeps_when_not_freed() {
    common::run(|| {
        let list = make_gslist_one();
        {
            let _storage = gslist_storage(list, false);
        }
        // SAFETY: Frees the list this test owns.
        unsafe { glib::ffi::g_slist_free(list) };
    });
}

#[test]
fn gslist_storage_null_ptr_safe_on_drop() {
    let _storage = FfiStorage::new(
        std::ptr::null_mut(),
        FfiStorageKind::GSList(GSListData {
            handles: Vec::new(),
            list_ptr: std::ptr::null_mut(),
            should_free: true,
        }),
    );
}

#[test]
fn garray_storage_unrefs_when_should_free() {
    common::run(|| {
        let array = make_g_array();
        {
            let _storage = garray_storage(array, true);
        }
    });
}

#[test]
fn garray_storage_keeps_when_not_freed() {
    common::run(|| {
        let array = make_g_array();
        {
            let _storage = garray_storage(array, false);
        }
        // SAFETY: Releases the reference this test owns on the live GArray.
        unsafe { glib::ffi::g_array_unref(array) };
    });
}

#[test]
fn garray_storage_null_ptr_safe_on_drop() {
    let _storage = FfiStorage::new(
        std::ptr::null_mut(),
        FfiStorageKind::GArray(GArrayData {
            array_ptr: std::ptr::null_mut(),
            should_free: true,
        }),
    );
}

#[test]
fn gbytearray_storage_unrefs_when_should_free() {
    common::run(|| {
        let array = make_g_byte_array();
        {
            let _storage = gbytearray_storage(array, true);
        }
    });
}

#[test]
fn gbytearray_storage_keeps_when_not_freed() {
    common::run(|| {
        let array = make_g_byte_array();
        {
            let _storage = gbytearray_storage(array, false);
        }
        // SAFETY: Releases the reference this test owns on the live GByteArray.
        unsafe { glib::ffi::g_byte_array_unref(array) };
    });
}

#[test]
fn gbytearray_storage_without_ownership_safe_on_drop() {
    let _storage = FfiStorage::new(std::ptr::null_mut(), FfiStorageKind::GByteArray(None));
}

#[test]
fn hashtable_storage_keeps_when_not_freed() {
    common::run(|| {
        let hash_table = make_hash_table();
        {
            let _storage = hashtable_storage(hash_table, false);
        }
        // SAFETY: Releases a reference this test owns on the live GHashTable.
        unsafe { glib::ffi::g_hash_table_unref(hash_table) };
    });
}

fn build_string_glist(strings: &[CString], dup: bool) -> *mut glib::ffi::GList {
    let mut list: *mut glib::ffi::GList = std::ptr::null_mut();
    for s in strings {
        let ptr = if dup {
            // SAFETY: Duplicating a live NUL-terminated local has no other preconditions.
            unsafe { glib::ffi::g_strdup(s.as_ptr()) as *mut c_void }
        } else {
            s.as_ptr() as *mut c_void
        };
        // SAFETY: Appending to a (possibly null) GList head only requires a valid element pointer.
        list = unsafe { glib::ffi::g_list_append(list, ptr) };
    }
    list
}

#[test]
fn string_glist_storage_frees_duped_elements() {
    common::run(|| {
        let strings = vec![CString::new("a").unwrap(), CString::new("b").unwrap()];
        let list = build_string_glist(&strings, true);
        {
            let _storage = string_glist_storage(strings, list, true, true);
        }
    });
}

fn drop_borrowed_string_glist_storage(should_free: bool) -> *mut glib::ffi::GList {
    let strings = vec![CString::new("a").unwrap()];
    let list = build_string_glist(&strings, false);
    {
        let _storage = string_glist_storage(strings, list, should_free, false);
    }
    list
}

#[test]
fn string_glist_storage_frees_shallow_when_not_duped() {
    common::run(|| {
        drop_borrowed_string_glist_storage(true);
    });
}

#[test]
fn string_glist_storage_keeps_when_not_freed() {
    common::run(|| {
        let list = drop_borrowed_string_glist_storage(false);
        // SAFETY: Frees the list this test owns.
        unsafe { glib::ffi::g_list_free(list) };
    });
}

#[test]
fn string_glist_storage_null_ptr_safe_on_drop() {
    let _storage = string_glist_storage(Vec::new(), std::ptr::null_mut(), true, true);
}

fn build_string_gslist(strings: &[CString], dup: bool) -> *mut glib::ffi::GSList {
    let mut list: *mut glib::ffi::GSList = std::ptr::null_mut();
    for s in strings.iter().rev() {
        let ptr = if dup {
            // SAFETY: Duplicating a live NUL-terminated local has no other preconditions.
            unsafe { glib::ffi::g_strdup(s.as_ptr()) as *mut c_void }
        } else {
            s.as_ptr() as *mut c_void
        };
        // SAFETY: Prepending to a (possibly null) GSList head only requires a valid element pointer.
        list = unsafe { glib::ffi::g_slist_prepend(list, ptr) };
    }
    list
}

#[test]
fn string_gslist_storage_frees_duped_elements() {
    common::run(|| {
        let strings = vec![CString::new("a").unwrap(), CString::new("b").unwrap()];
        let list = build_string_gslist(&strings, true);
        {
            let _storage = string_gslist_storage(strings, list, true, true);
        }
    });
}

fn drop_borrowed_string_gslist_storage(should_free: bool) -> *mut glib::ffi::GSList {
    let strings = vec![CString::new("a").unwrap()];
    let list = build_string_gslist(&strings, false);
    {
        let _storage = string_gslist_storage(strings, list, should_free, false);
    }
    list
}

#[test]
fn string_gslist_storage_frees_shallow_when_not_duped() {
    common::run(|| {
        drop_borrowed_string_gslist_storage(true);
    });
}

#[test]
fn string_gslist_storage_keeps_when_not_freed() {
    common::run(|| {
        let list = drop_borrowed_string_gslist_storage(false);
        // SAFETY: Frees the list this test owns.
        unsafe { glib::ffi::g_slist_free(list) };
    });
}

#[test]
fn string_gslist_storage_null_ptr_safe_on_drop() {
    let _storage = string_gslist_storage(Vec::new(), std::ptr::null_mut(), true, true);
}

#[test]
fn storage_debug_renders_kind() {
    let storage: FfiStorage = vec![1u8].into();
    assert!(format!("{storage:?}").contains("FfiStorage"));
}

fn string_full_item_array_type(kind: ArrayKind, container_ownership: Ownership) -> ArrayType {
    ArrayType {
        item_type: Box::new(Type::String(StringType {
            ownership: Ownership::Full,
            length: None,
        })),
        kind,
        ownership: container_ownership,
        element_size: None,
    }
}

#[test]
fn encode_empty_string_glist_full_container_arms_null_transfer_safe_on_drop() {
    let ty = string_full_item_array_type(ArrayKind::GList, Ownership::Full);
    let encoded = ty.encode(&Value::Array(Vec::new()), false).unwrap();
    let FfiValue::Storage(storage) = &encoded else {
        panic!("expected storage")
    };
    assert!(storage.ptr().is_null());
    let FfiStorageKind::StringGList(data) = storage.kind() else {
        panic!("expected string GList storage")
    };
    assert!(data.list_ptr.is_null());
    assert!(!data.should_free);
    assert!(data.elements_duped);
    drop(encoded);
}

#[test]
fn encode_string_array_element_transfer_frees_duplicates_when_call_never_happens() {
    let ty = string_full_item_array_type(ArrayKind::Array, Ownership::Borrowed);
    let val = Value::Array(vec![
        Value::String("foo".to_string()),
        Value::String("bar".to_string()),
    ]);
    let encoded = ty.encode(&val, false).unwrap();
    let FfiValue::Storage(storage) = &encoded else {
        panic!("expected storage")
    };
    let block = storage.ptr() as *mut *mut c_char;
    // SAFETY: The staged block holds live NUL-terminated duplicates.
    let first = unsafe { CStr::from_ptr(*block) };
    // SAFETY: The staged block holds live NUL-terminated duplicates.
    let second = unsafe { CStr::from_ptr(*block.add(1)) };
    assert_eq!(first.to_str().unwrap(), "foo");
    assert_eq!(second.to_str().unwrap(), "bar");
    // SAFETY: The staged block is a live three-slot block ending in NULL.
    assert!(unsafe { (*block.add(2)).is_null() });
    drop(encoded);
}

#[test]
fn encode_gbytearray_full_ownership_unrefs_when_call_never_happens() {
    common::run(|| {
        let ty = ArrayType {
            item_type: Box::new(Type::Integer(IntegerKind::U8)),
            kind: ArrayKind::GByteArray,
            ownership: Ownership::Full,
            element_size: None,
        };
        let val = Value::Array(vec![Value::Number(7.0), Value::Number(8.0)]);
        let encoded = ty.encode(&val, false).unwrap();
        let FfiValue::Storage(storage) = &encoded else {
            panic!("expected storage")
        };
        assert!(matches!(storage.kind(), FfiStorageKind::GByteArray(None)));
        let byte_array = storage.ptr() as *mut glib::ffi::GByteArray;
        // SAFETY: `byte_array` is the live array the encode created; the
        // extra reference keeps it alive past the storage's release.
        unsafe { glib::ffi::g_byte_array_ref(byte_array) };
        drop(encoded);
        // SAFETY: The reference taken above keeps the array live for the
        // field reads, and releasing that reference frees it.
        unsafe {
            assert_eq!((*byte_array).len, 2);
            assert_eq!(*(*byte_array).data, 7);
            assert_eq!(*(*byte_array).data.add(1), 8);
            glib::ffi::g_byte_array_unref(byte_array);
        }
    });
}

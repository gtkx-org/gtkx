use test_support as helpers;

use std::ffi::{CStr, CString, c_char, c_void};

use gtk4::glib;
use native::ffi::codec::{
    ArrayCodec, ArrayKind, Codec, Encoder as _, IntegerCodec, Ownership, StringCodec,
};
use native::ffi::{GArrayData, ListData, ListPayload, Stash, StashData, StashStorage};

fn make_glist_one() -> *mut glib::ffi::GList {
    unsafe { glib::ffi::g_list_append(std::ptr::null_mut(), std::ptr::without_provenance_mut(1)) }
}

fn make_gslist_one() -> *mut glib::ffi::GSList {
    unsafe { glib::ffi::g_slist_append(std::ptr::null_mut(), std::ptr::without_provenance_mut(1)) }
}

fn make_g_array() -> *mut glib::ffi::GArray {
    unsafe { glib::ffi::g_array_sized_new(0, 0, size_of::<i32>() as u32, 0) }
}

fn make_g_byte_array() -> *mut glib::ffi::GByteArray {
    unsafe { glib::ffi::g_byte_array_sized_new(0) }
}

fn make_hash_table() -> *mut glib::ffi::GHashTable {
    unsafe {
        glib::ffi::g_hash_table_new_full(
            Some(glib::ffi::g_direct_hash),
            Some(glib::ffi::g_direct_equal),
            None,
            None,
        )
    }
}

fn glist_storage(ptr: *mut glib::ffi::GList, should_free: bool) -> StashStorage {
    StashStorage::new(
        ptr as *mut c_void,
        StashData::List(ListData {
            ops: &native::ffi::GLIST_OPS,
            ptr: ptr as *mut c_void,
            should_free,
            payload: ListPayload::Handles(Vec::new()),
        }),
    )
}

fn gslist_storage(ptr: *mut glib::ffi::GSList, should_free: bool) -> StashStorage {
    StashStorage::new(
        ptr as *mut c_void,
        StashData::List(ListData {
            ops: &native::ffi::GSLIST_OPS,
            ptr: ptr as *mut c_void,
            should_free,
            payload: ListPayload::Handles(Vec::new()),
        }),
    )
}

fn garray_storage(ptr: *mut glib::ffi::GArray, should_free: bool) -> StashStorage {
    StashStorage::new(
        ptr as *mut c_void,
        StashData::GArray(GArrayData { ptr, should_free }),
    )
}

fn gbytearray_storage(ptr: *mut glib::ffi::GByteArray, should_free: bool) -> StashStorage {
    let owned: Option<glib::ByteArray> =
        should_free.then(|| unsafe { glib::translate::from_glib_full(ptr) });
    StashStorage::new(ptr as *mut c_void, StashData::GByteArray(owned))
}

fn hashtable_storage(handle: *mut glib::ffi::GHashTable, should_free: bool) -> StashStorage {
    if should_free {
        StashStorage::new(handle as *mut c_void, StashData::HashTable)
    } else {
        StashStorage::unit(handle as *mut c_void)
    }
}

fn string_glist_storage(
    strings: Vec<CString>,
    ptr: *mut glib::ffi::GList,
    should_free: bool,
    items_duped: bool,
) -> StashStorage {
    StashStorage::new(
        ptr as *mut c_void,
        StashData::List(ListData {
            ops: &native::ffi::GLIST_OPS,
            ptr: ptr as *mut c_void,
            should_free,
            payload: ListPayload::Strings {
                strings,
                items_duped,
            },
        }),
    )
}

fn string_gslist_storage(
    strings: Vec<CString>,
    ptr: *mut glib::ffi::GSList,
    should_free: bool,
    items_duped: bool,
) -> StashStorage {
    StashStorage::new(
        ptr as *mut c_void,
        StashData::List(ListData {
            ops: &native::ffi::GSLIST_OPS,
            ptr: ptr as *mut c_void,
            should_free,
            payload: ListPayload::Strings {
                strings,
                items_duped,
            },
        }),
    )
}

#[test]
fn hashtable_storage_unrefs_on_drop() {
    helpers::run(|| {
        let hash_table = make_hash_table();

        unsafe { glib::ffi::g_hash_table_ref(hash_table) };

        {
            let _storage = hashtable_storage(hash_table, true);
        }

        unsafe { glib::ffi::g_hash_table_unref(hash_table) };
    });
}

#[test]
fn hashtable_storage_null_handle_safe_on_drop() {
    {
        let _storage = StashStorage::new(std::ptr::null_mut(), StashData::HashTable);
    }
}

#[test]
fn unit_storage_carries_provided_pointer() {
    let ptr = std::ptr::without_provenance_mut::<c_void>(0x10);
    let storage = StashStorage::unit(ptr);
    assert_eq!(storage.ptr(), ptr);
    assert!(matches!(storage.data(), StashData::Unit));
}

#[test]
fn storage_ptr_ref_borrows_the_pointer() {
    let storage: StashStorage = vec![1u8].into();
    assert_eq!(*storage.ptr_ref(), storage.ptr());
}

#[test]
fn from_vec_covers_every_integer_and_float_type() {
    let u8s: StashStorage = vec![1u8].into();
    assert!(matches!(u8s.data(), StashData::U8Vec(_)));
    let i8s: StashStorage = vec![1i8].into();
    assert!(matches!(i8s.data(), StashData::I8Vec(_)));
    let u16s: StashStorage = vec![1u16].into();
    assert!(matches!(u16s.data(), StashData::U16Vec(_)));
    let i16s: StashStorage = vec![1i16].into();
    assert!(matches!(i16s.data(), StashData::I16Vec(_)));
    let u32s: StashStorage = vec![1u32].into();
    assert!(matches!(u32s.data(), StashData::U32Vec(_)));
    let i32s: StashStorage = vec![1i32].into();
    assert!(matches!(i32s.data(), StashData::I32Vec(_)));
    let u64s: StashStorage = vec![1u64].into();
    assert!(matches!(u64s.data(), StashData::U64Vec(_)));
    let i64s: StashStorage = vec![1i64].into();
    assert!(matches!(i64s.data(), StashData::I64Vec(_)));
    let f32s: StashStorage = vec![1.0f32].into();
    assert!(matches!(f32s.data(), StashData::F32Vec(_)));
    let f64s: StashStorage = vec![1.0f64].into();
    assert!(matches!(f64s.data(), StashData::F64Vec(_)));
}

#[test]
fn drop_no_op_kinds_do_not_crash() {
    let unit = StashStorage::unit(std::ptr::null_mut());
    drop(unit);
    let cstring = StashStorage::new(
        std::ptr::null_mut(),
        StashData::CString(CString::new("x").unwrap()),
    );
    drop(cstring);
    let buffer = StashStorage::new(std::ptr::null_mut(), StashData::Buffer(vec![1u8]));
    drop(buffer);
    let ptr_storage = StashStorage::new(
        std::ptr::null_mut(),
        StashData::PtrSlot(vec![std::ptr::null_mut()]),
    );
    drop(ptr_storage);
}

#[test]
fn stash_keeps_cstring_alive() {
    let cstring = CString::new("test string").unwrap();
    let ptr = cstring.as_ptr() as *mut c_void;
    let owned = StashStorage::new(ptr, StashData::CString(cstring));

    unsafe {
        let s = CStr::from_ptr(owned.ptr() as *const c_char);
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

    let owned = StashStorage::new(tuple_ptr, StashData::StringArray(strings, ptrs));

    unsafe {
        let ptr_slice = std::slice::from_raw_parts(owned.ptr() as *const *const c_char, 2);
        let s0 = CStr::from_ptr(ptr_slice[0]);
        let s1 = CStr::from_ptr(ptr_slice[1]);
        assert_eq!(s0.to_str().unwrap(), "hello");
        assert_eq!(s1.to_str().unwrap(), "world");
    }
}

#[test]
fn glist_storage_frees_when_should_free() {
    helpers::run(|| {
        let list = make_glist_one();
        {
            let _storage = glist_storage(list, true);
        }
    });
}

#[test]
fn glist_storage_keeps_when_not_freed() {
    helpers::run(|| {
        let list = make_glist_one();
        {
            let _storage = glist_storage(list, false);
        }
        let len = unsafe { glib::ffi::g_list_length(list) };
        assert_eq!(len, 1);
        unsafe { glib::ffi::g_list_free(list) };
    });
}

#[test]
fn glist_storage_null_ptr_safe_on_drop() {
    let _storage = StashStorage::new(
        std::ptr::null_mut(),
        StashData::List(ListData {
            ops: &native::ffi::GLIST_OPS,
            ptr: std::ptr::null_mut(),
            should_free: true,
            payload: ListPayload::Handles(Vec::new()),
        }),
    );
}

#[test]
fn gslist_storage_frees_when_should_free() {
    helpers::run(|| {
        let list = make_gslist_one();
        {
            let _storage = gslist_storage(list, true);
        }
    });
}

#[test]
fn gslist_storage_keeps_when_not_freed() {
    helpers::run(|| {
        let list = make_gslist_one();
        {
            let _storage = gslist_storage(list, false);
        }
        unsafe { glib::ffi::g_slist_free(list) };
    });
}

#[test]
fn gslist_storage_null_ptr_safe_on_drop() {
    let _storage = StashStorage::new(
        std::ptr::null_mut(),
        StashData::List(ListData {
            ops: &native::ffi::GSLIST_OPS,
            ptr: std::ptr::null_mut(),
            should_free: true,
            payload: ListPayload::Handles(Vec::new()),
        }),
    );
}

#[test]
fn garray_storage_unrefs_when_should_free() {
    helpers::run(|| {
        let array = make_g_array();
        {
            let _storage = garray_storage(array, true);
        }
    });
}

#[test]
fn garray_storage_keeps_when_not_freed() {
    helpers::run(|| {
        let array = make_g_array();
        {
            let _storage = garray_storage(array, false);
        }
        unsafe { glib::ffi::g_array_unref(array) };
    });
}

#[test]
fn garray_storage_null_ptr_safe_on_drop() {
    let _storage = StashStorage::new(
        std::ptr::null_mut(),
        StashData::GArray(GArrayData {
            ptr: std::ptr::null_mut(),
            should_free: true,
        }),
    );
}

#[test]
fn gbytearray_storage_unrefs_when_should_free() {
    helpers::run(|| {
        let array = make_g_byte_array();
        {
            let _storage = gbytearray_storage(array, true);
        }
    });
}

#[test]
fn gbytearray_storage_keeps_when_not_freed() {
    helpers::run(|| {
        let array = make_g_byte_array();
        {
            let _storage = gbytearray_storage(array, false);
        }
        unsafe { glib::ffi::g_byte_array_unref(array) };
    });
}

#[test]
fn gbytearray_storage_without_ownership_safe_on_drop() {
    let _storage = StashStorage::new(std::ptr::null_mut(), StashData::GByteArray(None));
}

#[test]
fn hashtable_storage_keeps_when_not_freed() {
    helpers::run(|| {
        let hash_table = make_hash_table();
        {
            let _storage = hashtable_storage(hash_table, false);
        }
        unsafe { glib::ffi::g_hash_table_unref(hash_table) };
    });
}

fn string_list_element_ptr(s: &CString, dup: bool) -> *mut c_void {
    if dup {
        unsafe { glib::ffi::g_strdup(s.as_ptr()) as *mut c_void }
    } else {
        s.as_ptr() as *mut c_void
    }
}

fn build_string_glist(strings: &[CString], dup: bool) -> *mut glib::ffi::GList {
    let mut list: *mut glib::ffi::GList = std::ptr::null_mut();
    for s in strings {
        let ptr = string_list_element_ptr(s, dup);
        list = unsafe { glib::ffi::g_list_append(list, ptr) };
    }
    list
}

#[test]
fn string_glist_storage_frees_duped_elements() {
    helpers::run(|| {
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
    helpers::run(|| {
        drop_borrowed_string_glist_storage(true);
    });
}

#[test]
fn string_glist_storage_keeps_when_not_freed() {
    helpers::run(|| {
        let list = drop_borrowed_string_glist_storage(false);
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
        let ptr = string_list_element_ptr(s, dup);
        list = unsafe { glib::ffi::g_slist_prepend(list, ptr) };
    }
    list
}

#[test]
fn string_gslist_storage_frees_duped_elements() {
    helpers::run(|| {
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
    helpers::run(|| {
        drop_borrowed_string_gslist_storage(true);
    });
}

#[test]
fn string_gslist_storage_keeps_when_not_freed() {
    helpers::run(|| {
        let list = drop_borrowed_string_gslist_storage(false);
        unsafe { glib::ffi::g_slist_free(list) };
    });
}

#[test]
fn string_gslist_storage_null_ptr_safe_on_drop() {
    let _storage = string_gslist_storage(Vec::new(), std::ptr::null_mut(), true, true);
}

fn string_full_item_array_type(kind: ArrayKind, container_ownership: Ownership) -> ArrayCodec {
    ArrayCodec::new(
        Box::new(Codec::String(StringCodec {
            ownership: Ownership::Full,
            length: None,
        })),
        kind,
        container_ownership,
        None,
        None,
        None,
    )
    .expect("valid array codec")
}

#[test]
fn encode_empty_string_glist_full_container_arms_null_transfer_safe_on_drop() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let codec = string_full_item_array_type(ArrayKind::GList, Ownership::Full);
        let empty = helpers::napi_mock::to_unknown(&env, helpers::napi_mock::fake_array(&[]));
        let encoded = codec.encode(&env, empty).unwrap();
        let Stash::Storage(storage) = &encoded else {
            panic!("expected storage")
        };
        assert!(storage.ptr().is_null());
        let StashData::List(data) = storage.data() else {
            panic!("expected string GList storage")
        };
        let ListPayload::Strings { items_duped, .. } = &data.payload else {
            panic!("expected string payload")
        };
        assert!(data.ptr.is_null());
        assert!(!data.should_free);
        assert!(*items_duped);
        drop(encoded);
    });
}

#[test]
fn encode_string_array_element_transfer_frees_duplicates_when_call_never_happens() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let codec = string_full_item_array_type(ArrayKind::Array, Ownership::Borrowed);
        let val = helpers::napi_mock::to_unknown(
            &env,
            helpers::napi_mock::fake_array(&[
                helpers::napi_mock::fake_string("foo"),
                helpers::napi_mock::fake_string("bar"),
            ]),
        );
        let encoded = codec.encode(&env, val).unwrap();
        let Stash::Storage(storage) = &encoded else {
            panic!("expected storage")
        };
        let block = storage.ptr() as *mut *mut c_char;
        let first = unsafe { CStr::from_ptr(*block) };
        let second = unsafe { CStr::from_ptr(*block.add(1)) };
        assert_eq!(first.to_str().unwrap(), "foo");
        assert_eq!(second.to_str().unwrap(), "bar");
        assert!(unsafe { (*block.add(2)).is_null() });
        drop(encoded);
    });
}

#[test]
fn encode_gbytearray_full_ownership_unrefs_when_call_never_happens() {
    helpers::run(|| {
        let codec = ArrayCodec::new(
            Box::new(Codec::Integer(IntegerCodec::U8)),
            ArrayKind::GByteArray,
            Ownership::Full,
            None,
            None,
            None,
        )
        .expect("valid gbytearray codec");
        let env = helpers::fake_env();
        let val = helpers::napi_mock::to_unknown(
            &env,
            helpers::napi_mock::fake_array(&[
                helpers::napi_mock::fake_double(7.0),
                helpers::napi_mock::fake_double(8.0),
            ]),
        );
        let encoded = codec.encode(&env, val).unwrap();
        let Stash::Storage(storage) = &encoded else {
            panic!("expected storage")
        };
        assert!(matches!(storage.data(), StashData::GByteArray(None)));
        let byte_array = storage.ptr() as *mut glib::ffi::GByteArray;
        unsafe { glib::ffi::g_byte_array_ref(byte_array) };
        drop(encoded);
        unsafe {
            assert_eq!((*byte_array).len, 2);
            assert_eq!(*(*byte_array).data, 7);
            assert_eq!(*(*byte_array).data.add(1), 8);
            glib::ffi::g_byte_array_unref(byte_array);
        }
    });
}

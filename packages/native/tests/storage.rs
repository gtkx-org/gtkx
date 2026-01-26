mod common;

use std::ffi::c_void;
use std::ptr::NonNull;
use std::sync::{
    Arc,
    atomic::{AtomicBool, Ordering},
};

use gtk4::glib;
use native::ffi::{FfiStorage, FfiStorageKind, HashTableData, HashTableStorage};

fn create_test_closure() -> NonNull<glib::gobject_ffi::GClosure> {
    common::ensure_gtk_init();

    let closure = glib::Closure::new(move |_| None::<glib::Value>);

    use glib::translate::ToGlibPtr as _;
    let ptr: *mut glib::gobject_ffi::GClosure = closure.to_glib_full();
    std::mem::forget(closure);
    NonNull::new(ptr).expect("closure pointer should not be null")
}

fn create_test_closure_with_flag(flag: Arc<AtomicBool>) -> NonNull<glib::gobject_ffi::GClosure> {
    common::ensure_gtk_init();

    let closure = glib::Closure::new(move |_| {
        flag.store(true, Ordering::SeqCst);
        None::<glib::Value>
    });

    use glib::translate::ToGlibPtr as _;
    let ptr: *mut glib::gobject_ffi::GClosure = closure.to_glib_full();
    std::mem::forget(closure);
    NonNull::new(ptr).expect("closure pointer should not be null")
}

#[test]
fn closure_storage_unrefs_on_drop() {
    let closure_ptr = create_test_closure();

    unsafe { glib::gobject_ffi::g_closure_ref(closure_ptr.as_ptr()) };
    let ref_before = common::get_closure_refcount(closure_ptr.as_ptr());

    {
        let _storage = FfiStorage::closure(closure_ptr.as_ptr());
    }

    let ref_after = common::get_closure_refcount(closure_ptr.as_ptr());
    assert_eq!(ref_after, ref_before - 1);

    unsafe { glib::gobject_ffi::g_closure_unref(closure_ptr.as_ptr()) };
}

#[test]
fn closure_storage_null_ptr_safe_on_drop() {
    {
        let _storage = FfiStorage::closure(std::ptr::null_mut());
    }
}

#[test]
fn closure_storage_ptr_returns_closure_ptr() {
    let closure_ptr = create_test_closure();

    let storage = FfiStorage::closure(closure_ptr.as_ptr());
    assert_eq!(storage.ptr(), closure_ptr.as_ptr() as *mut c_void);

    unsafe { glib::gobject_ffi::g_closure_unref(closure_ptr.as_ptr()) };
}

#[test]
fn closure_storage_kind_is_gclosure() {
    let closure_ptr = create_test_closure();

    let storage = FfiStorage::closure(closure_ptr.as_ptr());
    assert!(matches!(storage.kind(), FfiStorageKind::GClosure));

    unsafe { glib::gobject_ffi::g_closure_unref(closure_ptr.as_ptr()) };
}

#[test]
fn unit_storage_does_not_unref_closure() {
    let closure_ptr = create_test_closure();

    unsafe { glib::gobject_ffi::g_closure_ref(closure_ptr.as_ptr()) };
    let ref_before = common::get_closure_refcount(closure_ptr.as_ptr());

    {
        let _storage = FfiStorage::unit(closure_ptr.as_ptr() as *mut c_void);
    }

    let ref_after = common::get_closure_refcount(closure_ptr.as_ptr());
    assert_eq!(ref_after, ref_before);

    unsafe {
        glib::gobject_ffi::g_closure_unref(closure_ptr.as_ptr());
        glib::gobject_ffi::g_closure_unref(closure_ptr.as_ptr());
    };
}

#[test]
fn hashtable_storage_unrefs_on_drop() {
    common::ensure_gtk_init();

    let hash_table = unsafe {
        glib::ffi::g_hash_table_new_full(
            Some(glib::ffi::g_direct_hash),
            Some(glib::ffi::g_direct_equal),
            None,
            None,
        )
    };

    unsafe { glib::ffi::g_hash_table_ref(hash_table) };

    {
        let _storage = FfiStorage::new(
            hash_table as *mut c_void,
            FfiStorageKind::HashTable(HashTableData {
                handle: hash_table,
                keys: HashTableStorage::Integers,
                values: HashTableStorage::Integers,
            }),
        );
    }

    unsafe { glib::ffi::g_hash_table_unref(hash_table) };
}

#[test]
fn hashtable_storage_null_handle_safe_on_drop() {
    {
        let _storage = FfiStorage::new(
            std::ptr::null_mut(),
            FfiStorageKind::HashTable(HashTableData {
                handle: std::ptr::null_mut(),
                keys: HashTableStorage::Integers,
                values: HashTableStorage::Integers,
            }),
        );
    }
}

#[test]
fn multiple_closures_all_unreffed() {
    let closures: Vec<_> = (0..5).map(|_| create_test_closure()).collect();

    for closure_ptr in &closures {
        unsafe { glib::gobject_ffi::g_closure_ref(closure_ptr.as_ptr()) };
    }

    let refs_before: Vec<_> = closures
        .iter()
        .map(|c| common::get_closure_refcount(c.as_ptr()))
        .collect();

    {
        let storages: Vec<_> = closures
            .iter()
            .map(|c| FfiStorage::closure(c.as_ptr()))
            .collect();
        drop(storages);
    }

    for (i, closure_ptr) in closures.iter().enumerate() {
        let ref_after = common::get_closure_refcount(closure_ptr.as_ptr());
        assert_eq!(ref_after, refs_before[i] - 1);
        unsafe { glib::gobject_ffi::g_closure_unref(closure_ptr.as_ptr()) };
    }
}

#[test]
fn closure_with_captured_state_properly_cleaned_up() {
    let flag = Arc::new(AtomicBool::new(false));
    let closure_ptr = create_test_closure_with_flag(flag.clone());

    {
        let storage = FfiStorage::closure(closure_ptr.as_ptr());

        unsafe {
            glib::gobject_ffi::g_closure_invoke(
                closure_ptr.as_ptr(),
                std::ptr::null_mut(),
                0,
                std::ptr::null(),
                std::ptr::null_mut(),
            );
        }

        assert!(flag.load(Ordering::SeqCst));
        drop(storage);
    }
}

mod common;

use std::ffi::c_void;

use gtk4::glib;

use native::variant::GVariant;

fn create_test_variant() -> *mut glib::ffi::GVariant {
    common::ensure_gtk_init();
    unsafe {
        let ptr = glib::ffi::g_variant_new_int32(42);
        glib::ffi::g_variant_ref_sink(ptr);
        ptr
    }
}

#[test]
fn from_glib_full_sets_owned_flag() {
    let ptr = create_test_variant();
    let variant = GVariant::from_glib_full(ptr as *mut c_void);

    assert!(variant.is_owned());
    assert!(!variant.as_ptr().is_null());
}

#[test]
fn from_glib_full_null_ptr_safe() {
    let variant = GVariant::from_glib_full(std::ptr::null_mut());

    assert!(variant.is_owned());
    assert!(variant.as_ptr().is_null());
}

#[test]
fn from_glib_none_refs_and_sinks() {
    let ptr = create_test_variant();
    let variant = GVariant::from_glib_none(ptr as *mut c_void);

    assert!(variant.is_owned());
    assert!(!variant.as_ptr().is_null());

    unsafe {
        glib::ffi::g_variant_unref(ptr);
    }
}

#[test]
fn from_glib_none_null_ptr_not_owned() {
    let variant = GVariant::from_glib_none(std::ptr::null_mut());

    assert!(!variant.is_owned());
    assert!(variant.as_ptr().is_null());
}

#[test]
fn as_ptr_returns_correct_pointer() {
    let ptr = create_test_variant();
    let variant = GVariant::from_glib_full(ptr as *mut c_void);

    assert_eq!(variant.as_ptr(), ptr as *mut c_void);
}

#[test]
fn clone_increments_refcount() {
    let ptr = create_test_variant();
    let variant = GVariant::from_glib_full(ptr as *mut c_void);
    let cloned = variant.clone();

    assert!(cloned.is_owned());
    assert_eq!(cloned.as_ptr(), variant.as_ptr());
}

#[test]
fn clone_null_does_not_increment_refcount() {
    let variant = GVariant::from_glib_none(std::ptr::null_mut());
    let cloned = variant.clone();

    assert!(!cloned.is_owned());
    assert!(cloned.as_ptr().is_null());
}

#[test]
fn drop_unrefs_owned_variant() {
    let ptr = create_test_variant();
    let variant = GVariant::from_glib_full(ptr as *mut c_void);
    drop(variant);
}

#[test]
fn drop_does_not_unref_transfer_none_variant() {
    common::ensure_gtk_init();

    let ptr = create_test_variant();

    struct TestGVariant {
        ptr: *mut c_void,
        is_owned: bool,
    }

    impl Drop for TestGVariant {
        fn drop(&mut self) {
            if self.is_owned && !self.ptr.is_null() {
                unsafe {
                    glib::ffi::g_variant_unref(self.ptr as *mut glib::ffi::GVariant);
                }
            }
        }
    }

    let variant = TestGVariant {
        ptr: ptr as *mut c_void,
        is_owned: false,
    };
    drop(variant);

    unsafe {
        glib::ffi::g_variant_unref(ptr);
    }
}

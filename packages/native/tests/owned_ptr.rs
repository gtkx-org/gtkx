mod common;

use std::ffi::c_void;

use gtk4::glib::{self, translate::IntoGlib as _};
use gtk4::prelude::StaticType as _;
use native::managed::Boxed;

#[test]
fn boxed_from_glib_full_owns_pointer() {
    common::ensure_gtk_init();

    let gtype = gtk4::gdk::RGBA::static_type();
    let ptr = common::allocate_test_boxed(gtype);

    let boxed = Boxed::from_glib_full(Some(gtype), ptr);

    assert_eq!(boxed.as_ptr(), ptr);
    assert!(boxed.is_owned());
    assert_eq!(boxed.gtype(), Some(gtype));
}

#[test]
fn boxed_from_glib_full_null_not_owned() {
    let boxed = Boxed::from_glib_full(None, std::ptr::null_mut());

    assert!(boxed.as_ptr().is_null());
    assert!(boxed.is_owned());
}

#[test]
fn boxed_from_glib_none_copies_pointer() {
    common::ensure_gtk_init();

    let gtype = gtk4::gdk::RGBA::static_type();
    let original_ptr = common::allocate_test_boxed(gtype);

    let boxed =
        Boxed::from_glib_none(Some(gtype), original_ptr).expect("from_glib_none should succeed");

    assert_ne!(boxed.as_ptr(), original_ptr);
    assert!(boxed.is_owned());
    assert!(common::is_valid_boxed_ptr(boxed.as_ptr(), gtype));

    unsafe {
        glib::gobject_ffi::g_boxed_free(gtype.into_glib(), original_ptr);
    }
}

#[test]
fn boxed_from_glib_none_null_not_owned() {
    common::ensure_gtk_init();

    let gtype = gtk4::gdk::RGBA::static_type();
    let boxed = Boxed::from_glib_none(Some(gtype), std::ptr::null_mut()).unwrap();

    assert!(boxed.as_ptr().is_null());
    assert!(!boxed.is_owned());
}

#[test]
fn boxed_clone_copies_when_owned() {
    common::ensure_gtk_init();

    let gtype = gtk4::gdk::RGBA::static_type();
    let ptr = common::allocate_test_boxed(gtype);
    let boxed = Boxed::from_glib_full(Some(gtype), ptr);

    let cloned = boxed.clone();

    assert_ne!(cloned.as_ptr(), boxed.as_ptr());
    assert!(cloned.is_owned());
    assert!(common::is_valid_boxed_ptr(cloned.as_ptr(), gtype));
}

#[test]
fn boxed_clone_null_remains_null() {
    common::ensure_gtk_init();

    let gtype = gtk4::gdk::RGBA::static_type();
    let boxed = Boxed::from_glib_none(Some(gtype), std::ptr::null_mut()).unwrap();

    let cloned = boxed;

    assert!(cloned.as_ptr().is_null());
    assert!(!cloned.is_owned());
}

#[test]
fn boxed_from_glib_none_with_size_copies_without_gtype() {
    let data: [u8; 16] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
    let ptr = data.as_ptr() as *mut c_void;

    let boxed = Boxed::from_glib_none_with_size(None, ptr, Some(16), Some("TestStruct")).unwrap();

    assert!(!boxed.as_ptr().is_null());
    assert_ne!(boxed.as_ptr(), ptr);
    assert!(boxed.is_owned());

    unsafe {
        let copied_data = std::slice::from_raw_parts(boxed.as_ptr() as *const u8, 16);
        assert_eq!(copied_data, &data);
    }
}

#[test]
fn boxed_from_glib_none_without_size_or_gtype_fails() {
    let data: [u8; 16] = [0; 16];
    let ptr = data.as_ptr() as *mut c_void;

    let result = Boxed::from_glib_none_with_size(None, ptr, None, Some("TestStruct"));

    assert!(result.is_err());
    let err = result.unwrap_err();
    assert!(err.to_string().contains("Cannot copy boxed type"));
}

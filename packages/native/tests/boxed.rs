mod common;

use gtk4::gdk;
use gtk4::glib;
use gtk4::glib::translate::IntoGlib as _;
use gtk4::prelude::StaticType as _;

use native::Boxed;

#[test]
fn from_glib_full_sets_owned_flag() {
    common::ensure_gtk_init();

    let gtype = gdk::RGBA::static_type();
    let ptr = common::allocate_test_boxed(gtype);

    let boxed = Boxed::from_glib_full(Some(gtype), ptr);

    assert!(boxed.is_owned());
    assert!(!boxed.as_ptr().is_null());
}

#[test]
fn from_glib_full_null_ptr_safe() {
    common::ensure_gtk_init();

    let gtype = gdk::RGBA::static_type();
    let boxed = Boxed::from_glib_full(Some(gtype), std::ptr::null_mut());

    assert!(boxed.is_owned());
    assert!(boxed.as_ptr().is_null());
}

#[test]
fn from_glib_none_creates_copy() {
    common::ensure_gtk_init();

    let gtype = gdk::RGBA::static_type();
    let original_ptr = common::allocate_test_boxed(gtype);

    let boxed = Boxed::from_glib_none(Some(gtype), original_ptr)
        .expect("from_glib_none with gtype should succeed");

    assert!(boxed.is_owned());
    assert!(!boxed.as_ptr().is_null());
    assert_ne!(boxed.as_ptr(), original_ptr);

    unsafe {
        glib::gobject_ffi::g_boxed_free(gtype.into_glib(), original_ptr);
    }
}

#[test]
fn from_glib_none_null_ptr_not_owned() {
    common::ensure_gtk_init();

    let gtype = gdk::RGBA::static_type();
    let boxed = Boxed::from_glib_none(Some(gtype), std::ptr::null_mut())
        .expect("from_glib_none with null ptr should succeed");

    assert!(!boxed.is_owned());
    assert!(boxed.as_ptr().is_null());
}

#[test]
fn from_glib_none_unknown_type_returns_error() {
    common::ensure_gtk_init();

    let gtype = gdk::RGBA::static_type();
    let ptr = common::allocate_test_boxed(gtype);

    let result = Boxed::from_glib_none(None, ptr);

    assert!(result.is_err());

    unsafe {
        glib::gobject_ffi::g_boxed_free(gtype.into_glib(), ptr);
    }
}

#[test]
fn clone_creates_independent_copy() {
    common::ensure_gtk_init();

    let gtype = gdk::RGBA::static_type();
    let ptr = common::allocate_test_boxed(gtype);

    let boxed = Boxed::from_glib_full(Some(gtype), ptr);
    let cloned = boxed.clone();

    assert!(cloned.is_owned());
    assert!(!cloned.as_ptr().is_null());
    assert_ne!(cloned.as_ptr(), boxed.as_ptr());

    drop(boxed);

    assert!(common::is_valid_boxed_ptr(cloned.as_ptr(), gtype));
}

#[test]
fn as_ptr_returns_correct_pointer() {
    common::ensure_gtk_init();

    let gtype = gdk::RGBA::static_type();
    let ptr = common::allocate_test_boxed(gtype);

    let boxed = Boxed::from_glib_full(Some(gtype), ptr);

    assert_eq!(boxed.as_ptr(), ptr);
}

#[test]
fn drop_frees_owned_memory() {
    common::ensure_gtk_init();

    let gtype = gdk::RGBA::static_type();
    let ptr = common::allocate_test_boxed(gtype);

    let boxed = Boxed::from_glib_full(Some(gtype), ptr);
    drop(boxed);
}

#[test]
fn drop_does_not_free_transfer_none_memory() {
    use std::ffi::c_void;

    struct TestBoxed {
        ptr: *mut c_void,
        ty: Option<glib::Type>,
        is_owned: bool,
    }

    impl Drop for TestBoxed {
        fn drop(&mut self) {
            if self.is_owned && !self.ptr.is_null() {
                unsafe {
                    match self.ty {
                        Some(gtype) => {
                            glib::gobject_ffi::g_boxed_free(gtype.into_glib(), self.ptr);
                        }
                        None => {
                            glib::ffi::g_free(self.ptr);
                        }
                    }
                }
            }
        }
    }

    common::ensure_gtk_init();

    let gtype = gdk::RGBA::static_type();
    let ptr = common::allocate_test_boxed(gtype);

    let boxed = TestBoxed {
        ptr,
        ty: Some(gtype),
        is_owned: false,
    };
    drop(boxed);

    assert!(common::is_valid_boxed_ptr(ptr, gtype));

    unsafe {
        glib::gobject_ffi::g_boxed_free(gtype.into_glib(), ptr);
    }
}

#[test]
fn from_glib_full_none_type_plain_struct() {
    common::ensure_gtk_init();

    let ptr = unsafe { glib::ffi::g_malloc0(16) };

    let boxed = Boxed::from_glib_full(None, ptr);

    assert!(boxed.is_owned());
    assert!(!boxed.as_ptr().is_null());
}

#[test]
fn from_glib_full_none_type_null_ptr() {
    common::ensure_gtk_init();

    let boxed = Boxed::from_glib_full(None, std::ptr::null_mut());

    assert!(boxed.is_owned());
    assert!(boxed.as_ptr().is_null());
}

#[test]
fn drop_plain_struct_uses_g_free() {
    common::ensure_gtk_init();

    let ptr = unsafe { glib::ffi::g_malloc0(32) };

    let boxed = Boxed::from_glib_full(None, ptr);
    drop(boxed);
}

#[test]
fn drop_plain_struct_null_ptr_safe() {
    common::ensure_gtk_init();

    let boxed = Boxed::from_glib_full(None, std::ptr::null_mut());
    drop(boxed);
}

#[test]
fn plain_struct_not_owned_does_not_free() {
    use std::ffi::c_void;

    struct TestBoxed {
        ptr: *mut c_void,
        ty: Option<glib::Type>,
        is_owned: bool,
    }

    impl Drop for TestBoxed {
        fn drop(&mut self) {
            if self.is_owned && !self.ptr.is_null() {
                unsafe {
                    match self.ty {
                        Some(gtype) => {
                            glib::gobject_ffi::g_boxed_free(gtype.into_glib(), self.ptr);
                        }
                        None => {
                            glib::ffi::g_free(self.ptr);
                        }
                    }
                }
            }
        }
    }

    common::ensure_gtk_init();

    let ptr = unsafe { glib::ffi::g_malloc0(16) };

    let boxed = TestBoxed {
        ptr,
        ty: None,
        is_owned: false,
    };
    drop(boxed);

    unsafe {
        glib::ffi::g_free(ptr);
    }
}

#[test]
fn from_glib_none_null_ptr_with_none_type() {
    common::ensure_gtk_init();

    let boxed = Boxed::from_glib_none(None, std::ptr::null_mut())
        .expect("from_glib_none with null ptr should succeed");

    assert!(!boxed.is_owned());
    assert!(boxed.as_ptr().is_null());
}

#[test]
fn as_ptr_returns_ptr_for_plain_struct() {
    common::ensure_gtk_init();

    let ptr = unsafe { glib::ffi::g_malloc0(24) };
    let boxed = Boxed::from_glib_full(None, ptr);

    assert_eq!(boxed.as_ptr(), ptr);
}

#[test]
fn plain_struct_debug_format() {
    common::ensure_gtk_init();

    let ptr = unsafe { glib::ffi::g_malloc0(8) };
    let boxed = Boxed::from_glib_full(None, ptr);

    let debug_str = format!("{boxed:?}");
    assert!(debug_str.contains("Boxed"));
    assert!(debug_str.contains("owned: true"));
}

#[test]
fn clone_without_gtype_returns_non_owned_shallow_copy() {
    common::ensure_gtk_init();

    let ptr = unsafe { glib::ffi::g_malloc0(16) };
    let boxed = Boxed::from_glib_full(None, ptr);

    let cloned = boxed.clone();
    assert_eq!(cloned.as_ptr(), boxed.as_ptr());
    assert!(!cloned.is_owned());
}

mod common;

use gtk4::gdk;
use gtk4::glib;
use gtk4::glib::translate::IntoGlib as _;
use gtk4::prelude::StaticType as _;

use native::Boxed;

#[test]
fn from_glib_full_sets_owned_flag() {
    common::run(|| {
        let gtype = gdk::RGBA::static_type();
        let ptr = common::allocate_test_boxed(gtype);

        let boxed = Boxed::from_glib_full(Some(gtype), ptr);

        assert!(boxed.is_owned());
        assert!(!boxed.as_ptr().is_null());
    });
}

#[test]
fn from_glib_full_null_ptr_safe() {
    common::run(|| {
        let gtype = gdk::RGBA::static_type();
        let boxed = Boxed::from_glib_full(Some(gtype), std::ptr::null_mut());

        assert!(boxed.is_owned());
        assert!(boxed.as_ptr().is_null());
    });
}

#[test]
fn from_glib_none_creates_copy() {
    common::run(|| {
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
    });
}

#[test]
fn from_glib_none_null_ptr_not_owned() {
    common::run(|| {
        let gtype = gdk::RGBA::static_type();
        let boxed = Boxed::from_glib_none(Some(gtype), std::ptr::null_mut())
            .expect("from_glib_none with null ptr should succeed");

        assert!(!boxed.is_owned());
        assert!(boxed.as_ptr().is_null());
    });
}

#[test]
fn from_glib_none_unknown_type_returns_error() {
    common::run(|| {
        let gtype = gdk::RGBA::static_type();
        let ptr = common::allocate_test_boxed(gtype);

        let result = Boxed::from_glib_none(None, ptr);

        assert!(result.is_err());

        unsafe {
            glib::gobject_ffi::g_boxed_free(gtype.into_glib(), ptr);
        }
    });
}

#[test]
fn clone_creates_independent_copy() {
    common::run(|| {
        let gtype = gdk::RGBA::static_type();
        let ptr = common::allocate_test_boxed(gtype);

        let boxed = Boxed::from_glib_full(Some(gtype), ptr);
        let cloned = boxed.clone();

        assert!(cloned.is_owned());
        assert!(!cloned.as_ptr().is_null());
        assert_ne!(cloned.as_ptr(), boxed.as_ptr());

        drop(boxed);

        assert!(common::is_valid_boxed_ptr(cloned.as_ptr(), gtype));
    });
}

#[test]
fn as_ptr_returns_correct_pointer() {
    common::run(|| {
        let gtype = gdk::RGBA::static_type();
        let ptr = common::allocate_test_boxed(gtype);

        let boxed = Boxed::from_glib_full(Some(gtype), ptr);

        assert_eq!(boxed.as_ptr(), ptr);
    });
}

#[test]
fn drop_frees_owned_memory() {
    common::run(|| {
        let gtype = gdk::RGBA::static_type();
        let ptr = common::allocate_test_boxed(gtype);

        let boxed = Boxed::from_glib_full(Some(gtype), ptr);
        drop(boxed);
    });
}

#[test]
fn drop_does_not_free_transfer_none_memory() {
    common::run(|| {
        let gtype = gdk::RGBA::static_type();
        let ptr = common::allocate_test_boxed(gtype);

        let boxed = common::TestBoxed {
            ptr,
            ty: Some(gtype),
            is_owned: false,
        };
        drop(boxed);

        assert!(common::is_valid_boxed_ptr(ptr, gtype));

        unsafe {
            glib::gobject_ffi::g_boxed_free(gtype.into_glib(), ptr);
        }
    });
}

#[test]
fn from_glib_full_none_type_plain_struct() {
    common::run(|| {
        let ptr = unsafe { glib::ffi::g_malloc0(16) };

        let boxed = Boxed::from_glib_full(None, ptr);

        assert!(boxed.is_owned());
        assert!(!boxed.as_ptr().is_null());
    });
}

#[test]
fn from_glib_full_none_type_null_ptr() {
    common::run(|| {
        let boxed = Boxed::from_glib_full(None, std::ptr::null_mut());

        assert!(boxed.is_owned());
        assert!(boxed.as_ptr().is_null());
    });
}

#[test]
fn drop_plain_struct_uses_g_free() {
    common::run(|| {
        let ptr = unsafe { glib::ffi::g_malloc0(32) };

        let boxed = Boxed::from_glib_full(None, ptr);
        drop(boxed);
    });
}

#[test]
fn drop_plain_struct_null_ptr_safe() {
    common::run(|| {
        let boxed = Boxed::from_glib_full(None, std::ptr::null_mut());
        drop(boxed);
    });
}

#[test]
fn plain_struct_not_owned_does_not_free() {
    common::run(|| {
        let ptr = unsafe { glib::ffi::g_malloc0(16) };

        let boxed = common::TestBoxed {
            ptr,
            ty: None,
            is_owned: false,
        };
        drop(boxed);

        unsafe {
            glib::ffi::g_free(ptr);
        }
    });
}

#[test]
fn from_glib_none_null_ptr_with_none_type() {
    common::run(|| {
        let boxed = Boxed::from_glib_none(None, std::ptr::null_mut())
            .expect("from_glib_none with null ptr should succeed");

        assert!(!boxed.is_owned());
        assert!(boxed.as_ptr().is_null());
    });
}

#[test]
fn as_ptr_returns_ptr_for_plain_struct() {
    common::run(|| {
        let ptr = unsafe { glib::ffi::g_malloc0(24) };
        let boxed = Boxed::from_glib_full(None, ptr);

        assert_eq!(boxed.as_ptr(), ptr);
    });
}

#[test]
fn plain_struct_debug_format() {
    common::run(|| {
        let ptr = unsafe { glib::ffi::g_malloc0(8) };
        let boxed = Boxed::from_glib_full(None, ptr);

        let debug_str = format!("{boxed:?}");
        assert!(debug_str.contains("Boxed"));
        assert!(debug_str.contains("owned: true"));
    });
}

#[test]
fn clone_without_gtype_returns_non_owned_shallow_copy() {
    common::run(|| {
        let ptr = unsafe { glib::ffi::g_malloc0(16) };
        let boxed = Boxed::from_glib_full(None, ptr);

        let cloned = boxed.clone();
        assert_eq!(cloned.as_ptr(), boxed.as_ptr());
        assert!(!cloned.is_owned());
    });
}

#[test]
fn clone_null_ptr_with_gtype_stays_null() {
    common::run(|| {
        let gtype = gdk::RGBA::static_type();
        let boxed = Boxed::from_glib_full(Some(gtype), std::ptr::null_mut());

        let cloned = boxed.clone();

        assert!(cloned.as_ptr().is_null());
        assert!(!cloned.is_owned());
        assert_eq!(cloned.gtype(), boxed.gtype());
        assert_eq!(cloned.gtype(), Some(gtype));
    });
}

#[test]
fn clone_null_ptr_without_gtype_stays_null() {
    common::run(|| {
        let boxed = Boxed::from_glib_full(None, std::ptr::null_mut());

        let cloned = boxed.clone();

        assert!(cloned.as_ptr().is_null());
        assert!(!cloned.is_owned());
        assert_eq!(cloned.gtype(), boxed.gtype());
        assert_eq!(cloned.gtype(), None);
    });
}

mod free_fn {
    use std::ffi::c_void;
    use std::sync::atomic::{AtomicPtr, AtomicUsize, Ordering};

    use gtk4::glib;

    use native::Boxed;

    use super::common;

    static FREE_CALLS: AtomicUsize = AtomicUsize::new(0);
    static LAST_FREED_PTR: AtomicPtr<c_void> = AtomicPtr::new(std::ptr::null_mut());

    /// Records each call and `g_free`s the pointer so leak detectors stay
    /// happy. Tests pre-allocate the pointer with `g_malloc0` for this
    /// reason.
    unsafe extern "C" fn record_free(ptr: *mut c_void) {
        FREE_CALLS.fetch_add(1, Ordering::SeqCst);
        LAST_FREED_PTR.store(ptr, Ordering::SeqCst);
        unsafe { glib::ffi::g_free(ptr) };
    }

    fn snapshot() -> (usize, *mut c_void) {
        (
            FREE_CALLS.load(Ordering::SeqCst),
            LAST_FREED_PTR.load(Ordering::SeqCst),
        )
    }

    #[test]
    fn drop_invokes_free_fn_for_owned_boxed() {
        common::run(|| {
            let before = snapshot();
            let ptr = unsafe { glib::ffi::g_malloc0(16) };

            {
                let boxed = Boxed::from_glib_full_with_free_fn(ptr, record_free);
                assert!(boxed.is_owned());
                assert!(boxed.free_fn().is_some());
            }

            let after = snapshot();
            assert_eq!(after.0, before.0 + 1);
            assert_eq!(after.1, ptr);
        });
    }

    #[test]
    fn clone_of_free_fn_boxed_is_non_owning() {
        common::run(|| {
            let ptr = unsafe { glib::ffi::g_malloc0(16) };
            let boxed = Boxed::from_glib_full_with_free_fn(ptr, record_free);

            let before = snapshot();
            let cloned = boxed.clone();

            assert_eq!(cloned.as_ptr(), boxed.as_ptr());
            assert!(!cloned.is_owned());
            // Dropping the non-owning clone must not call the free fn.
            drop(cloned);
            assert_eq!(snapshot().0, before.0);

            // The owning original still runs the destructor exactly once.
            drop(boxed);
            assert_eq!(snapshot().0, before.0 + 1);
        });
    }

    #[test]
    fn null_ptr_free_fn_boxed_skips_destructor() {
        common::run(|| {
            let before = snapshot();
            let boxed = Boxed::from_glib_full_with_free_fn(std::ptr::null_mut(), record_free);
            drop(boxed);
            assert_eq!(snapshot().0, before.0);
        });
    }
}

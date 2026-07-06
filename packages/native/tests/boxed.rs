use test_support as helpers;

use std::ffi::c_void;

use gtk4::gdk;
use gtk4::glib;
use gtk4::glib::translate::IntoGlib as _;
use gtk4::prelude::StaticType as _;

use native::Boxed;

#[test]
fn from_glib_full_sets_owned_flag() {
    helpers::run(|| {
        let (boxed, _ptr) = helpers::owned_rgba_boxed();

        assert!(boxed.is_owned());
        assert!(!boxed.as_ptr().is_null());
        assert_eq!(boxed.type_(), Some(gdk::RGBA::static_type()));
    });
}

#[test]
fn from_glib_full_null_ptr_safe() {
    helpers::run(|| {
        let type_ = gdk::RGBA::static_type();
        let boxed = Boxed::from_glib_full(Some(type_), std::ptr::null_mut());

        assert!(boxed.is_owned());
        assert!(boxed.as_ptr().is_null());
    });
}

#[test]
fn from_glib_none_creates_copy() {
    helpers::run(|| {
        let type_ = gdk::RGBA::static_type();
        let original_ptr = helpers::allocate_test_boxed(type_);

        let boxed = unsafe { Boxed::from_glib_none(Some(type_), original_ptr, None) }
            .expect("from_glib_none with type should succeed");

        assert!(boxed.is_owned());
        assert!(!boxed.as_ptr().is_null());
        assert_ne!(boxed.as_ptr(), original_ptr);
        assert!(helpers::is_valid_boxed_ptr(boxed.as_ptr(), type_));

        unsafe {
            glib::gobject_ffi::g_boxed_free(type_.into_glib(), original_ptr);
        }
    });
}

#[test]
fn copy_with_size_copies_without_type() {
    helpers::run(|| {
        let data: [u8; 16] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
        let ptr = data.as_ptr() as *mut c_void;

        let boxed = Boxed::copy_with_size(ptr, 16);

        assert!(boxed.is_owned());
        assert!(!boxed.as_ptr().is_null());
        assert_ne!(boxed.as_ptr(), ptr);

        let copied = unsafe { std::slice::from_raw_parts(boxed.as_ptr() as *const u8, 16) };
        assert_eq!(copied, &data);
    });
}

#[test]
fn from_glib_none_null_ptr_not_owned() {
    helpers::run(|| {
        let type_ = gdk::RGBA::static_type();
        let boxed = unsafe { Boxed::from_glib_none(Some(type_), std::ptr::null_mut(), None) }
            .expect("from_glib_none with null ptr should succeed");

        assert!(!boxed.is_owned());
        assert!(boxed.as_ptr().is_null());
    });
}

#[test]
fn clone_creates_independent_copy() {
    helpers::run(|| {
        let type_ = gdk::RGBA::static_type();
        let (boxed, _ptr) = helpers::owned_rgba_boxed();

        let cloned = boxed.clone();

        assert!(cloned.is_owned());
        assert!(!cloned.as_ptr().is_null());
        assert_ne!(cloned.as_ptr(), boxed.as_ptr());

        drop(boxed);

        assert!(helpers::is_valid_boxed_ptr(cloned.as_ptr(), type_));
    });
}

#[test]
fn as_ptr_returns_correct_pointer() {
    helpers::run(|| {
        let (boxed, ptr) = helpers::owned_rgba_boxed();

        assert_eq!(boxed.as_ptr(), ptr);
    });
}

#[test]
fn drop_frees_owned_memory() {
    helpers::run(|| {
        let (boxed, _ptr) = helpers::owned_rgba_boxed();
        drop(boxed);
    });
}

#[test]
fn drop_does_not_free_transfer_none_memory() {
    helpers::run(|| {
        let type_ = gdk::RGBA::static_type();
        let ptr = helpers::allocate_test_boxed(type_);

        let boxed = helpers::TestBoxed {
            ptr,
            type_: Some(type_),
            is_owned: false,
        };
        drop(boxed);

        assert!(helpers::is_valid_boxed_ptr(ptr, type_));

        unsafe {
            glib::gobject_ffi::g_boxed_free(type_.into_glib(), ptr);
        }
    });
}

#[test]
fn from_glib_full_none_type_plain_struct() {
    helpers::run(|| {
        let ptr = unsafe { glib::ffi::g_malloc0(16) };

        let boxed = Boxed::from_glib_full(None, ptr);

        assert!(boxed.is_owned());
        assert!(!boxed.as_ptr().is_null());
    });
}

#[test]
fn from_glib_full_none_type_null_ptr() {
    helpers::run(|| {
        let boxed = Boxed::from_glib_full(None, std::ptr::null_mut());

        assert!(boxed.is_owned());
        assert!(boxed.as_ptr().is_null());
    });
}

#[test]
fn drop_plain_struct_uses_g_free() {
    helpers::run(|| {
        let ptr = unsafe { glib::ffi::g_malloc0(32) };

        let boxed = Boxed::from_glib_full(None, ptr);
        drop(boxed);
    });
}

#[test]
fn drop_plain_struct_null_ptr_safe() {
    helpers::run(|| {
        let boxed = Boxed::from_glib_full(None, std::ptr::null_mut());
        drop(boxed);
    });
}
#[test]
fn from_glib_none_null_ptr_with_none_type() {
    helpers::run(|| {
        let boxed = unsafe { Boxed::from_glib_none(None, std::ptr::null_mut(), None) }
            .expect("from_glib_none with null ptr should succeed");

        assert!(!boxed.is_owned());
        assert!(boxed.as_ptr().is_null());
    });
}
#[test]
fn clone_without_type_shares_ownership() {
    helpers::run(|| {
        let ptr = unsafe { glib::ffi::g_malloc0(16) };
        let boxed = Boxed::from_glib_full(None, ptr);

        let cloned = boxed.clone();
        assert_eq!(cloned.as_ptr(), boxed.as_ptr());
        assert!(cloned.is_owned());

        drop(boxed);
        let first_byte = unsafe { *(cloned.as_ptr() as *const u8) };
        assert_eq!(first_byte, 0);
    });
}

fn assert_null_boxed_clone_stays_null(type_: Option<glib::Type>) {
    let boxed = Boxed::from_glib_full(type_, std::ptr::null_mut());

    let cloned = boxed.clone();

    assert!(cloned.as_ptr().is_null());
    assert!(!cloned.is_owned());
    assert_eq!(cloned.type_(), boxed.type_());
    assert_eq!(cloned.type_(), type_);
}

#[test]
fn clone_null_ptr_with_type_stays_null() {
    helpers::run(|| assert_null_boxed_clone_stays_null(Some(gdk::RGBA::static_type())));
}

#[test]
fn clone_null_ptr_without_type_stays_null() {
    helpers::run(|| assert_null_boxed_clone_stays_null(None));
}

mod from_alloc {
    use std::ffi::c_void;
    use std::sync::atomic::{AtomicPtr, AtomicUsize, Ordering};

    use gtk4::glib;

    use native::Boxed;

    use super::helpers;

    static BOXED_FREE_CALLS: AtomicUsize = AtomicUsize::new(0);
    static LAST_BOXED_FREED_PTR: AtomicPtr<c_void> = AtomicPtr::new(std::ptr::null_mut());

    const DEFERRED_ALLOC_SIZE: usize = 16;

    fn deferred_boxed(type_name: &str) -> (Boxed, *mut c_void) {
        let ptr = unsafe { glib::ffi::g_malloc0(DEFERRED_ALLOC_SIZE) };
        let name = glib::GString::from(type_name);
        assert!(glib::Type::from_name(name.as_str()).is_none());

        let boxed = Boxed::from_alloc(Some(name), ptr);

        assert!(boxed.is_owned());
        assert_eq!(boxed.as_ptr(), ptr);
        assert_eq!(boxed.type_(), None);
        (boxed, ptr)
    }

    unsafe extern "C" fn late_boxed_copy(ptr: *mut c_void) -> *mut c_void {
        unsafe {
            let dest = glib::ffi::g_malloc(DEFERRED_ALLOC_SIZE);
            std::ptr::copy_nonoverlapping(ptr as *const u8, dest as *mut u8, DEFERRED_ALLOC_SIZE);
            dest
        }
    }

    unsafe extern "C" fn late_boxed_free(ptr: *mut c_void) {
        BOXED_FREE_CALLS.fetch_add(1, Ordering::SeqCst);
        LAST_BOXED_FREED_PTR.store(ptr, Ordering::SeqCst);
        unsafe { glib::ffi::g_free(ptr) };
    }

    #[test]
    fn unregistered_name_defers_destructor_and_g_frees() {
        helpers::run(|| {
            let (boxed, _ptr) = deferred_boxed("GtkxTestNeverRegisteredBoxed");

            drop(boxed);
            assert!(glib::Type::from_name("GtkxTestNeverRegisteredBoxed").is_none());
        });
    }

    #[test]
    fn missing_name_binds_plain_g_free_cleanup() {
        helpers::run(|| {
            let ptr = unsafe { glib::ffi::g_malloc0(DEFERRED_ALLOC_SIZE) };
            let boxed = Boxed::from_alloc(None, ptr);
            assert!(boxed.is_owned());
            assert_eq!(boxed.as_ptr(), ptr);
            assert_eq!(boxed.type_(), None);
        });
    }

    #[test]
    fn registered_name_binds_boxed_semantics_immediately() {
        helpers::run(|| {
            use gtk4::prelude::StaticType as _;

            let type_ = gtk4::gdk::RGBA::static_type();
            let ptr = helpers::allocate_test_boxed(type_);
            let boxed = Boxed::from_alloc(Some(glib::GString::from(type_.name())), ptr);
            assert!(boxed.is_owned());
            assert_eq!(boxed.type_(), Some(type_));
        });
    }

    #[test]
    fn name_registered_by_release_time_uses_g_boxed_free() {
        helpers::run(|| {
            let (boxed, ptr) = deferred_boxed("GtkxTestLateRegisteredBoxed");

            let registered = unsafe {
                glib::gobject_ffi::g_boxed_type_register_static(
                    c"GtkxTestLateRegisteredBoxed".as_ptr(),
                    Some(late_boxed_copy),
                    Some(late_boxed_free),
                )
            };
            assert_ne!(registered, 0);
            assert!(glib::Type::from_name("GtkxTestLateRegisteredBoxed").is_some());

            let calls_before = BOXED_FREE_CALLS.load(Ordering::SeqCst);
            drop(boxed);

            assert_eq!(BOXED_FREE_CALLS.load(Ordering::SeqCst), calls_before + 1);
            assert_eq!(LAST_BOXED_FREED_PTR.load(Ordering::SeqCst), ptr);
        });
    }
}

mod free_fn {
    use std::ffi::c_void;
    use std::sync::atomic::{AtomicPtr, AtomicUsize, Ordering};

    use gtk4::glib;

    use native::Boxed;

    use super::helpers;

    static FREE_CALLS: AtomicUsize = AtomicUsize::new(0);
    static LAST_FREED_PTR: AtomicPtr<c_void> = AtomicPtr::new(std::ptr::null_mut());

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
        helpers::run(|| {
            let before = snapshot();
            let ptr = unsafe { glib::ffi::g_malloc0(16) };

            {
                let boxed = Boxed::from_glib_full_with_free_fn(ptr, record_free);
                assert!(boxed.is_owned());
            }

            let after = snapshot();
            assert_eq!(after.0, before.0 + 1);
            assert_eq!(after.1, ptr);
        });
    }

    #[test]
    fn clone_of_free_fn_boxed_shares_ownership() {
        helpers::run(|| {
            let ptr = unsafe { glib::ffi::g_malloc0(16) };
            let boxed = Boxed::from_glib_full_with_free_fn(ptr, record_free);

            let before = snapshot();
            let cloned = boxed.clone();

            assert_eq!(cloned.as_ptr(), boxed.as_ptr());
            assert!(cloned.is_owned());

            drop(boxed);
            assert_eq!(snapshot().0, before.0);

            drop(cloned);
            assert_eq!(snapshot().0, before.0 + 1);
        });
    }

    #[test]
    fn null_ptr_free_fn_boxed_skips_destructor() {
        helpers::run(|| {
            let before = snapshot();
            let boxed = Boxed::from_glib_full_with_free_fn(std::ptr::null_mut(), record_free);
            drop(boxed);
            assert_eq!(snapshot().0, before.0);
        });
    }
}

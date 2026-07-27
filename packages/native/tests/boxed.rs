use test_support as helpers;

use gtk4::gdk;
use gtk4::glib;
use gtk4::glib::translate::IntoGlib as _;
use gtk4::prelude::StaticType as _;

use native::Boxed;

#[test]
fn from_glib_full_records_pointer_and_type() {
    helpers::run(|| {
        let (boxed, _ptr) = helpers::owned_rgba_boxed();

        assert!(!boxed.as_ptr().is_null());
        assert_eq!(boxed.type_(), Some(gdk::RGBA::static_type()));
    });
}

#[test]
fn from_glib_full_null_ptr_safe() {
    helpers::run(|| {
        let type_ = gdk::RGBA::static_type();
        let boxed = Boxed::from_glib_full(type_, std::ptr::null_mut());

        assert!(boxed.as_ptr().is_null());
    });
}

#[test]
fn from_glib_none_creates_copy() {
    helpers::run(|| {
        let type_ = gdk::RGBA::static_type();
        let original_ptr = helpers::allocate_test_boxed(type_);

        let boxed = unsafe { Boxed::from_glib_none(type_, original_ptr) };

        assert!(!boxed.as_ptr().is_null());
        assert_ne!(boxed.as_ptr(), original_ptr);
        assert!(unsafe { helpers::is_valid_boxed_ptr(boxed.as_ptr(), type_) });

        unsafe {
            glib::gobject_ffi::g_boxed_free(type_.into_glib(), original_ptr);
        }
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

        let boxed = unsafe { helpers::TestBoxed::new(ptr, Some(type_), false) };
        drop(boxed);

        assert!(unsafe { helpers::is_valid_boxed_ptr(ptr, type_) });

        unsafe {
            glib::gobject_ffi::g_boxed_free(type_.into_glib(), ptr);
        }
    });
}

mod boxed_free_dispatch {
    use std::ffi::c_void;
    use std::sync::atomic::{AtomicPtr, AtomicUsize, Ordering};

    use gtk4::glib;
    use gtk4::glib::translate::FromGlib as _;

    use native::Boxed;

    use super::helpers;

    static BOXED_FREE_CALLS: AtomicUsize = AtomicUsize::new(0);
    static LAST_BOXED_FREED_PTR: AtomicPtr<c_void> = AtomicPtr::new(std::ptr::null_mut());

    const ALLOC_SIZE: usize = 16;

    unsafe extern "C" fn counting_boxed_copy(ptr: *mut c_void) -> *mut c_void {
        unsafe {
            let dest = glib::ffi::g_malloc(ALLOC_SIZE);
            std::ptr::copy_nonoverlapping(
                ptr.cast_const().cast::<u8>(),
                dest.cast::<u8>(),
                ALLOC_SIZE,
            );
            dest
        }
    }

    unsafe extern "C" fn counting_boxed_free(ptr: *mut c_void) {
        BOXED_FREE_CALLS.fetch_add(1, Ordering::SeqCst);
        LAST_BOXED_FREED_PTR.store(ptr, Ordering::SeqCst);
        unsafe { glib::ffi::g_free(ptr) };
    }

    #[test]
    fn drop_invokes_the_registered_boxed_free_function() {
        helpers::run(|| {
            let registered = unsafe {
                glib::gobject_ffi::g_boxed_type_register_static(
                    c"GtkxTestCountingBoxed".as_ptr(),
                    Some(counting_boxed_copy),
                    Some(counting_boxed_free),
                )
            };
            assert_ne!(registered, 0);
            let type_ = unsafe { glib::Type::from_glib(registered) };

            let ptr = unsafe { glib::ffi::g_malloc0(ALLOC_SIZE) };
            let boxed = Boxed::from_glib_full(type_, ptr);
            assert_eq!(boxed.type_(), Some(type_));

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
                assert!(!boxed.as_ptr().is_null());
            }

            let after = snapshot();
            assert_eq!(after.0, before.0 + 1);
            assert_eq!(after.1, ptr);
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

mod common;

use gtk4::gdk;
use gtk4::glib;
use gtk4::glib::translate::IntoGlib as _;
use gtk4::prelude::StaticType as _;

use native::Boxed;

#[test]
fn from_glib_full_sets_owned_flag() {
    common::run(|| {
        let (boxed, _ptr) = common::owned_rgba_boxed();

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

        // SAFETY: `original_ptr` is the live boxed value of `gtype` allocated above and not consumed
        // (the wrapper copied it), so freeing it once with the matching gtype is sound.
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
fn clone_creates_independent_copy() {
    common::run(|| {
        let gtype = gdk::RGBA::static_type();
        let (boxed, _ptr) = common::owned_rgba_boxed();

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
        let (boxed, ptr) = common::owned_rgba_boxed();

        assert_eq!(boxed.as_ptr(), ptr);
    });
}

#[test]
fn drop_frees_owned_memory() {
    common::run(|| {
        let (boxed, _ptr) = common::owned_rgba_boxed();
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

        // SAFETY: the unowned `TestBoxed` drop did not free `ptr`, so it is still a live boxed value
        // of `gtype`; freeing it once here with the matching gtype is sound.
        unsafe {
            glib::gobject_ffi::g_boxed_free(gtype.into_glib(), ptr);
        }
    });
}

#[test]
fn from_glib_full_none_type_plain_struct() {
    common::run(|| {
        // SAFETY: `g_malloc0` with a non-zero size returns a freshly allocated, zeroed,
        // uniquely owned block that the wrapper under test takes ownership of and frees.
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
        // SAFETY: `g_malloc0` with a non-zero size returns a freshly allocated, zeroed,
        // uniquely owned block that the wrapper under test takes ownership of and frees.
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
        // SAFETY: `g_malloc0` with a non-zero size returns a freshly allocated, zeroed,
        // uniquely owned block that the wrapper under test takes ownership of and frees.
        let ptr = unsafe { glib::ffi::g_malloc0(16) };

        let boxed = common::TestBoxed {
            ptr,
            ty: None,
            is_owned: false,
        };
        drop(boxed);

        // SAFETY: the unowned `TestBoxed` drop did not free `ptr`, so it is still the live
        // `g_malloc0`-ed block; `g_free` releases it exactly once.
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
        // SAFETY: `g_malloc0` with a non-zero size returns a freshly allocated, zeroed,
        // uniquely owned block that the wrapper under test takes ownership of and frees.
        let ptr = unsafe { glib::ffi::g_malloc0(24) };
        let boxed = Boxed::from_glib_full(None, ptr);

        assert_eq!(boxed.as_ptr(), ptr);
    });
}

#[test]
fn clone_without_gtype_shares_ownership() {
    common::run(|| {
        // SAFETY: `g_malloc0` with a non-zero size returns a freshly allocated, zeroed,
        // uniquely owned block that the wrapper under test takes ownership of and frees.
        let ptr = unsafe { glib::ffi::g_malloc0(16) };
        let boxed = Boxed::from_glib_full(None, ptr);

        let cloned = boxed.clone();
        assert_eq!(cloned.as_ptr(), boxed.as_ptr());
        assert!(cloned.is_owned());

        drop(boxed);
        // SAFETY: the no-gtype clone shares ownership of the still-live `g_malloc0`-ed block, so
        // `cloned.as_ptr()` is non-null and addresses at least one readable, zeroed byte.
        let first_byte = unsafe { *(cloned.as_ptr() as *const u8) };
        assert_eq!(first_byte, 0);
    });
}

fn assert_null_boxed_clone_stays_null(gtype: Option<glib::Type>) {
    let boxed = Boxed::from_glib_full(gtype, std::ptr::null_mut());

    let cloned = boxed.clone();

    assert!(cloned.as_ptr().is_null());
    assert!(!cloned.is_owned());
    assert_eq!(cloned.gtype(), boxed.gtype());
    assert_eq!(cloned.gtype(), gtype);
}

#[test]
fn clone_null_ptr_with_gtype_stays_null() {
    common::run(|| assert_null_boxed_clone_stays_null(Some(gdk::RGBA::static_type())));
}

#[test]
fn clone_null_ptr_without_gtype_stays_null() {
    common::run(|| assert_null_boxed_clone_stays_null(None));
}

mod from_alloc {
    use std::ffi::c_void;
    use std::sync::atomic::{AtomicPtr, AtomicUsize, Ordering};

    use gtk4::glib;

    use native::Boxed;

    use super::common;

    static BOXED_FREE_CALLS: AtomicUsize = AtomicUsize::new(0);
    static LAST_BOXED_FREED_PTR: AtomicPtr<c_void> = AtomicPtr::new(std::ptr::null_mut());

    const DEFERRED_ALLOC_SIZE: usize = 16;

    fn deferred_boxed(type_name: &str) -> (Boxed, *mut c_void) {
        // SAFETY: `g_malloc0` with a non-zero size returns a freshly allocated, zeroed,
        // uniquely owned block that the wrapper under test takes ownership of and frees.
        let ptr = unsafe { glib::ffi::g_malloc0(DEFERRED_ALLOC_SIZE) };
        let name = glib::GString::from(type_name);
        assert!(glib::Type::from_name(name.as_str()).is_none());

        let boxed = Boxed::from_alloc(Some(name), ptr);

        assert!(boxed.is_owned());
        assert_eq!(boxed.as_ptr(), ptr);
        assert_eq!(boxed.gtype(), None);
        (boxed, ptr)
    }

    /// `GBoxed` copy function registered for the late-registered test type.
    ///
    /// # Safety
    ///
    /// Called by `GObject`'s boxed machinery with `ptr` pointing to a live boxed value of at least
    /// `DEFERRED_ALLOC_SIZE` bytes; it returns a freshly `g_malloc`-ed independent copy.
    unsafe extern "C" fn late_boxed_copy(ptr: *mut c_void) -> *mut c_void {
        // SAFETY: `g_malloc` returns a fresh `DEFERRED_ALLOC_SIZE` block, and `ptr` (per the
        // contract) addresses at least that many readable bytes, so the non-overlapping copy of
        // exactly `DEFERRED_ALLOC_SIZE` bytes between the two distinct blocks is in bounds.
        unsafe {
            let dest = glib::ffi::g_malloc(DEFERRED_ALLOC_SIZE);
            std::ptr::copy_nonoverlapping(ptr as *const u8, dest as *mut u8, DEFERRED_ALLOC_SIZE);
            dest
        }
    }

    /// `GBoxed` free function registered for the late-registered test type.
    ///
    /// # Safety
    ///
    /// Called by `GObject`'s boxed machinery with `ptr` owning a live boxed value previously produced
    /// by [`late_boxed_copy`]; it records the call and frees the block exactly once.
    unsafe extern "C" fn late_boxed_free(ptr: *mut c_void) {
        BOXED_FREE_CALLS.fetch_add(1, Ordering::SeqCst);
        LAST_BOXED_FREED_PTR.store(ptr, Ordering::SeqCst);
        // SAFETY: `ptr` is the owned boxed value passed by GObject; `g_free` releases the
        // `g_malloc`-ed block exactly once.
        unsafe { glib::ffi::g_free(ptr) };
    }

    #[test]
    fn unregistered_name_defers_destructor_and_g_frees() {
        common::run(|| {
            let (boxed, _ptr) = deferred_boxed("GtkxTestNeverRegisteredBoxed");
            assert!(boxed.free_fn().is_none());

            drop(boxed);
            assert!(glib::Type::from_name("GtkxTestNeverRegisteredBoxed").is_none());
        });
    }

    #[test]
    fn missing_name_binds_plain_g_free_cleanup() {
        common::run(|| {
            // SAFETY: `g_malloc0` with a non-zero size returns a freshly allocated, zeroed,
            // uniquely owned block that the wrapper under test takes ownership of and frees.
            let ptr = unsafe { glib::ffi::g_malloc0(DEFERRED_ALLOC_SIZE) };
            let boxed = Boxed::from_alloc(None, ptr);
            assert!(boxed.is_owned());
            assert_eq!(boxed.as_ptr(), ptr);
            assert_eq!(boxed.gtype(), None);
        });
    }

    #[test]
    fn registered_name_binds_boxed_semantics_immediately() {
        common::run(|| {
            use gtk4::prelude::StaticType as _;

            let gtype = gtk4::gdk::RGBA::static_type();
            let ptr = common::allocate_test_boxed(gtype);
            let boxed = Boxed::from_alloc(Some(glib::GString::from(gtype.name())), ptr);
            assert!(boxed.is_owned());
            assert_eq!(boxed.gtype(), Some(gtype));
        });
    }

    #[test]
    fn name_registered_by_release_time_uses_g_boxed_free() {
        common::run(|| {
            let (boxed, ptr) = deferred_boxed("GtkxTestLateRegisteredBoxed");

            // SAFETY: `c"GtkxTestLateRegisteredBoxed"` is a valid NUL-terminated C string and the
            // two callbacks have the required copy/free signatures, so registering this boxed type
            // is sound; the type name was asserted unregistered by `deferred_boxed`.
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

    use super::common;

    static FREE_CALLS: AtomicUsize = AtomicUsize::new(0);
    static LAST_FREED_PTR: AtomicPtr<c_void> = AtomicPtr::new(std::ptr::null_mut());

    /// Free function passed to `Boxed::from_glib_full_with_free_fn` in these tests.
    ///
    /// # Safety
    ///
    /// Invoked by the `Boxed` wrapper on drop with `ptr` owning a live `g_malloc`-ed block; it
    /// records the call and frees the block exactly once.
    unsafe extern "C" fn record_free(ptr: *mut c_void) {
        FREE_CALLS.fetch_add(1, Ordering::SeqCst);
        LAST_FREED_PTR.store(ptr, Ordering::SeqCst);
        // SAFETY: `ptr` is the owned block handed over by the `Boxed` wrapper; `g_free` releases it
        // exactly once.
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
            // SAFETY: `g_malloc0` with a non-zero size returns a freshly allocated, zeroed,
            // uniquely owned block that the wrapper under test takes ownership of and frees.
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
    fn clone_of_free_fn_boxed_shares_ownership() {
        common::run(|| {
            // SAFETY: `g_malloc0` with a non-zero size returns a freshly allocated, zeroed,
            // uniquely owned block that the wrapper under test takes ownership of and frees.
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
        common::run(|| {
            let before = snapshot();
            let boxed = Boxed::from_glib_full_with_free_fn(std::ptr::null_mut(), record_free);
            drop(boxed);
            assert_eq!(snapshot().0, before.0);
        });
    }
}

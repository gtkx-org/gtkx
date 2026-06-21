mod common;

use std::ffi::c_void;

use gtk4::glib;

use native::managed::Fundamental;

use common::{param_spec_ref, param_spec_refcount, param_spec_unref};

fn create_param_spec() -> *mut c_void {
    common::ensure_gtk_init();

    // SAFETY: GTK is initialized above; the four `c"..."` literals are valid NUL-terminated C
    // strings and the flags are valid `GParamFlags`, so `g_param_spec_boolean` returns a freshly
    // owned (floating) GParamSpec.
    unsafe {
        let param = glib::gobject_ffi::g_param_spec_boolean(
            c"test-param".as_ptr(),
            c"Test".as_ptr(),
            c"A test parameter".as_ptr(),
            glib::ffi::GFALSE,
            glib::gobject_ffi::G_PARAM_READABLE,
        );
        param as *mut c_void
    }
}

fn ref_after_extra_ref_and_scoped_full(
    ptr: *mut c_void,
    unref: Option<unsafe extern "C" fn(*mut c_void)>,
) -> u32 {
    // SAFETY: `ptr` is the live GParamSpec created by `create_param_spec`; taking one extra
    // reference is balanced by the scoped `Fundamental` drop (and the caller's later unref).
    unsafe { glib::gobject_ffi::g_param_spec_ref(ptr as *mut _) };
    let ref_after_extra = param_spec_refcount(ptr);

    {
        let _fundamental = Fundamental::from_glib_full(ptr, Some(param_spec_ref), unref);
        assert_eq!(param_spec_refcount(ptr), ref_after_extra);
    }

    ref_after_extra
}

#[test]
fn from_glib_full_takes_ownership() {
    let ptr = create_param_spec();
    let initial_ref = param_spec_refcount(ptr);

    let fundamental =
        Fundamental::from_glib_full(ptr, Some(param_spec_ref), Some(param_spec_unref));

    assert!(fundamental.is_owned());
    assert_eq!(fundamental.as_ptr(), ptr);
    assert_eq!(param_spec_refcount(ptr), initial_ref);
}

#[test]
fn from_glib_full_drop_calls_unref() {
    let ptr = create_param_spec();

    let ref_after_extra = ref_after_extra_ref_and_scoped_full(ptr, Some(param_spec_unref));

    let ref_after_drop = param_spec_refcount(ptr);
    assert_eq!(ref_after_drop, ref_after_extra - 1);

    // SAFETY: `ptr` is the still-live GParamSpec; this releases its last remaining reference.
    unsafe { glib::gobject_ffi::g_param_spec_unref(ptr as *mut _) };
}

#[test]
fn from_glib_none_refs_pointer() {
    let ptr = create_param_spec();
    let initial_ref = param_spec_refcount(ptr);

    // SAFETY: `ptr` is the live GParamSpec, and `param_spec_ref`/`param_spec_unref` are its
    // matching ref/unref pair; `from_glib_none` takes one new borrowed reference balanced by drop.
    let fundamental =
        unsafe { Fundamental::from_glib_none(ptr, Some(param_spec_ref), Some(param_spec_unref)) };

    assert!(fundamental.is_owned());
    assert_eq!(fundamental.as_ptr(), ptr);
    assert_eq!(param_spec_refcount(ptr), initial_ref + 1);

    drop(fundamental);

    assert_eq!(param_spec_refcount(ptr), initial_ref);

    // SAFETY: `ptr` is the still-live GParamSpec; this releases its original reference.
    unsafe { glib::gobject_ffi::g_param_spec_unref(ptr as *mut _) };
}

#[test]
fn from_glib_none_null_ptr_safe() {
    // SAFETY: `from_glib_none` tolerates a null pointer, producing an unowned, null wrapper
    // without dereferencing or calling the ref function.
    let fundamental: Fundamental = unsafe {
        Fundamental::from_glib_none(
            std::ptr::null_mut(),
            Some(param_spec_ref),
            Some(param_spec_unref),
        )
    };

    assert!(!fundamental.is_owned());
    assert!(fundamental.as_ptr().is_null());
}

#[test]
fn clone_increases_refcount() {
    let ptr = create_param_spec();
    let initial_ref = param_spec_refcount(ptr);

    let fundamental =
        Fundamental::from_glib_full(ptr, Some(param_spec_ref), Some(param_spec_unref));

    let cloned = fundamental.clone();

    assert_eq!(param_spec_refcount(ptr), initial_ref + 1);
    assert_eq!(cloned.as_ptr(), ptr);

    drop(cloned);
    assert_eq!(param_spec_refcount(ptr), initial_ref);

    drop(fundamental);
}

#[test]
fn clone_null_ptr_safe() {
    // SAFETY: `from_glib_none` tolerates a null pointer, producing an unowned, null wrapper
    // without dereferencing or calling the ref function.
    let fundamental: Fundamental = unsafe {
        Fundamental::from_glib_none(
            std::ptr::null_mut(),
            Some(param_spec_ref),
            Some(param_spec_unref),
        )
    };

    let cloned = fundamental.clone();

    assert!(cloned.as_ptr().is_null());
    assert!(!cloned.is_owned());
    assert!(fundamental.as_ptr().is_null());
}

#[test]
fn drop_without_unref_fn_does_not_crash() {
    let ptr = create_param_spec();

    let ref_after_extra = ref_after_extra_ref_and_scoped_full(ptr, None);

    assert_eq!(param_spec_refcount(ptr), ref_after_extra);

    // SAFETY: `ptr` is the still-live GParamSpec carrying two references (the original plus the
    // extra one taken in the helper, since the no-unref `Fundamental` drop released neither); both
    // are released here to balance the count.
    unsafe {
        glib::gobject_ffi::g_param_spec_unref(ptr as *mut _);
        glib::gobject_ffi::g_param_spec_unref(ptr as *mut _);
    };
}

#[test]
fn from_glib_none_without_ref_fn_does_not_ref() {
    let ptr = create_param_spec();
    let initial_ref = param_spec_refcount(ptr);

    // SAFETY: `ptr` is the live GParamSpec; with no ref function, `from_glib_none` records an
    // unowned wrapper without taking a reference, so the count is unchanged.
    let fundamental = unsafe { Fundamental::from_glib_none(ptr, None, Some(param_spec_unref)) };

    assert!(!fundamental.is_owned());
    assert_eq!(param_spec_refcount(ptr), initial_ref);

    drop(fundamental);
    assert_eq!(param_spec_refcount(ptr), initial_ref);

    // SAFETY: `ptr` is the still-live GParamSpec; this releases its original reference.
    unsafe { glib::gobject_ffi::g_param_spec_unref(ptr as *mut _) };
}

#[test]
fn multiple_clones_maintain_correct_refcount() {
    let ptr = create_param_spec();
    let initial_ref = param_spec_refcount(ptr);

    let fundamental =
        Fundamental::from_glib_full(ptr, Some(param_spec_ref), Some(param_spec_unref));
    assert_eq!(param_spec_refcount(ptr), initial_ref);

    let clone1 = fundamental.clone();
    assert_eq!(param_spec_refcount(ptr), initial_ref + 1);

    let clone2 = fundamental.clone();
    assert_eq!(param_spec_refcount(ptr), initial_ref + 2);

    let clone3 = clone1.clone();
    assert_eq!(param_spec_refcount(ptr), initial_ref + 3);

    drop(clone3);
    assert_eq!(param_spec_refcount(ptr), initial_ref + 2);

    drop(clone2);
    assert_eq!(param_spec_refcount(ptr), initial_ref + 1);

    drop(clone1);
    assert_eq!(param_spec_refcount(ptr), initial_ref);

    drop(fundamental);
}

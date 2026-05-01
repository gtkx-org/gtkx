mod common;

use std::ffi::c_void;

use gtk4::glib;

use native::managed::Fundamental;

fn create_param_spec() -> *mut c_void {
    common::ensure_gtk_init();

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

fn get_param_spec_refcount(ptr: *mut c_void) -> u32 {
    if ptr.is_null() {
        return 0;
    }
    unsafe {
        let param = ptr as *mut glib::gobject_ffi::GParamSpec;
        (*param).ref_count
    }
}

unsafe extern "C" fn param_spec_ref(ptr: *mut c_void) -> *mut c_void {
    unsafe {
        glib::gobject_ffi::g_param_spec_ref(ptr as *mut glib::gobject_ffi::GParamSpec)
            as *mut c_void
    }
}

unsafe extern "C" fn param_spec_unref(ptr: *mut c_void) {
    unsafe {
        glib::gobject_ffi::g_param_spec_unref(ptr as *mut glib::gobject_ffi::GParamSpec);
    }
}

#[test]
fn from_glib_full_takes_ownership() {
    let ptr = create_param_spec();
    let initial_ref = get_param_spec_refcount(ptr);

    let fundamental =
        Fundamental::from_glib_full(ptr, Some(param_spec_ref), Some(param_spec_unref));

    assert!(fundamental.is_owned());
    assert_eq!(fundamental.as_ptr(), ptr);
    assert_eq!(get_param_spec_refcount(ptr), initial_ref);
}

#[test]
fn from_glib_full_drop_calls_unref() {
    let ptr = create_param_spec();

    unsafe { glib::gobject_ffi::g_param_spec_ref(ptr as *mut _) };
    let ref_after_extra = get_param_spec_refcount(ptr);

    {
        let _fundamental =
            Fundamental::from_glib_full(ptr, Some(param_spec_ref), Some(param_spec_unref));
        assert_eq!(get_param_spec_refcount(ptr), ref_after_extra);
    }

    let ref_after_drop = get_param_spec_refcount(ptr);
    assert_eq!(ref_after_drop, ref_after_extra - 1);

    unsafe { glib::gobject_ffi::g_param_spec_unref(ptr as *mut _) };
}

#[test]
fn from_glib_none_refs_pointer() {
    let ptr = create_param_spec();
    let initial_ref = get_param_spec_refcount(ptr);

    let fundamental =
        unsafe { Fundamental::from_glib_none(ptr, Some(param_spec_ref), Some(param_spec_unref)) };

    assert!(fundamental.is_owned());
    assert_eq!(fundamental.as_ptr(), ptr);
    assert_eq!(get_param_spec_refcount(ptr), initial_ref + 1);

    drop(fundamental);

    assert_eq!(get_param_spec_refcount(ptr), initial_ref);

    unsafe { glib::gobject_ffi::g_param_spec_unref(ptr as *mut _) };
}

#[test]
fn from_glib_none_null_ptr_safe() {
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
    let initial_ref = get_param_spec_refcount(ptr);

    let fundamental =
        Fundamental::from_glib_full(ptr, Some(param_spec_ref), Some(param_spec_unref));

    let cloned = fundamental.clone();

    assert_eq!(get_param_spec_refcount(ptr), initial_ref + 1);
    assert_eq!(cloned.as_ptr(), ptr);

    drop(cloned);
    assert_eq!(get_param_spec_refcount(ptr), initial_ref);

    drop(fundamental);
}

#[test]
fn clone_null_ptr_safe() {
    let fundamental: Fundamental = unsafe {
        Fundamental::from_glib_none(
            std::ptr::null_mut(),
            Some(param_spec_ref),
            Some(param_spec_unref),
        )
    };

    let cloned = fundamental;

    assert!(cloned.as_ptr().is_null());
}

#[test]
fn drop_without_unref_fn_does_not_crash() {
    let ptr = create_param_spec();

    unsafe { glib::gobject_ffi::g_param_spec_ref(ptr as *mut _) };
    let ref_after_extra = get_param_spec_refcount(ptr);

    {
        let _fundamental = Fundamental::from_glib_full(ptr, Some(param_spec_ref), None);
        assert_eq!(get_param_spec_refcount(ptr), ref_after_extra);
    }

    assert_eq!(get_param_spec_refcount(ptr), ref_after_extra);

    unsafe {
        glib::gobject_ffi::g_param_spec_unref(ptr as *mut _);
        glib::gobject_ffi::g_param_spec_unref(ptr as *mut _);
    };
}

#[test]
fn from_glib_none_without_ref_fn_does_not_ref() {
    let ptr = create_param_spec();
    let initial_ref = get_param_spec_refcount(ptr);

    let fundamental = unsafe { Fundamental::from_glib_none(ptr, None, Some(param_spec_unref)) };

    assert!(fundamental.is_owned());
    assert_eq!(get_param_spec_refcount(ptr), initial_ref);

    std::mem::forget(fundamental);

    unsafe { glib::gobject_ffi::g_param_spec_unref(ptr as *mut _) };
}

#[test]
fn multiple_clones_maintain_correct_refcount() {
    let ptr = create_param_spec();
    let initial_ref = get_param_spec_refcount(ptr);

    let fundamental =
        Fundamental::from_glib_full(ptr, Some(param_spec_ref), Some(param_spec_unref));
    assert_eq!(get_param_spec_refcount(ptr), initial_ref);

    let clone1 = fundamental.clone();
    assert_eq!(get_param_spec_refcount(ptr), initial_ref + 1);

    let clone2 = fundamental.clone();
    assert_eq!(get_param_spec_refcount(ptr), initial_ref + 2);

    let clone3 = clone1.clone();
    assert_eq!(get_param_spec_refcount(ptr), initial_ref + 3);

    drop(clone3);
    assert_eq!(get_param_spec_refcount(ptr), initial_ref + 2);

    drop(clone2);
    assert_eq!(get_param_spec_refcount(ptr), initial_ref + 1);

    drop(clone1);
    assert_eq!(get_param_spec_refcount(ptr), initial_ref);

    drop(fundamental);
}

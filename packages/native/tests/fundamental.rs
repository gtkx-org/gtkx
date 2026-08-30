use std::ffi::c_void;

use gtk4::glib;
use helpers::{
    make_bool_param_spec as create_param_spec, param_spec_ref, param_spec_refcount,
    param_spec_unref,
};
use native::handle::Fundamental;
use test_support as helpers;

fn ref_after_extra_ref_and_scoped_full(
    ptr: *mut c_void,
    unref: Option<unsafe extern "C" fn(*mut c_void)>,
) -> u32 {
    unsafe { param_spec_ref(ptr) };
    let ref_after_extra = unsafe { param_spec_refcount(ptr) };

    {
        let _fundamental = unsafe { Fundamental::from_glib_full(ptr, unref) };
        assert_eq!(unsafe { param_spec_refcount(ptr) }, ref_after_extra);
    }

    ref_after_extra
}

#[test]
fn from_glib_full_takes_ownership() {
    let ptr = create_param_spec();
    let initial_ref = unsafe { param_spec_refcount(ptr) };

    let fundamental = unsafe { Fundamental::from_glib_full(ptr, Some(param_spec_unref)) };

    assert_eq!(fundamental.as_ptr(), ptr);
    assert_eq!(unsafe { param_spec_refcount(ptr) }, initial_ref);
}

#[test]
fn from_glib_full_drop_calls_unref() {
    let ptr = create_param_spec();

    let ref_after_extra = ref_after_extra_ref_and_scoped_full(ptr, Some(param_spec_unref));

    let ref_after_drop = unsafe { param_spec_refcount(ptr) };
    assert_eq!(ref_after_drop, ref_after_extra - 1);

    unsafe { param_spec_unref(ptr) };
}

#[test]
fn from_glib_none_refs_pointer() {
    let ptr = create_param_spec();
    let initial_ref = unsafe { param_spec_refcount(ptr) };

    let fundamental =
        unsafe { Fundamental::from_glib_none(ptr, Some(param_spec_ref), Some(param_spec_unref)) };

    assert_eq!(fundamental.as_ptr(), ptr);
    assert_eq!(unsafe { param_spec_refcount(ptr) }, initial_ref + 1);

    drop(fundamental);

    assert_eq!(unsafe { param_spec_refcount(ptr) }, initial_ref);

    unsafe { param_spec_unref(ptr) };
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

    assert!(fundamental.as_ptr().is_null());
}

#[test]
fn drop_without_unref_fn_does_not_crash() {
    let ptr = create_param_spec();

    let ref_after_extra = ref_after_extra_ref_and_scoped_full(ptr, None);

    assert_eq!(unsafe { param_spec_refcount(ptr) }, ref_after_extra);

    unsafe {
        glib::gobject_ffi::g_param_spec_unref(ptr.cast());
        glib::gobject_ffi::g_param_spec_unref(ptr.cast());
    };
}

#[test]
fn from_glib_none_without_ref_fn_does_not_ref() {
    let ptr = create_param_spec();
    let initial_ref = unsafe { param_spec_refcount(ptr) };

    let fundamental = unsafe { Fundamental::from_glib_none(ptr, None, Some(param_spec_unref)) };

    assert_eq!(unsafe { param_spec_refcount(ptr) }, initial_ref);

    drop(fundamental);
    assert_eq!(unsafe { param_spec_refcount(ptr) }, initial_ref);

    unsafe { param_spec_unref(ptr) };
}

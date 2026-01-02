use std::sync::Once;

use gtk4::gdk;
use gtk4::glib::{self, translate::IntoGlib as _};
use gtk4::prelude::StaticType as _;

static GTK_INIT: Once = Once::new();

pub fn ensure_gtk_init() {
    GTK_INIT.call_once(|| {
        gtk4::init().expect("Failed to initialize GTK4 for tests");
    });
}

#[allow(dead_code)]
pub fn get_closure_refcount(closure_ptr: *mut glib::gobject_ffi::GClosure) -> u32 {
    if closure_ptr.is_null() {
        return 0;
    }
    unsafe { (*closure_ptr).ref_count }
}

#[allow(dead_code)]
pub fn get_gobject_refcount(obj_ptr: *mut glib::gobject_ffi::GObject) -> u32 {
    if obj_ptr.is_null() {
        return 0;
    }
    unsafe { (*obj_ptr).ref_count }
}

#[allow(dead_code)]
pub fn allocate_test_boxed(gtype: glib::Type) -> *mut std::ffi::c_void {
    unsafe {
        let rgba = gdk::RGBA::new(1.0, 0.5, 0.25, 1.0);
        glib::gobject_ffi::g_boxed_copy(gtype.into_glib(), rgba.as_ptr() as *const _)
    }
}

#[allow(dead_code)]
pub fn is_valid_boxed_ptr(ptr: *mut std::ffi::c_void, gtype: glib::Type) -> bool {
    if ptr.is_null() {
        return false;
    }

    if gtype == gdk::RGBA::static_type() {
        unsafe {
            let rgba: &gdk::ffi::GdkRGBA = &*(ptr as *const gdk::ffi::GdkRGBA);
            rgba.red >= 0.0 && rgba.red <= 1.0 && rgba.alpha >= 0.0 && rgba.alpha <= 1.0
        }
    } else {
        true
    }
}

#![allow(dead_code)]

use std::ffi::c_void;
use std::sync::{Mutex, MutexGuard, Once, PoisonError};

use gtk4::gdk;
use gtk4::glib::{self, translate::IntoGlib as _};
use gtk4::prelude::StaticType as _;

use native::types::{IntegerKind, TaggedKind, TaggedType};

static GTK_INIT: Once = Once::new();

static SERIAL: Mutex<()> = Mutex::new(());

pub fn ensure_gtk_init() {
    GTK_INIT.call_once(|| {
        gtk4::init().expect("Failed to initialize GTK4 for tests");
    });
}

/// Serializes tests that mutate process-global state.
///
/// Tests within a binary run on concurrent threads, so any test touching a
/// singleton (such as the dispatch `Mailbox`) must hold this guard for its
/// whole duration to avoid racing with its siblings.
pub fn serial_guard() -> MutexGuard<'static, ()> {
    SERIAL.lock().unwrap_or_else(PoisonError::into_inner)
}

/// Runs a test body with GTK initialized and the serial guard held for the
/// duration of the closure. Mirrors `gtk::test_synced` from `gtk4-rs`.
pub fn run<F, R>(f: F) -> R
where
    F: FnOnce() -> R,
{
    let _guard = serial_guard();
    ensure_gtk_init();
    f()
}

#[allow(clippy::not_unsafe_ptr_arg_deref)]
pub fn make_integer_hash_table(entries: &[(usize, usize)]) -> *mut glib::ffi::GHashTable {
    unsafe {
        let table = glib::ffi::g_hash_table_new_full(
            Some(glib::ffi::g_direct_hash),
            Some(glib::ffi::g_direct_equal),
            None,
            None,
        );
        for (key, value) in entries {
            glib::ffi::g_hash_table_insert(
                table,
                std::ptr::without_provenance_mut(*key),
                std::ptr::without_provenance_mut(*value),
            );
        }
        table
    }
}

pub unsafe extern "C" fn param_spec_ref(ptr: *mut c_void) -> *mut c_void {
    unsafe {
        glib::gobject_ffi::g_param_spec_ref(ptr as *mut glib::gobject_ffi::GParamSpec)
            as *mut c_void
    }
}

pub unsafe extern "C" fn param_spec_unref(ptr: *mut c_void) {
    unsafe {
        glib::gobject_ffi::g_param_spec_unref(ptr as *mut glib::gobject_ffi::GParamSpec);
    }
}

#[allow(clippy::not_unsafe_ptr_arg_deref)]
pub fn param_spec_refcount(ptr: *mut c_void) -> u32 {
    if ptr.is_null() {
        return 0;
    }
    unsafe {
        let param = ptr as *mut glib::gobject_ffi::GParamSpec;
        (*param).ref_count
    }
}

#[allow(clippy::not_unsafe_ptr_arg_deref)]
pub fn get_gobject_refcount(obj_ptr: *mut glib::gobject_ffi::GObject) -> u32 {
    if obj_ptr.is_null() {
        return 0;
    }
    unsafe { (*obj_ptr).ref_count }
}

#[must_use]
pub fn allocate_test_boxed(gtype: glib::Type) -> *mut std::ffi::c_void {
    unsafe {
        let rgba = gdk::RGBA::new(1.0, 0.5, 0.25, 1.0);
        glib::gobject_ffi::g_boxed_copy(gtype.into_glib(), rgba.as_ptr() as *const _)
    }
}

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

/// Owning/borrowed wrapper around a boxed allocation used by tests that
/// exercise transfer-none and plain-struct drop semantics.
pub struct TestBoxed {
    pub ptr: *mut c_void,
    pub ty: Option<glib::Type>,
    pub is_owned: bool,
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

pub fn enum_tagged() -> TaggedType {
    TaggedType {
        kind: TaggedKind::Enum,
        library: "libgtk-4.so.1".to_owned(),
        get_type_fn: "gtk_orientation_get_type".to_owned(),
        storage: IntegerKind::I32,
    }
}

pub fn flags_tagged() -> TaggedType {
    TaggedType {
        kind: TaggedKind::Flags,
        library: "libgtk-4.so.1".to_owned(),
        get_type_fn: "gtk_state_flags_get_type".to_owned(),
        storage: IntegerKind::U32,
    }
}

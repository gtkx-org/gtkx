//! Native-side `GObject` finalize notifications for the JavaScript thread.
//!
//! A process-global [`ThreadsafeFunction`] is installed once from JavaScript
//! via the `set_object_finalized_callback` napi export. JavaScript calls
//! `watch_object_finalize` for each `GObject` whose JS-side instance state it
//! tracks; this installs a one-shot `g_object_weak_ref` whose notify — fired on
//! whichever thread performs the final unref — schedules the freed pointer back
//! onto the JS thread so the matching instance-state registry entry is cleared.
//!
//! The weak ref holds no reference and does not affect object lifetime; it is
//! purely a finalize notification. A per-object quark guards against installing
//! the watch more than once for the same instance.
//!
//! Every path here either installs or invokes a threadsafe function bound to
//! the Node.js event loop, so the module is excluded from coverage
//! instrumentation.

#![cfg_attr(coverage_nightly, coverage(off))]

use std::ffi::c_void;
use std::sync::{Arc, OnceLock};

use gtk4::glib;
use napi::Status;
use napi::threadsafe_function::{ThreadsafeFunction, ThreadsafeFunctionCallMode};

/// Threadsafe function delivering a finalized `GObject`'s pointer id — its raw
/// address as an `f64`, matching `getNativeId` — to the JavaScript thread.
///
/// The const generics encode `CalleeHandled = false` and `Weak = true`.
pub type ObjectFinalizedTsfn = ThreadsafeFunction<f64, (), f64, Status, false, true>;

static TSFN: OnceLock<Arc<ObjectFinalizedTsfn>> = OnceLock::new();
static WATCH_QUARK: OnceLock<glib::ffi::GQuark> = OnceLock::new();

/// Installs the JS-thread finalize-notification function. Called once at
/// startup; subsequent calls are ignored to keep the singleton write-once.
pub fn initialize(tsfn: Arc<ObjectFinalizedTsfn>) {
    let _ = TSFN.set(tsfn);
}

fn watch_quark() -> glib::ffi::GQuark {
    *WATCH_QUARK.get_or_init(|| unsafe {
        glib::ffi::g_quark_from_static_string(c"gtkx-finalize-watch".as_ptr())
    })
}

/// Installs a one-shot finalize watch on `gobject`. Idempotent per object: the
/// watch quark records that a weak ref is already in place so repeated calls do
/// nothing.
///
/// # Safety
///
/// `gobject` must be a valid, non-null pointer to a live `GObject`.
pub unsafe fn watch(gobject: *mut glib::gobject_ffi::GObject) {
    if gobject.is_null() {
        return;
    }
    let quark = watch_quark();
    unsafe {
        if !glib::gobject_ffi::g_object_get_qdata(gobject, quark).is_null() {
            return;
        }
        glib::gobject_ffi::g_object_set_qdata(gobject, quark, std::ptr::dangling_mut::<c_void>());
        glib::gobject_ffi::g_object_weak_ref(gobject, Some(on_finalize), std::ptr::null_mut());
    }
}

unsafe extern "C" fn on_finalize(
    _data: *mut c_void,
    where_the_object_was: *mut glib::gobject_ffi::GObject,
) {
    if let Some(tsfn) = TSFN.get() {
        tsfn.call(
            where_the_object_was as usize as f64,
            ThreadsafeFunctionCallMode::NonBlocking,
        );
    }
}

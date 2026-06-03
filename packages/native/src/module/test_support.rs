//! Test-support napi exports for lifetime and cross-thread assertions.
//!
//! These exist solely so the vitest suite can observe lifetime correctness that
//! is otherwise invisible from JavaScript: that a wrapped `GObject` is freed
//! exactly once, and that toggle notifies driven from a background thread cannot
//! corrupt the toggle-reference accounting while the JS thread garbage-collects.
//!
//! They ship in the addon — napi has no test-only export mode — but carry no
//! production caller; the JavaScript facade lives under `tests/`. Every path
//! here drives `GObject` work on the `GLib` thread or only touches atomics, so
//! the module is excluded from coverage instrumentation.

#![cfg_attr(coverage_nightly, coverage(off))]

use std::ffi::c_void;
use std::sync::atomic::{AtomicU64, Ordering};

use gtk4::glib;
use napi::Env;
use napi::bindgen_prelude::*;
use napi_derive::napi;

use crate::dispatch::Mailbox;
use crate::managed::NativeHandle;

/// Count of finalizations observed across every object passed to
/// [`watch_object_finalize`].
static FINALIZE_COUNT: AtomicU64 = AtomicU64::new(0);

/// Number of ref/unref tasks a [`drive_toggle_from_thread`] run has not yet
/// completed on the `GLib` thread.
static TOGGLE_PENDING: AtomicU64 = AtomicU64::new(0);

/// `GWeakNotify` that records a finalization without re-entering JavaScript, so
/// it is safe to fire from inside `g_object_unref` on the `GLib` thread.
unsafe extern "C" fn on_finalize(
    _data: *mut c_void,
    _where_the_object_was: *mut glib::gobject_ffi::GObject,
) {
    FINALIZE_COUNT.fetch_add(1, Ordering::SeqCst);
}

/// Installs a weak ref on the `GObject` behind `handle` whose notify increments
/// the global finalize counter, letting a test assert the object is freed
/// exactly once when its wrapper is collected.
#[napi(catch_unwind)]
#[cfg_attr(test, allow(dead_code))]
pub fn watch_object_finalize(env: Env, handle: &External<NativeHandle>) -> napi::Result<()> {
    let addr = handle.ptr() as usize;
    Mailbox::global()
        .dispatch_to_glib_and_wait(env, move || unsafe {
            glib::gobject_ffi::g_object_weak_ref(
                addr as *mut glib::gobject_ffi::GObject,
                Some(on_finalize),
                std::ptr::null_mut(),
            );
        })
        .map_err(|e| napi::Error::new(napi::Status::GenericFailure, e.to_string()))?;
    Ok(())
}

/// Returns the number of finalizations recorded by [`watch_object_finalize`].
#[napi(catch_unwind)]
#[allow(clippy::unnecessary_wraps)]
#[cfg_attr(test, allow(dead_code))]
pub fn finalize_count() -> napi::Result<f64> {
    Ok(FINALIZE_COUNT.load(Ordering::SeqCst) as f64)
}

/// From a background thread, enqueues `iterations` ref/unref pairs on the
/// `GObject` behind `handle`, each running on the `GLib` thread.
///
/// A ref/unref pair drives the object across the toggle boundary and back,
/// firing a strengthen then a weaken notify, so the test can race live toggle
/// notifies against the JS thread's garbage collection. Each pair is one
/// `GLib`-thread task, so the object's reference count nets back to its starting
/// value and is never released by this driver. Returns immediately; completion
/// is observed through [`pending_toggle_tasks`].
#[napi(catch_unwind)]
#[allow(clippy::unnecessary_wraps)]
#[cfg_attr(test, allow(dead_code))]
pub fn drive_toggle_from_thread(
    handle: &External<NativeHandle>,
    iterations: u32,
) -> napi::Result<()> {
    let addr = handle.ptr() as usize;
    TOGGLE_PENDING.fetch_add(u64::from(iterations), Ordering::SeqCst);
    std::thread::spawn(move || {
        for _ in 0..iterations {
            Mailbox::global().schedule_glib(Box::new(move || {
                unsafe {
                    let object = addr as *mut glib::gobject_ffi::GObject;
                    glib::gobject_ffi::g_object_ref(object);
                    glib::gobject_ffi::g_object_unref(object);
                }
                TOGGLE_PENDING.fetch_sub(1, Ordering::SeqCst);
            }));
        }
    });
    Ok(())
}

/// Returns how many [`drive_toggle_from_thread`] ref/unref tasks have not yet
/// run on the `GLib` thread, so a test can wait for the driver to drain.
#[napi(catch_unwind)]
#[allow(clippy::unnecessary_wraps)]
#[cfg_attr(test, allow(dead_code))]
pub fn pending_toggle_tasks() -> napi::Result<f64> {
    Ok(TOGGLE_PENDING.load(Ordering::SeqCst) as f64)
}

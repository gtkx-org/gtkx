#![cfg_attr(coverage_nightly, coverage(off))]

use std::sync::atomic::{AtomicU64, Ordering};

use glib::prelude::ObjectExt as _;
use glib::translate::from_glib_borrow;
use napi::Env;
use napi::bindgen_prelude::*;
use napi_derive::napi;

use crate::dispatch::Mailbox;
use crate::managed::NativeHandle;

static FINALIZE_COUNT: AtomicU64 = AtomicU64::new(0);

#[napi(catch_unwind)]
#[cfg_attr(test, allow(dead_code))]
pub fn watch_object_finalize(env: Env, handle: &External<NativeHandle>) -> napi::Result<()> {
    let addr = handle.ptr() as usize;
    Mailbox::global().dispatch_and_wait_napi(env, move || {
        let object: glib::translate::Borrowed<glib::Object> =
            unsafe { from_glib_borrow(addr as *mut glib::gobject_ffi::GObject) };
        object.add_weak_ref_notify(|| {
            FINALIZE_COUNT.fetch_add(1, Ordering::SeqCst);
        });
    })?;
    Ok(())
}

#[napi(catch_unwind)]
#[allow(clippy::unnecessary_wraps)]
#[cfg_attr(test, allow(dead_code))]
pub fn finalize_count() -> napi::Result<f64> {
    Ok(FINALIZE_COUNT.load(Ordering::SeqCst) as f64)
}

#[napi(catch_unwind)]
#[cfg_attr(test, allow(dead_code))]
pub fn drive_toggle_from_thread(
    env: Env,
    handle: &External<NativeHandle>,
    iterations: u32,
) -> napi::Result<()> {
    let addr = handle.ptr() as usize;
    let mailbox = Mailbox::global();
    for _ in 0..iterations {
        mailbox.schedule_glib(Box::new(move || unsafe {
            let object = addr as *mut glib::gobject_ffi::GObject;
            glib::gobject_ffi::g_object_ref(object);
            glib::gobject_ffi::g_object_unref(object);
        }));
    }
    mailbox.dispatch_and_wait_napi(env, || {})?;
    Ok(())
}

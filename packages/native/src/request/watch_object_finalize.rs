#![cfg_attr(coverage_nightly, coverage(off))]

use std::sync::atomic::Ordering;

use glib::prelude::ObjectExt as _;
use glib::translate::from_glib_borrow;
use napi::Env;
use napi::bindgen_prelude::*;
use napi_derive::napi;

use super::finalize_count::FINALIZE_COUNT;
use crate::handle::NativeHandle;
use crate::messaging::Mailbox;

#[napi(catch_unwind)]
#[cfg_attr(test, allow(dead_code))]
pub fn watch_object_finalize(env: Env, handle: &External<NativeHandle>) -> napi::Result<()> {
    let addr = handle.ptr() as usize;
    Mailbox::global().dispatch_and_wait_napi(env, move || {
        // SAFETY: the closure runs on the gtkx-glib thread; `addr` is the handle's live GObject
        // pointer. `from_glib_borrow` wraps it without taking a reference, and the wrapper is only
        // used to register a weak-ref notify before it is dropped, so no ownership is altered.
        let object: glib::translate::Borrowed<glib::Object> =
            unsafe { from_glib_borrow(addr as *mut glib::gobject_ffi::GObject) };
        object.add_weak_ref_notify(|| {
            FINALIZE_COUNT.fetch_add(1, Ordering::SeqCst);
        });
    })?;
    Ok(())
}

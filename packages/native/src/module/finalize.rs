//! napi exports for `GObject` finalize notifications.
//!
//! [`set_object_finalized_callback`] installs the JS-thread callback invoked
//! with a finalized `GObject`'s pointer id; [`watch_object_finalize`] arms a
//! one-shot finalize watch on the `GObject` at a given pointer id. Both wire or
//! reconstitute live native state, so the module is excluded from coverage
//! instrumentation.

#![cfg_attr(coverage_nightly, coverage(off))]

use std::sync::Arc;

use gtk4::glib;
use napi::Env;
use napi::bindgen_prelude::{External, Function, Unknown};
use napi_derive::napi;

use super::handler::ModuleRequest;
use crate::managed::NativeHandle;
use crate::object_finalize::{self, ObjectFinalizedTsfn};

/// Arms the finalize watch on the `GLib` thread.
///
/// The `GObject` pointer is carried as its address so the request stays `Send`;
/// it is reconstituted and dereferenced only inside [`Self::execute`], which
/// runs on the `GLib` thread where every other `GObject` mutation runs.
struct WatchFinalizeRequest {
    gobject_addr: usize,
}

impl ModuleRequest for WatchFinalizeRequest {
    type Output = ();

    fn execute(self) -> anyhow::Result<()> {
        let gobject = self.gobject_addr as *mut glib::gobject_ffi::GObject;
        unsafe { object_finalize::watch(gobject) };
        Ok(())
    }

    fn error_context() -> &'static str {
        "watch object finalize"
    }
}

/// Installs the JavaScript callback invoked, on the JS thread, with the pointer
/// id of each watched `GObject` when it is finalized.
#[napi(catch_unwind)]
#[cfg_attr(test, allow(dead_code))]
pub fn set_object_finalized_callback(callback: Function<'_, f64, ()>) -> napi::Result<()> {
    let tsfn: ObjectFinalizedTsfn = callback
        .build_threadsafe_function::<f64>()
        .weak::<true>()
        .callee_handled::<false>()
        .build()?;
    object_finalize::initialize(Arc::new(tsfn));
    Ok(())
}

/// Arms a one-shot finalize watch on the `GObject` behind `handle`.
///
/// The object must be live (the caller's handle holds a reference) when this is
/// invoked. The watch's qdata read/write and weak-ref installation run on the
/// `GLib` thread, blocking the JavaScript thread until they complete, so they
/// never race the `GLib` thread's own dispose/finalize of the same object.
#[napi(catch_unwind)]
#[cfg_attr(test, allow(dead_code))]
pub fn watch_object_finalize<'env>(
    env: &'env Env,
    handle: &External<NativeHandle>,
) -> napi::Result<Unknown<'env>> {
    let gobject_addr = handle.ptr().cast::<glib::gobject_ffi::GObject>() as usize;
    WatchFinalizeRequest { gobject_addr }.dispatch(env)
}

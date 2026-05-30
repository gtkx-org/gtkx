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
use napi::bindgen_prelude::{External, Function};
use napi_derive::napi;

use crate::managed::NativeHandle;
use crate::object_finalize::{self, ObjectFinalizedTsfn};

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
/// invoked.
#[napi(catch_unwind)]
#[allow(clippy::unnecessary_wraps)]
#[cfg_attr(test, allow(dead_code))]
pub fn watch_object_finalize(handle: &External<NativeHandle>) -> napi::Result<()> {
    let gobject = handle.ptr().cast::<glib::gobject_ffi::GObject>();
    unsafe { object_finalize::watch(gobject) };
    Ok(())
}

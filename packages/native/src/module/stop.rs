//! Graceful `GLib` main loop shutdown.
//!
//! The [`stop`] function tears the runtime down in a single GLib-thread task
//! that runs while the main loop is still iterating, so any pending finalizer
//! work scheduled by [`crate::managed::NativeHandle`]'s drop runs before the
//! loop exits.
//!
//! ## Shutdown Sequence
//!
//! 1. Mark the mailbox stopped, fencing further JS-side cleanup schedules.
//!    Subsequent JS-thread drops of [`crate::managed::NativeHandle`] hit the
//!    [`std::mem::forget`] branch instead of queuing onto a dying main loop.
//! 2. Drain all pending sources on the default main context, running queued
//!    cleanup callbacks while the `GLib` main loop is still alive.
//! 3. Quit the main loop, allowing `main_loop.run()` on the spawned thread to
//!    return.
//!
//! JS handles that GC after the mark-stopped fence are intentionally leaked
//! via [`std::mem::forget`] — running `GLib` finalizers after the main loop
//! has exited can crash on libraries like `WebKit` that depend on the loop
//! for their own cleanup.
//!
//! [`stop`] is a napi export that dispatches through a live [`napi::Env`], so
//! the module is excluded from coverage instrumentation.

#![cfg_attr(coverage_nightly, coverage(off))]

use gtk4::glib;
use napi::Env;
use napi::bindgen_prelude::*;
use napi_derive::napi;

use crate::dispatch::Mailbox;
use crate::error_reporter::NativeErrorReporter;
use crate::state::GlibThread;

#[napi(catch_unwind)]
#[cfg_attr(test, allow(dead_code))]
pub fn stop(env: Env, main_loop: &External<glib::MainLoop>) -> napi::Result<()> {
    let main_loop = (**main_loop).clone();

    Mailbox::global()
        .dispatch_to_glib_and_wait(env, move || {
            Mailbox::global().mark_stopped();
            let context = glib::MainContext::default();
            while context.iteration(false) {}
            main_loop.quit();
        })
        .map_err(|err| napi::Error::new(napi::Status::GenericFailure, err.to_string()))?;

    if let Some(msg) = GlibThread::global().join() {
        NativeErrorReporter::global().report_str(&format!("GLib thread exited with panic: {msg}"));
    }

    Ok(())
}

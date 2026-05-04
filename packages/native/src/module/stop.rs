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

use gtk4::glib;
use napi::Env;
use napi::bindgen_prelude::*;
use napi_derive::napi;

use crate::dispatch::Mailbox;
use crate::managed::NativeHandle;

#[napi]
pub fn stop(env: Env, main_loop: &External<NativeHandle>) -> napi::Result<()> {
    let main_loop_addr = main_loop.ptr() as usize;

    Mailbox::global()
        .dispatch_to_glib_and_wait(env, move || {
            Mailbox::global().mark_stopped();
            drain_pending_sources();
            unsafe { glib::ffi::g_main_loop_quit(main_loop_addr as *mut glib::ffi::GMainLoop) };
        })
        .map_err(|err| napi::Error::new(napi::Status::GenericFailure, err.to_string()))?;

    Ok(())
}

fn drain_pending_sources() {
    let context = glib::MainContext::default();
    while context.iteration(false) {}
}

//! `GLib` main loop initialization and thread spawning.
//!
//! The [`init`] function spawns a dedicated `GLib` thread that runs a plain
//! `glib::MainLoop`. The loop reference is exposed to JavaScript as a
//! [`crate::managed::NativeHandle`] wrapping a `GMainLoop` boxed value, allowing the JS layer
//! to terminate it via `g_main_loop_quit` through the standard FFI dispatch.
//!
//! Before returning the handle, the JS thread blocks on a `glib::idle_add_once`
//! barrier that fires on the loop's first iteration, so the handle is handed back
//! only once the loop is confirmed live.
//!
//! [`init`] orchestrates a fixed sequence of install steps — wake threadsafe
//! function, error reporter, panic hook, then the `GLib` thread spawn and ready
//! barrier — each owned by its subsystem, so the module is excluded from
//! coverage instrumentation.

#![cfg_attr(coverage_nightly, coverage(off))]

use std::panic::{self, AssertUnwindSafe};
use std::sync::mpsc;

use napi::Env;
use napi::bindgen_prelude::*;
use napi_derive::napi;

use crate::dispatch::Mailbox;
use crate::error_reporter::NativeErrorReporter;
use crate::glib_log_handler::GlibLogHandler;
use crate::panic_handler::{format_panic_payload, install_panic_hook};
use crate::state::GlibThread;

#[napi(catch_unwind)]
#[cfg_attr(test, allow(dead_code))]
pub fn init(env: Env) -> napi::Result<External<glib::MainLoop>> {
    GlibThread::global()
        .begin_init()
        .map_err(|msg| napi::Error::new(napi::Status::GenericFailure, msg))?;

    Mailbox::global().install_wake(env)?;
    NativeErrorReporter::global().install(env)?;
    install_panic_hook();

    let (tx, rx) = mpsc::channel::<glib::MainLoop>();

    let handle = std::thread::Builder::new()
        .name("gtkx-glib".to_owned())
        .spawn(move || {
            let result = panic::catch_unwind(AssertUnwindSafe(|| {
                GlibLogHandler::install();

                let main_loop = glib::MainLoop::new(None, false);
                let main_loop_for_js = main_loop.clone();

                glib::idle_add_once(move || {
                    crate::dispatch::send_or_report(
                        &tx,
                        main_loop_for_js,
                        "GLib main loop ready but startup channel was closed",
                    );
                });

                main_loop.run();
            }));

            if let Err(payload) = result {
                NativeErrorReporter::global().report_str(&format!(
                    "GLib thread panicked: {}",
                    format_panic_payload(&*payload)
                ));
            }
        })
        .map_err(|err| {
            GlibThread::global().abort_init();
            napi::Error::new(
                napi::Status::GenericFailure,
                format!("Error spawning GLib thread: {err}"),
            )
        })?;

    GlibThread::global().set_handle(handle);

    let main_loop = rx.recv().map_err(|err| {
        let glib_thread = GlibThread::global();
        let panic_message = glib_thread.join();
        let _ = glib_thread.begin_quit();
        let cause = panic_message.unwrap_or_else(|| err.to_string());
        napi::Error::new(
            napi::Status::GenericFailure,
            format!("Error starting GLib thread: {cause}"),
        )
    })?;

    Ok(External::new(main_loop))
}

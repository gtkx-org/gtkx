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
            napi::Error::new(
                napi::Status::GenericFailure,
                format!("Error spawning GLib thread: {err}"),
            )
        })?;

    GlibThread::global().set_handle(handle);

    let main_loop = rx.recv().map_err(|err| {
        let glib_thread = GlibThread::global();
        let panic_message = glib_thread.join();
        let cause = panic_message.unwrap_or_else(|| err.to_string());
        napi::Error::new(
            napi::Status::GenericFailure,
            format!("Error starting GLib thread: {cause}"),
        )
    })?;

    Ok(External::new(main_loop))
}

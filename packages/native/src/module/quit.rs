#![cfg_attr(coverage_nightly, coverage(off))]

use napi::Env;
use napi::bindgen_prelude::*;
use napi_derive::napi;

use crate::dispatch::Mailbox;
use crate::error_reporter::NativeErrorReporter;
use crate::state::GlibThread;

#[napi(catch_unwind)]
#[cfg_attr(test, allow(dead_code))]
pub fn quit(env: Env, main_loop: &External<glib::MainLoop>) -> napi::Result<()> {
    let main_loop = (**main_loop).clone();

    Mailbox::global().dispatch_and_wait_napi(env, move || {
        Mailbox::global().mark_not_running();
        let context = glib::MainContext::default();
        while context.iteration(false) {}
        main_loop.quit();
    })?;

    if let Some(msg) = GlibThread::global().join() {
        NativeErrorReporter::global().report_str(&format!("GLib thread exited with panic: {msg}"));
    }

    Ok(())
}

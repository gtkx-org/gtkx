use napi::Env;
use napi::bindgen_prelude::*;
use napi_derive::napi;

use crate::messaging::Mailbox;
use crate::messaging::error_reporter::ErrorReporter;
use crate::messaging::glib_mailbox::GlibThread;

#[napi(catch_unwind)]
pub fn quit(env: Env, main_loop: &External<glib::MainLoop>) -> napi::Result<()> {
    let main_loop = (**main_loop).clone();

    Mailbox::global().dispatch_and_wait_napi(env, move || {
        Mailbox::global().mark_not_running();
        let context = glib::MainContext::default();
        while context.iteration(false) {}
        main_loop.quit();
    })?;

    if let Some(msg) = GlibThread::global().join() {
        ErrorReporter::global().report_str(&format!("GLib thread exited with panic: {msg}"));
    }

    Ok(())
}

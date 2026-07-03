use napi::Env;
use napi_derive::napi;

use crate::messaging::Mailbox;
use crate::messaging::error_reporter::ErrorReporter;
use crate::messaging::glib_mailbox::GlibThread;

#[napi(catch_unwind)]
pub fn quit(env: Env) -> napi::Result<()> {
    let Some(main_loop) = GlibThread::global().take_main_loop() else {
        return Ok(());
    };

    Mailbox::global().invoke_glib_and_wait_napi(env, move || {
        let context = glib::MainContext::default();
        while context.iteration(false) {}
        Mailbox::global().mark_not_running();
        main_loop.quit();
    })?;

    if let Some(msg) = GlibThread::global().join() {
        ErrorReporter::global().report_str(&format!("GLib thread exited with panic: {msg}"));
    }

    Ok(())
}

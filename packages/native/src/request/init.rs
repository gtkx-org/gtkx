use napi::Env;
use napi_derive::napi;

use crate::messaging::Mailbox;
use crate::messaging::error_reporter::ErrorReporter;
use crate::messaging::glib_mailbox::GlibThread;
use crate::messaging::panic_handler::install_panic_hook;

#[napi(catch_unwind)]
pub fn init(env: Env) -> napi::Result<()> {
    Mailbox::global().install_wake(env)?;
    ErrorReporter::global().install(env)?;
    install_panic_hook();

    GlibThread::global().spawn()
}

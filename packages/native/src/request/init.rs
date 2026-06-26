#![cfg_attr(coverage_nightly, coverage(off))]

use napi::Env;
use napi::bindgen_prelude::*;
use napi_derive::napi;

use crate::messaging::Mailbox;
use crate::messaging::error_reporter::NativeErrorReporter;
use crate::messaging::glib_mailbox::GlibThread;
use crate::messaging::panic_handler::install_panic_hook;

#[napi(catch_unwind)]
#[cfg_attr(test, allow(dead_code))]
pub fn init(env: Env) -> napi::Result<External<glib::MainLoop>> {
    Mailbox::global().install_wake(env)?;
    NativeErrorReporter::global().install(env)?;
    install_panic_hook();

    let main_loop = GlibThread::global().spawn()?;

    Ok(External::new(main_loop))
}

//! Tick-callback freezing during a React commit.
//!
//! [`freeze`] and [`unfreeze`] are napi exports driven by a live [`napi::Env`],
//! so the module is excluded from coverage instrumentation. The underlying
//! [`crate::dispatch::Mailbox`] freeze logic is exercised directly by tests.

#![cfg_attr(coverage_nightly, coverage(off))]

use std::sync::mpsc;

use napi::Env;
use napi_derive::napi;

use crate::dispatch::Mailbox;
use crate::error_reporter::NativeErrorReporter;

#[napi(catch_unwind)]
#[cfg_attr(test, allow(dead_code))]
pub fn freeze(env: Env) -> napi::Result<()> {
    let mailbox = Mailbox::global();
    let is_outermost = mailbox.freeze();

    if is_outermost {
        let (tx, rx) = mpsc::channel::<()>();

        mailbox.schedule_glib(Box::new(move || {
            if tx.send(()).is_err() {
                NativeErrorReporter::global().report_str("Freeze ready signal channel was closed");
            }
            let m = Mailbox::global();
            m.notify_js();
            m.run_freeze_loop();
        }));

        if let Err(err) = mailbox.wait_for_glib_result(env, &rx) {
            mailbox.unfreeze();
            return Err(napi::Error::new(
                napi::Status::GenericFailure,
                err.to_string(),
            ));
        }
    }

    Ok(())
}

#[napi(catch_unwind)]
#[allow(clippy::unnecessary_wraps)]
#[cfg_attr(test, allow(dead_code))]
pub fn unfreeze() -> napi::Result<()> {
    Mailbox::global().unfreeze();
    Ok(())
}

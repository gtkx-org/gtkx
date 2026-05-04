use std::sync::mpsc;

use napi::Env;
use napi_derive::napi;

use crate::dispatch::Mailbox;
use crate::error_reporter::NativeErrorReporter;

#[napi]
pub fn freeze(env: Env) -> napi::Result<()> {
    let mailbox = Mailbox::global();
    let is_outermost = mailbox.freeze();

    if is_outermost {
        let (tx, rx) = mpsc::channel::<()>();

        mailbox.schedule_glib(move || {
            if tx.send(()).is_err() {
                NativeErrorReporter::global().report_str("Freeze ready signal channel was closed");
            }
            let m = Mailbox::global();
            m.notify_js();
            m.run_freeze_loop();
        });

        mailbox
            .wait_for_glib_result(env, &rx)
            .map_err(|err| napi::Error::new(napi::Status::GenericFailure, err.to_string()))?;
    }

    Ok(())
}

#[napi]
pub fn unfreeze() {
    Mailbox::global().unfreeze();
}

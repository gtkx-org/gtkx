#![cfg_attr(coverage_nightly, coverage(off))]

use napi::Env;
use napi_derive::napi;

use crate::dispatch::Mailbox;

#[napi(catch_unwind)]
#[cfg_attr(test, allow(dead_code))]
pub fn freeze(env: Env) -> napi::Result<()> {
    let mailbox = Mailbox::global();
    let is_outermost = mailbox.freeze();

    if is_outermost
        && let Err(err) = mailbox.dispatch_long_lived_glib_task(env, |ready| {
            ready.signal();
            Mailbox::global().run_freeze_loop();
        })
    {
        mailbox.unfreeze();
        return Err(err);
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

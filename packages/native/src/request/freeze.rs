use napi::Env;
use napi_derive::napi;

use crate::messaging::Mailbox;

#[napi(catch_unwind)]
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

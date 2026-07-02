use napi::Env;
use napi_derive::napi;

use crate::messaging::Mailbox;

#[napi(catch_unwind)]
pub fn freeze(env: Env) -> napi::Result<()> {
    let mailbox = Mailbox::global();
    let is_outermost = mailbox.freeze();

    if is_outermost {
        mailbox.schedule_glib(Box::new(|| Mailbox::global().run_freeze_loop()));
        if let Err(err) = mailbox.invoke_glib_and_wait_napi(env, || ()) {
            mailbox.unfreeze();
            return Err(err);
        }
    }

    Ok(())
}

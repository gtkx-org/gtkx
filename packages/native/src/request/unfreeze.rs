use napi_derive::napi;

use crate::messaging::Mailbox;

#[napi(catch_unwind)]
pub fn unfreeze() -> napi::Result<()> {
    Mailbox::global().unfreeze();
    Ok(())
}

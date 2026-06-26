#![cfg_attr(coverage_nightly, coverage(off))]

use napi_derive::napi;

use crate::messaging::Mailbox;

#[napi(catch_unwind)]
#[allow(clippy::unnecessary_wraps)]
#[cfg_attr(test, allow(dead_code))]
pub fn unfreeze() -> napi::Result<()> {
    Mailbox::global().unfreeze();
    Ok(())
}

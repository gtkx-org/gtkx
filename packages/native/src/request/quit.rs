use napi_derive::napi;

use crate::runloop;

#[napi(catch_unwind)]
pub fn quit() -> napi::Result<()> {
    runloop::teardown();
    Ok(())
}

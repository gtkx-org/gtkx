use napi_derive::napi;

use crate::runloop;

/// Tears down the `GLib` main loop integration installed by `init`.
#[napi(catch_unwind)]
pub fn quit() -> napi::Result<()> {
    runloop::teardown();
    Ok(())
}

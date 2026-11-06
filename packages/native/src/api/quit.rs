use napi_derive::napi;

use crate::host::node_env;
use crate::runloop;
use crate::value::wrapper;

/// Ends the objects that only their JavaScript wrappers still reference, while JavaScript can still
/// run, and tears down the `GLib` main loop integration installed by `init`.
#[napi(catch_unwind)]
pub fn quit() -> napi::Result<()> {
    if node_env::try_env().is_some() {
        node_env::run_dispatch_scope(wrapper::release_unowned);
    }
    runloop::teardown();
    Ok(())
}

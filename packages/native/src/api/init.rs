use napi::Env;
use napi_derive::napi;

use crate::host::node_env;
use crate::runloop;

/// Installs the Node environment and the `GLib` main-loop integration on the current thread.
/// Call once before any other native function.
#[napi(catch_unwind)]
pub fn init(env: Env) -> napi::Result<()> {
    node_env::install(env)?;
    runloop::install(&env)
}

use std::time::Duration;

use napi::Env;
use napi_derive::napi;

use crate::host::node_env;
use crate::runloop;

/// Installs the Node environment and the `GLib` main-loop integration on the current thread.
/// Call once before any other native function.
#[napi(catch_unwind)]
pub fn init(env: Env, dispatch_budget_ms: f64) -> napi::Result<()> {
    let dispatch_budget = Duration::try_from_secs_f64(dispatch_budget_ms / 1_000.0)
        .ok()
        .filter(|budget| !budget.is_zero())
        .ok_or_else(|| {
            napi::Error::new(
                napi::Status::InvalidArg,
                "Dispatch budget must be a positive finite duration",
            )
        })?;
    node_env::install(env)?;
    runloop::install(&env, dispatch_budget)
}

use napi::Env;
use napi_derive::napi;

use crate::messaging::node_env;
use crate::runloop;

#[napi(catch_unwind)]
pub fn init(env: Env) -> napi::Result<()> {
    node_env::install(env)?;
    runloop::install(&env)
}

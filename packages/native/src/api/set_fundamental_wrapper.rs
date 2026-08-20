use napi::Env;
use napi::bindgen_prelude::*;
use napi_derive::napi;

use crate::handle::Handle;
use crate::value::fundamental_wrapper;

/// Caches the JavaScript `wrapper` object for the handle's fundamental instance, so wrapping the
/// same pointer again yields the same object for as long as the wrapper stays alive. A handle
/// that owns no reference to its instance is left uncached, since its pointer can outlive the
/// instance and later name a different one.
#[napi(catch_unwind)]
pub fn set_fundamental_wrapper(
    env: Env,
    handle: &External<Handle>,
    wrapper: Object<'_>,
) -> Result<()> {
    let Some(ptr) = handle.as_owned_fundamental_ptr() else {
        return Ok(());
    };

    fundamental_wrapper::install(&env, ptr, &wrapper)
}

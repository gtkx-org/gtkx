use napi::Env;
use napi::bindgen_prelude::*;
use napi_derive::napi;

use crate::handle::Handle;
use crate::value::{roots, wrapper};

fn wrapper_identity<'env>(
    env: &'env Env,
    handle: &External<Handle>,
    label: &str,
) -> Result<(usize, Object<'env>, Option<glib::Object>)> {
    let lease = crate::api::native_result(label, handle.acquire_lease())?;
    let Some(gobject) = handle.as_gobject_ptr() else {
        return Err(Error::new(
            Status::InvalidArg,
            format!("{label}: the handle does not reference a live GObject"),
        ));
    };
    let Some(identity) = (unsafe { wrapper::active_identity(gobject) }) else {
        return Err(Error::new(
            Status::InvalidArg,
            format!("{label}: the GObject has no active wrapper"),
        ));
    };

    let value = unsafe { wrapper::wrapper_value(env, gobject) }.ok_or_else(|| {
        Error::new(
            Status::InvalidArg,
            format!("{label}: the GObject wrapper is no longer reachable"),
        )
    })?;

    Ok((identity, value, lease))
}

#[napi(catch_unwind)]
pub fn set_wrapper_borrow(
    env: Env,
    owner: &External<Handle>,
    dependent: Option<&External<Handle>>,
    clear: Option<&External<Handle>>,
) -> Result<()> {
    let (owner_identity, owner_wrapper, _owner_lease) =
        wrapper_identity(&env, owner, "set_wrapper_borrow owner")?;

    match (dependent, clear) {
        (None, None) => {
            roots::remove(env, owner_wrapper.into_unknown(&env)?, wrapper::BORROW_ROOT)?;
            wrapper::clear_borrow(owner_identity);
            Ok(())
        }
        (Some(dependent), Some(clear)) => {
            let (dependent_identity, dependent_wrapper, _dependent_lease) =
                wrapper_identity(&env, dependent, "set_wrapper_borrow dependent")?;
            crate::api::native_result("set_wrapper_borrow clear", clear.lifecycle_function_ptr())?;
            roots::set(
                env,
                owner_wrapper.into_unknown(&env)?,
                wrapper::BORROW_ROOT,
                dependent_wrapper.into_unknown(&env)?,
            )?;
            wrapper::set_borrow(
                owner_identity,
                dependent_identity,
                (**owner).clone(),
                (**dependent).clone(),
                (**clear).clone(),
            );
            Ok(())
        }
        _ => Err(Error::new(
            Status::InvalidArg,
            "set_wrapper_borrow: dependent and clear must both be null or both be present",
        )),
    }
}

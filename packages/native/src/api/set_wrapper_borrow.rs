use napi::Env;
use napi::bindgen_prelude::*;
use napi_derive::napi;

use crate::handle::Handle;
use crate::value::{ClosureHandle, wrapper};

type Cleanup<'a> = Function<'a, (), ()>;

fn wrapper_identity(
    handle: &External<Handle>,
    label: &str,
) -> Result<(usize, Option<glib::Object>)> {
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

    Ok((identity, lease))
}

#[napi(catch_unwind)]
pub fn set_wrapper_borrow(
    env: Env,
    owner: &External<Handle>,
    dependent: Option<&External<Handle>>,
    #[napi(ts_arg_type = "(() => void) | null")] cleanup: Option<Cleanup<'_>>,
) -> Result<()> {
    let (owner_identity, _owner_lease) = wrapper_identity(owner, "set_wrapper_borrow owner")?;

    match (dependent, cleanup) {
        (None, None) => {
            wrapper::clear_borrow(owner_identity);
            Ok(())
        }
        (Some(dependent), Some(cleanup)) => {
            let (dependent_identity, _dependent_lease) =
                wrapper_identity(dependent, "set_wrapper_borrow dependent")?;
            let cleanup = ClosureHandle::from_js_value(&env, &cleanup)?;
            wrapper::set_borrow(owner_identity, dependent_identity, cleanup);
            Ok(())
        }
        _ => Err(Error::new(
            Status::InvalidArg,
            "set_wrapper_borrow: dependent and cleanup must both be null or both be present",
        )),
    }
}

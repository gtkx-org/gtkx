use std::sync::Arc;

use napi::Env;
use napi::bindgen_prelude::*;
use napi_derive::napi;

use crate::ffi::descriptors::Descriptor;

/// A bound FFI call whose library, symbol, and type descriptors are parsed once.
///
/// `bind` parses the descriptors a single time and returns this handle; `call` reuses it for every
/// call, so the per-call path marshals only argument values and never re-walks the type descriptor
/// objects. The handle is shared via `Arc`, so it is safe to dispatch onto the `GLib` thread
/// without cloning the descriptor's fields per call.
pub struct CallDescriptor {
    pub(crate) library_name: String,
    pub(crate) symbol_name: String,
    pub(crate) arg_types: Vec<Descriptor>,
    pub(crate) result_type: Descriptor,
}

#[cfg_attr(coverage_nightly, coverage(off))]
#[allow(clippy::wildcard_imports)]
mod napi_export {
    use super::*;

    #[napi(catch_unwind)]
    #[cfg_attr(test, allow(dead_code))]
    pub fn bind(
        env: Env,
        library: String,
        symbol: String,
        arg_types: Array,
        return_type: Unknown<'_>,
    ) -> napi::Result<External<Arc<CallDescriptor>>> {
        let parsed_arg_types = crate::ffi::value::map_js_array(&env, &arg_types, |env, value| {
            let ty = Descriptor::from_descriptor(env, value)?;
            if !ty.can_be_argument_type() {
                return Err(napi::Error::new(
                    napi::Status::InvalidArg,
                    format!("'{ty}' cannot be used as a function argument type"),
                ));
            }
            Ok(ty)
        })?;
        let result_type = Descriptor::from_descriptor(&env, return_type)?;
        if !result_type.can_be_return_type() {
            return Err(napi::Error::new(
                napi::Status::InvalidArg,
                format!("'{result_type}' cannot be used as a function return type"),
            ));
        }
        Ok(External::new(Arc::new(CallDescriptor {
            library_name: library,
            symbol_name: symbol,
            arg_types: parsed_arg_types,
            result_type,
        })))
    }
}

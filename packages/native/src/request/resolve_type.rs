use glib::translate::IntoGlib as _;
use napi::Env;
use napi::bindgen_prelude::*;
use napi_derive::napi;

use super::Request;
use crate::ffi::library_cache::GlibThreadState;

struct ResolveTypeRequest {
    shared_library: String,
    get_type_fn_name: String,
}

impl Request for ResolveTypeRequest {
    type Output = u64;

    fn execute(self) -> anyhow::Result<u64> {
        let type_ = GlibThreadState::with(|state| {
            state.resolve_type_optional(&self.shared_library, &self.get_type_fn_name)
        })?;
        Ok(type_.into_glib() as u64)
    }

    fn error_context() -> &'static str {
        "resolve_type"
    }
}

pub mod napi_export {
    use super::*;

    #[napi(catch_unwind)]
    pub fn resolve_type(
        env: Env,
        shared_library: String,
        get_type_fn_name: String,
    ) -> napi::Result<BigInt> {
        let type_ = ResolveTypeRequest {
            shared_library,
            get_type_fn_name,
        }
        .dispatch_output(env)?;
        Ok(BigInt::from(type_))
    }
}

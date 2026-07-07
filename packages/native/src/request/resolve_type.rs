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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::request::Request;

    #[test]
    fn execute_resolves_a_registered_gtype() {
        test_support::run(|| {
            let request = ResolveTypeRequest {
                shared_library: "libgtk-4.so.1".to_owned(),
                get_type_fn_name: "gtk_orientation_get_type".to_owned(),
            };
            assert_ne!(request.execute().expect("resolve_type should succeed"), 0);
        });
    }

    #[test]
    fn execute_yields_zero_for_unknown_symbol() {
        test_support::run(|| {
            let request = ResolveTypeRequest {
                shared_library: "libgtk-4.so.1".to_owned(),
                get_type_fn_name: "gtkx_missing_get_type".to_owned(),
            };
            assert_eq!(request.execute().expect("resolve_type should succeed"), 0);
        });
    }
}

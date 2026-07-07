use glib::ffi::g_malloc0;
use napi::Env;
use napi::bindgen_prelude::*;
use napi_derive::napi;

use super::Request;
use crate::handle::{Boxed, Handle, Value};

struct AllocRequest {
    size: usize,
    type_name: Option<String>,
}

impl Request for AllocRequest {
    type Output = Handle;

    fn execute(self) -> anyhow::Result<Handle> {
        let type_name = self
            .type_name
            .map(glib::GString::from_string_checked)
            .transpose()
            .map_err(|err| anyhow::anyhow!("invalid alloc type name: {err}"))?;

        let ptr = unsafe { g_malloc0(self.size) };
        let boxed = Boxed::from_alloc(type_name, ptr);
        Ok(Value::Boxed(boxed).into())
    }

    fn error_context() -> &'static str {
        "alloc"
    }
}

pub mod napi_export {
    use super::*;

    #[napi(catch_unwind)]
    pub fn alloc(env: Env, size: f64, type_name: Option<String>) -> napi::Result<External<Handle>> {
        let request = AllocRequest {
            size: size as usize,
            type_name,
        };
        let handle = request.dispatch_output(env)?;
        let size_hint = handle.size_hint();
        Ok(External::new_with_size_hint(handle, size_hint))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::request::Request;

    #[test]
    fn execute_allocates_untyped_boxed_handle() {
        test_support::run(|| {
            let request = AllocRequest {
                size: 32,
                type_name: None,
            };
            let handle = request.execute().expect("alloc should succeed");
            assert!(!handle.as_ptr().is_null());
        });
    }

    #[test]
    fn execute_rejects_type_name_with_interior_nul() {
        test_support::run(|| {
            let request = AllocRequest {
                size: 16,
                type_name: Some("bad\0type".to_owned()),
            };
            assert!(request.execute().is_err());
        });
    }
}

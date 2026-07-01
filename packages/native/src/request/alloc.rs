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

        if ptr.is_null() {
            let type_description = type_name
                .as_ref()
                .map_or("plain struct", |name| name.as_str());
            anyhow::bail!("Failed to allocate memory for {type_description}");
        }

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

use glib::ffi::g_malloc0;
use napi::Env;
use napi::bindgen_prelude::*;
use napi_derive::napi;

use super::handler::ModuleRequest;
use crate::managed::{Boxed, NativeHandle, NativeValue};

#[cfg_attr(test, allow(dead_code))]
struct AllocRequest {
    size: usize,
    type_name: Option<String>,
}

impl ModuleRequest for AllocRequest {
    type Output = NativeHandle;

    fn execute(self) -> anyhow::Result<NativeHandle> {
        let type_name = self
            .type_name
            .map(glib::GString::from_string_checked)
            .transpose()
            .map_err(|err| anyhow::anyhow!("invalid alloc type name: {err}"))?;

        // SAFETY: runs on the gtkx-glib thread; `g_malloc0` allocates and zero-initializes
        // `self.size` bytes (returning null only for a zero-size request, handled below), and the
        // returned block's ownership is handed to the `Boxed` wrapper.
        let ptr = unsafe { g_malloc0(self.size) };

        if ptr.is_null() {
            let type_desc = type_name
                .as_ref()
                .map_or("plain struct", |name| name.as_str());
            anyhow::bail!("Failed to allocate memory for {type_desc}");
        }

        let boxed = Boxed::from_alloc(type_name, ptr);
        Ok(NativeValue::Boxed(boxed).into())
    }

    fn error_context() -> &'static str {
        "alloc"
    }
}

#[cfg_attr(coverage_nightly, coverage(off))]
#[allow(clippy::wildcard_imports)]
mod napi_export {
    use super::*;

    #[napi(catch_unwind)]
    #[cfg_attr(test, allow(dead_code))]
    pub fn alloc(env: &Env, size: f64, type_name: Option<String>) -> napi::Result<Unknown<'_>> {
        let request = AllocRequest {
            size: size as usize,
            type_name,
        };
        request.dispatch(env)
    }
}

#[cfg(test)]
mod tests {
    use gtk4::prelude::StaticType as _;

    use super::*;

    #[test]
    fn execute_allocates_boxed_type() {
        let gdk_rgba = gtk4::gdk::RGBA::static_type();
        let request = AllocRequest {
            size: std::mem::size_of::<gtk4::gdk::RGBA>(),
            type_name: Some(gdk_rgba.name().to_string()),
        };
        let handle = request.execute().expect("boxed alloc should succeed");
        assert!(!handle.ptr().is_null());
    }

    #[test]
    fn execute_allocates_plain_struct() {
        let request = AllocRequest {
            size: 32,
            type_name: None,
        };
        let handle = request.execute().expect("plain alloc should succeed");
        assert!(!handle.ptr().is_null());
    }

    #[test]
    fn execute_fails_when_allocation_yields_null() {
        let request = AllocRequest {
            size: 0,
            type_name: Some("GdkRGBA".into()),
        };
        let err = request
            .execute()
            .expect_err("zero-size allocation should fail");
        assert!(err.to_string().contains("GdkRGBA"));
    }

    #[test]
    fn execute_fails_when_plain_allocation_yields_null() {
        let request = AllocRequest {
            size: 0,
            type_name: None,
        };
        let err = request
            .execute()
            .expect_err("zero-size allocation should fail");
        assert!(err.to_string().contains("plain struct"));
    }

    #[test]
    fn execute_allocates_boxed_type_with_unregistered_name() {
        let request = AllocRequest {
            size: 24,
            type_name: Some("GtkxAllocUnregisteredName".into()),
        };
        let handle = request
            .execute()
            .expect("unregistered-name alloc should succeed");
        assert!(!handle.ptr().is_null());
    }

    #[test]
    fn error_context_is_alloc() {
        assert_eq!(AllocRequest::error_context(), "alloc");
    }
}

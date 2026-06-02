//! Memory allocation for boxed types and plain structs.
//!
//! The [`alloc`] function allocates zeroed memory for structured/boxed types
//! on the `GLib` thread. This is used to create instances of GTK structs like
//! `GdkRGBA`, `GtkTextIter`, etc. that need to be populated field-by-field.
//!
//! ## Allocation Modes
//!
//! - **Boxed types** (with `type_name)`: Memory is wrapped with `GType` info for
//!   proper `g_boxed_free` cleanup.
//! - **Plain structs** (without `type_name)`: Memory is allocated with `g_malloc0`
//!   and freed with `g_free` on drop.

use gtk4::glib;
use gtk4::glib::ffi::g_malloc0;
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
        let ptr = unsafe { g_malloc0(self.size) };

        if ptr.is_null() {
            let type_desc = self.type_name.as_deref().unwrap_or("plain struct");
            anyhow::bail!("Failed to allocate memory for {type_desc}");
        }

        let gtype = self.type_name.as_ref().and_then(glib::Type::from_name);

        let boxed = Boxed::from_glib_full(gtype, ptr);
        Ok(NativeValue::Boxed(boxed).into())
    }

    fn error_context() -> &'static str {
        "alloc"
    }
}

/// napi export shim. Excluded from coverage instrumentation: it requires a
/// live [`napi::Env`]. The [`AllocRequest::execute`] logic it dispatches is
/// exercised directly by tests.
#[cfg_attr(coverage_nightly, coverage(off))]
#[allow(clippy::wildcard_imports)]
mod napi_export {
    use super::*;

    #[napi(catch_unwind)]
    #[cfg_attr(test, allow(dead_code))]
    pub fn alloc(
        env: &Env,
        size: f64,
        type_name: Option<String>,
        _lib: Option<String>,
    ) -> napi::Result<Unknown<'_>> {
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
    fn error_context_is_alloc() {
        assert_eq!(AllocRequest::error_context(), "alloc");
    }
}

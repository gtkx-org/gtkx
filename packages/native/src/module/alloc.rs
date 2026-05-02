//! Memory allocation for boxed types and plain structs.
//!
//! The [`alloc`] function allocates zeroed memory for structured/boxed types
//! on the GTK thread. This is used to create instances of GTK structs like
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

use super::handler::{ModuleRequest, dispatch_request};
use crate::managed::{Boxed, NativeHandle, NativeValue};

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

#[napi]
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
    dispatch_request(env, request)
}

//! Memory allocation for boxed types and plain structs.
//!
//! The [`alloc`] function allocates zeroed memory for structured/boxed types
//! on the GTK thread. This is used to create instances of GTK structs like
//! `GdkRGBA`, `GtkTextIter`, etc. that need to be populated field-by-field.
//!
//! ## Allocation Modes
//!
//! - **Boxed types** (with type_name): Memory is wrapped with GType info for
//!   proper `g_boxed_free` cleanup.
//! - **Plain structs** (without type_name): Memory is allocated with `g_malloc0`
//!   and freed with `g_free` on drop.

use gtk4::glib;
use gtk4::glib::ffi::g_malloc0;
use neon::prelude::*;

use super::handler::{ModuleRequest, dispatch_request};
use crate::managed::{Boxed, NativeHandle, NativeValue};

struct AllocRequest {
    size: usize,
    type_name: Option<String>,
}

impl ModuleRequest for AllocRequest {
    type Output = NativeHandle;

    fn from_js(cx: &mut FunctionContext) -> NeonResult<Self> {
        let size = cx.argument::<JsNumber>(0)?.value(cx) as usize;

        let type_name = cx
            .argument_opt(1)
            .and_then(|v| v.downcast::<JsString, _>(cx).ok())
            .map(|s| s.value(cx));

        Ok(Self { size, type_name })
    }

    fn execute(self) -> anyhow::Result<NativeHandle> {
        // SAFETY: g_malloc0 is a safe GLib memory allocation function
        let ptr = unsafe { g_malloc0(self.size) };

        if ptr.is_null() {
            let type_desc = self.type_name.as_deref().unwrap_or("plain struct");
            anyhow::bail!("Failed to allocate memory for {}", type_desc);
        }

        let gtype = self.type_name.as_ref().and_then(glib::Type::from_name);

        let boxed = Boxed::from_glib_full(gtype, ptr);
        Ok(NativeValue::Boxed(boxed).into())
    }

    fn error_context() -> &'static str {
        "alloc"
    }
}

pub fn alloc(mut cx: FunctionContext) -> JsResult<JsValue> {
    dispatch_request::<AllocRequest>(&mut cx)
}

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

use gtk4::glib::ffi::g_malloc0;
use neon::prelude::*;

use crate::{
    gtk_dispatch,
    managed::{Boxed, NativeHandle, NativeValue},
    types::{BoxedType, Ownership},
};

struct AllocRequest {
    size: usize,
    type_name: Option<String>,
    library_name: Option<String>,
}

impl AllocRequest {
    fn from_js(cx: &mut FunctionContext) -> NeonResult<Self> {
        let size = cx.argument::<JsNumber>(0)?.value(cx) as usize;

        let type_name = cx
            .argument_opt(1)
            .and_then(|v| v.downcast::<JsString, _>(cx).ok())
            .map(|s| s.value(cx));

        let library_name = cx
            .argument_opt(2)
            .and_then(|v| v.downcast::<JsString, _>(cx).ok())
            .map(|s| s.value(cx));

        Ok(Self {
            size,
            type_name,
            library_name,
        })
    }

    fn execute(self) -> anyhow::Result<NativeHandle> {
        // SAFETY: g_malloc0 is a safe GLib memory allocation function
        let ptr = unsafe { g_malloc0(self.size) };

        if ptr.is_null() {
            let type_desc = self.type_name.as_deref().unwrap_or("plain struct");
            anyhow::bail!("Failed to allocate memory for {}", type_desc);
        }

        let gtype = self.type_name.as_ref().map(|type_name| {
            let boxed_type = BoxedType::new(
                Ownership::Full,
                type_name.clone(),
                self.library_name.clone(),
                None,
            );
            boxed_type.gtype()
        }).flatten();

        let boxed = Boxed::from_glib_full(gtype, ptr);
        Ok(NativeValue::Boxed(boxed).into())
    }
}

pub fn alloc(mut cx: FunctionContext) -> JsResult<JsValue> {
    let request = AllocRequest::from_js(&mut cx)?;

    let rx = gtk_dispatch::GtkDispatcher::global().run_on_gtk_thread(move || request.execute());

    let handle = rx
        .recv()
        .or_else(|err| cx.throw_error(format!("Error receiving alloc result: {err}")))?
        .or_else(|err| cx.throw_error(format!("Error during alloc: {err}")))?;

    Ok(cx.boxed(handle).upcast())
}

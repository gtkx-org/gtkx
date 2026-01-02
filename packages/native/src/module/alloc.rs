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
    boxed::Boxed,
    gtk_dispatch,
    object::{Object, ObjectId},
    types::BoxedType,
};

pub fn alloc(mut cx: FunctionContext) -> JsResult<JsValue> {
    let size = cx.argument::<JsNumber>(0)?.value(&mut cx) as usize;

    let type_name = cx
        .argument_opt(1)
        .and_then(|v| v.downcast::<JsString, _>(&mut cx).ok())
        .map(|s| s.value(&mut cx));

    let lib_name = cx
        .argument_opt(2)
        .and_then(|v| v.downcast::<JsString, _>(&mut cx).ok())
        .map(|s| s.value(&mut cx));

    let rx = gtk_dispatch::run_on_gtk_thread(move || {
        handle_alloc(size, type_name.as_deref(), lib_name.as_deref())
    });

    let object_id = rx
        .recv()
        .or_else(|err| cx.throw_error(format!("Error receiving alloc result: {err}")))?
        .or_else(|err| cx.throw_error(format!("Error during alloc: {err}")))?;

    Ok(cx.boxed(object_id).upcast())
}

fn handle_alloc(
    size: usize,
    type_name: Option<&str>,
    lib_name: Option<&str>,
) -> anyhow::Result<ObjectId> {
    let gtype = type_name.map(|name| {
        let boxed_type = BoxedType::new(false, name.to_string(), lib_name.map(String::from), None);
        boxed_type.get_gtype()
    });

    let ptr = unsafe { g_malloc0(size) };

    if ptr.is_null() {
        let type_desc = type_name.unwrap_or("plain struct");
        anyhow::bail!("Failed to allocate memory for {}", type_desc);
    }

    let boxed = Boxed::from_glib_full(gtype.flatten(), ptr);
    Ok(Object::Boxed(boxed).into())
}

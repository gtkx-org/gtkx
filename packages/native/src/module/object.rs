//! Object pointer retrieval.
//!
//! The [`get_native_id`] function returns the raw pointer value for a managed
//! object. This is primarily used for debugging and introspection.

use std::sync::mpsc;

use neon::prelude::*;

use crate::{gtk_dispatch, managed::NativeHandle};

pub fn get_native_id(mut cx: FunctionContext) -> JsResult<JsNumber> {
    let handle = cx.argument::<JsBox<NativeHandle>>(0)?;
    let id = *handle.as_inner();

    let (tx, rx) = mpsc::channel();

    gtk_dispatch::GtkDispatcher::global().enter_js_wait();
    gtk_dispatch::GtkDispatcher::global().schedule(move || {
        let _ = tx.send(id.get_ptr_as_usize());
    });

    let ptr = gtk_dispatch::GtkDispatcher::global()
        .wait_for_gtk_result(&mut cx, &rx)
        .or_else(|err| cx.throw_error(err.to_string()))?;

    match ptr {
        Some(p) => Ok(cx.number(p as f64)),
        None => cx.throw_error("Object has been garbage collected"),
    }
}

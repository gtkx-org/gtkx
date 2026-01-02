//! Object pointer retrieval.
//!
//! The [`get_object_id`] function returns the raw pointer value for a managed
//! object. This is primarily used for debugging and introspection.

use neon::prelude::*;

use crate::{gtk_dispatch, object::ObjectId};

pub fn get_object_id(mut cx: FunctionContext) -> JsResult<JsNumber> {
    let object_id = cx.argument::<JsBox<ObjectId>>(0)?;
    let id = *object_id.as_inner();

    let rx = gtk_dispatch::run_on_gtk_thread(move || id.try_as_ptr());

    let ptr = rx
        .recv()
        .or_else(|err| cx.throw_error(format!("Error receiving pointer: {err}")))?;

    match ptr {
        Some(p) => Ok(cx.number(p as f64)),
        None => cx.throw_error("Object has been garbage collected"),
    }
}

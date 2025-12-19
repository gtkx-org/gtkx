//! Object ID retrieval for native pointers.

use std::sync::mpsc;

use neon::prelude::*;

use crate::{gtk_dispatch, object::ObjectId};

/// Gets the native pointer address for an object.
///
/// JavaScript signature: `getObjectId(objectId: ObjectId) => number`
///
/// Returns the raw pointer address as a JavaScript number. Throws if the
/// object has been garbage collected.
pub fn get_object_id(mut cx: FunctionContext) -> JsResult<JsNumber> {
    let object_id = cx.argument::<JsBox<ObjectId>>(0)?;

    let (tx, rx) = mpsc::channel::<Option<usize>>();
    let id = *object_id.as_inner();

    gtk_dispatch::schedule(move || {
        let _ = tx.send(id.try_as_ptr());
    });

    let ptr = rx
        .recv()
        .or_else(|err| cx.throw_error(format!("Error receiving pointer: {err}")))?;

    match ptr {
        Some(p) => Ok(cx.number(p as f64)),
        None => cx.throw_error("Object has been garbage collected"),
    }
}

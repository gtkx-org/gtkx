//! Object pointer retrieval.
//!
//! The [`get_native_id`] function returns the raw pointer value for a managed
//! object. This is primarily used for object-identity comparisons in JavaScript.
//! With pointer-bearing handles, the read is purely synchronous and never
//! crosses the `GLib` thread boundary.

use neon::prelude::*;

use crate::managed::NativeHandle;

pub fn get_native_id(mut cx: FunctionContext) -> JsResult<JsNumber> {
    let handle = cx.argument::<JsBox<NativeHandle>>(0)?;
    let ptr = handle.as_inner().ptr_as_usize();
    Ok(cx.number(ptr as f64))
}

pub fn is_native_handle(mut cx: FunctionContext) -> JsResult<JsBoolean> {
    let value = cx.argument::<JsValue>(0)?;
    let result = value.downcast::<JsBox<NativeHandle>, _>(&mut cx).is_ok();
    Ok(cx.boolean(result))
}

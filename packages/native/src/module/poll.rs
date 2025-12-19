//! Poll function for processing pending JS callbacks.
//!
//! This is a workaround for runtimes like Deno where Neon's channel wake-up
//! mechanism may not work correctly. By calling this function periodically,
//! pending callbacks from GTK signals can be processed even when the JS
//! event loop isn't being woken up properly.

use neon::prelude::*;

use crate::js_dispatch;

pub fn poll(mut cx: FunctionContext) -> JsResult<JsUndefined> {
    js_dispatch::process_pending(&mut cx);
    Ok(cx.undefined())
}

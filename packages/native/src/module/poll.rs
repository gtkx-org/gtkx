

use neon::prelude::*;

use crate::js_dispatch;

pub fn poll(mut cx: FunctionContext) -> JsResult<JsUndefined> {
    js_dispatch::process_pending(&mut cx);
    Ok(cx.undefined())
}

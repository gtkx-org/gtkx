//! JavaScript callback representation for FFI.
//!
//! Defines [`Callback`] which wraps a JavaScript function for invocation
//! from native code. Contains both the rooted function handle and a Neon
//! channel for cross-thread callback dispatch.

use neon::prelude::*;
use std::sync::Arc;

#[derive(Debug, Clone)]
pub struct Callback {
    pub js_func: Arc<Root<JsFunction>>,
    pub channel: Channel,
}

impl Callback {
    pub fn new(js_func: Arc<Root<JsFunction>>, channel: Channel) -> Self {
        Callback { js_func, channel }
    }

    pub fn from_js_value<'a, C: Context<'a>>(
        cx: &mut C,
        value: Handle<JsValue>,
    ) -> NeonResult<Self> {
        let js_func = value.downcast::<JsFunction, _>(cx).or_throw(cx)?;
        let js_func_root = js_func.root(cx);
        let mut channel = cx.channel();

        channel.unref(cx);

        Ok(Callback::new(Arc::new(js_func_root), channel))
    }

    pub fn to_js_value<'a, C: Context<'a>>(&self, cx: &mut C) -> NeonResult<Handle<'a, JsValue>> {
        let js_func = self.js_func.to_inner(cx);
        Ok(js_func.upcast())
    }
}

use std::sync::Arc;

use neon::handle::Root;
use neon::prelude::*;
use neon::types::JsObject;

use crate::dispatch;
use crate::managed::NativeHandle;
use crate::value::Value;

pub trait ModuleRequest: Sized + Send + 'static {
    type Output: ModuleResponse + Send + 'static;
    fn from_js(cx: &mut FunctionContext) -> NeonResult<Self>;
    fn execute(self) -> anyhow::Result<Self::Output>;
    fn error_context() -> &'static str;
}

pub trait ModuleResponse {
    fn to_js_response<'a>(self, cx: &mut FunctionContext<'a>) -> JsResult<'a, JsValue>;
}

pub trait JsThreadCommand: Sized {
    fn from_js(cx: &mut FunctionContext) -> NeonResult<Self>;
    fn execute<'a>(self, cx: &mut FunctionContext<'a>) -> JsResult<'a, JsValue>;
}

pub fn dispatch_request<'a, R: ModuleRequest>(
    cx: &mut FunctionContext<'a>,
) -> JsResult<'a, JsValue> {
    let mailbox = dispatch::Mailbox::global();

    if !mailbox.is_started() {
        return cx.throw_error("GTK application has not been started. Call start() first.");
    }

    let request = R::from_js(cx)?;
    let result = mailbox
        .dispatch_to_glib_and_wait(cx, || request.execute())
        .or_else(|err| cx.throw_error(err.to_string()))?
        .or_else(|err| cx.throw_error(format!("Error during {}: {err}", R::error_context())))?;
    result.to_js_response(cx)
}

pub fn execute_js_command<'a, C: JsThreadCommand>(
    cx: &mut FunctionContext<'a>,
) -> JsResult<'a, JsValue> {
    let command = C::from_js(cx)?;
    command.execute(cx)
}

impl ModuleResponse for Value {
    fn to_js_response<'a>(self, cx: &mut FunctionContext<'a>) -> JsResult<'a, JsValue> {
        self.to_js_value(cx)
    }
}

impl ModuleResponse for NativeHandle {
    fn to_js_response<'a>(self, cx: &mut FunctionContext<'a>) -> JsResult<'a, JsValue> {
        Ok(cx.boxed(self).upcast())
    }
}

impl ModuleResponse for () {
    fn to_js_response<'a>(self, cx: &mut FunctionContext<'a>) -> JsResult<'a, JsValue> {
        Ok(cx.undefined().upcast())
    }
}

type RefUpdate = (Arc<Root<JsObject>>, Value);

impl ModuleResponse for (Value, Vec<RefUpdate>) {
    fn to_js_response<'a>(self, cx: &mut FunctionContext<'a>) -> JsResult<'a, JsValue> {
        let (value, ref_updates) = self;
        for (js_obj, new_value) in ref_updates {
            let js_obj = js_obj.to_inner(cx);
            let new_js_value = new_value.to_js_value(cx)?;
            js_obj.prop(cx, "value").set(new_js_value)?;
        }
        value.to_js_value(cx)
    }
}

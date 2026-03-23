//! Object pointer retrieval.
//!
//! The [`get_native_id`] function returns the raw pointer value for a managed
//! object. This is primarily used for debugging and introspection.

use neon::prelude::*;

use super::handler::{ModuleRequest, ModuleResponse, dispatch_request};
use crate::managed::NativeHandle;

struct NativeIdResult(Option<usize>);

impl ModuleResponse for NativeIdResult {
    fn to_js_response<'a>(self, cx: &mut FunctionContext<'a>) -> JsResult<'a, JsValue> {
        match self.0 {
            Some(p) => Ok(cx.number(p as f64).upcast()),
            None => cx.throw_error("Object has been garbage collected"),
        }
    }
}

struct GetNativeIdRequest {
    handle: NativeHandle,
}

impl ModuleRequest for GetNativeIdRequest {
    type Output = NativeIdResult;

    fn from_js(cx: &mut FunctionContext) -> NeonResult<Self> {
        let boxed_handle = cx.argument::<JsBox<NativeHandle>>(0)?;
        Ok(Self {
            handle: *boxed_handle.as_inner(),
        })
    }

    fn execute(self) -> anyhow::Result<NativeIdResult> {
        Ok(NativeIdResult(self.handle.get_ptr_as_usize()))
    }

    fn error_context() -> &'static str {
        "get native id"
    }
}

pub fn get_native_id(mut cx: FunctionContext) -> JsResult<JsNumber> {
    let result = dispatch_request::<GetNativeIdRequest>(&mut cx)?;
    result.downcast_or_throw::<JsNumber, _>(&mut cx)
}

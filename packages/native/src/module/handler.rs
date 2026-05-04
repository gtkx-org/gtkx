use std::sync::Arc;

use napi::Env;
use napi::bindgen_prelude::*;

use crate::dispatch;
use crate::managed::NativeHandle;
use crate::value::{JsObjectRefValue, Value};

pub trait ModuleRequest: Sized + Send + 'static {
    type Output: ModuleResponse + Send + 'static;
    fn execute(self) -> anyhow::Result<Self::Output>;
    fn error_context() -> &'static str;
}

pub trait ModuleResponse: Sized {
    fn to_js_response(self, env: &Env) -> napi::Result<Unknown<'_>>;
}

pub fn dispatch_request<R: ModuleRequest>(env: &Env, request: R) -> napi::Result<Unknown<'_>> {
    let result = dispatch::Mailbox::global()
        .dispatch_to_glib_and_wait(*env, move || request.execute())
        .map_err(|e| napi::Error::new(napi::Status::GenericFailure, e.to_string()))?
        .map_err(|e| {
            napi::Error::new(
                napi::Status::GenericFailure,
                format!("Error during {}: {e}", R::error_context()),
            )
        })?;
    result.to_js_response(env)
}

impl ModuleResponse for Value {
    fn to_js_response(self, env: &Env) -> napi::Result<Unknown<'_>> {
        self.to_js_value(env)
    }
}

impl ModuleResponse for NativeHandle {
    fn to_js_response(self, env: &Env) -> napi::Result<Unknown<'_>> {
        unsafe {
            let external = External::new(self);
            let raw = External::<Self>::to_napi_value(env.raw(), external)?;
            Ok(Unknown::from_raw_unchecked(env.raw(), raw))
        }
    }
}

impl ModuleResponse for () {
    fn to_js_response(self, env: &Env) -> napi::Result<Unknown<'_>> {
        unsafe {
            let raw = Undefined::to_napi_value(env.raw(), ())?;
            Ok(Unknown::from_raw_unchecked(env.raw(), raw))
        }
    }
}

pub type RefUpdate = (Arc<JsObjectRefValue>, Value);

impl ModuleResponse for (Value, Vec<RefUpdate>) {
    fn to_js_response(self, env: &Env) -> napi::Result<Unknown<'_>> {
        let (value, ref_updates) = self;
        for (js_obj_ref, new_value) in ref_updates {
            let mut js_obj = js_obj_ref.get_value(env)?;
            let new_js_value = new_value.to_js_value(env)?;
            js_obj.set_named_property("value", new_js_value)?;
        }
        value.to_js_value(env)
    }
}

//! Request/response plumbing shared by the napi export handlers.
//!
//! [`ModuleRequest::dispatch`] and the [`ModuleResponse`] conversions all
//! require a live [`napi::Env`], so the module is excluded from coverage
//! instrumentation. The per-request `execute` logic lives in the sibling
//! modules and is exercised directly by tests.

#![cfg_attr(coverage_nightly, coverage(off))]

use std::sync::Arc;

use napi::bindgen_prelude::*;
use napi::{Env, JsObject};

use crate::dispatch;
use crate::managed::NativeHandle;
use crate::value::{JsRef, Value};

#[cfg_attr(test, allow(dead_code))]
pub trait ModuleRequest: Sized + Send + 'static {
    type Output: ModuleResponse + Send + 'static;
    fn execute(self) -> anyhow::Result<Self::Output>;
    fn error_context() -> &'static str;

    /// Dispatches the request onto the `GLib` thread, blocks the JS thread
    /// until it completes, and converts the outcome into a JavaScript value.
    ///
    /// A failed request surfaces with its full anyhow context chain
    /// (alternate formatting), so the JavaScript error names both the failing
    /// operation and the root cause.
    fn dispatch(self, env: &Env) -> napi::Result<Unknown<'_>> {
        let result = dispatch::Mailbox::global()
            .dispatch_and_wait_napi(*env, move || self.execute())?
            .map_err(|e| {
                napi::Error::new(
                    napi::Status::GenericFailure,
                    format!("Error during {}: {e:#}", Self::error_context()),
                )
            })?;
        result.to_js_response(env)
    }
}

#[cfg_attr(test, allow(dead_code))]
pub trait ModuleResponse: Sized {
    fn to_js_response(self, env: &Env) -> napi::Result<Unknown<'_>>;
}

impl ModuleResponse for Value {
    fn to_js_response(self, env: &Env) -> napi::Result<Unknown<'_>> {
        self.to_js_value(env)
    }
}

impl ModuleResponse for NativeHandle {
    fn to_js_response(self, env: &Env) -> napi::Result<Unknown<'_>> {
        let size_hint = self.size_hint();
        External::new_with_size_hint(self, size_hint).into_unknown(env)
    }
}

impl ModuleResponse for Option<NativeHandle> {
    fn to_js_response(self, env: &Env) -> napi::Result<Unknown<'_>> {
        self.map_or_else(
            || ().to_js_response(env),
            |handle| handle.to_js_response(env),
        )
    }
}

impl ModuleResponse for u64 {
    fn to_js_response(self, env: &Env) -> napi::Result<Unknown<'_>> {
        BigInt::from(self).into_unknown(env)
    }
}

impl ModuleResponse for () {
    fn to_js_response(self, env: &Env) -> napi::Result<Unknown<'_>> {
        ().into_unknown(env)
    }
}

#[cfg_attr(test, allow(dead_code))]
pub type RefUpdate = (Arc<JsRef<JsObject>>, Value);

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

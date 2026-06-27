#![cfg_attr(coverage_nightly, coverage(off))]

mod alloc;
mod bind;
mod call;
mod freeze;
mod get_type;
mod get_wrapper;
mod init;
mod quit;
mod read;
mod register_class;
mod set_wrapper;
mod unfreeze;
mod write;

use std::sync::Arc;

use napi::bindgen_prelude::*;
use napi::{Env, JsObject};

use crate::ffi::value::{JsRef, Value};
use crate::handle::Handle;
use crate::messaging;

#[cfg_attr(test, allow(dead_code))]
pub trait Request: Sized + Send + 'static {
    type Output: Response + Send + 'static;
    fn execute(self) -> anyhow::Result<Self::Output>;
    fn error_context() -> &'static str;

    fn dispatch(self, env: &Env) -> napi::Result<Unknown<'_>> {
        let result = messaging::Mailbox::global()
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
pub trait Response: Sized {
    fn to_js_response(self, env: &Env) -> napi::Result<Unknown<'_>>;
}

impl Response for Value {
    fn to_js_response(self, env: &Env) -> napi::Result<Unknown<'_>> {
        self.to_js_value(env)
    }
}

impl Response for Handle {
    fn to_js_response(self, env: &Env) -> napi::Result<Unknown<'_>> {
        let size_hint = self.size_hint();
        External::new_with_size_hint(self, size_hint).into_unknown(env)
    }
}

impl Response for Option<Handle> {
    fn to_js_response(self, env: &Env) -> napi::Result<Unknown<'_>> {
        self.map_or_else(
            || ().to_js_response(env),
            |handle| handle.to_js_response(env),
        )
    }
}

impl Response for u64 {
    fn to_js_response(self, env: &Env) -> napi::Result<Unknown<'_>> {
        BigInt::from(self).into_unknown(env)
    }
}

impl Response for () {
    fn to_js_response(self, env: &Env) -> napi::Result<Unknown<'_>> {
        ().into_unknown(env)
    }
}

#[cfg_attr(test, allow(dead_code))]
pub type RefUpdate = (Arc<JsRef<JsObject>>, Value);

impl Response for (Value, Vec<RefUpdate>) {
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

pub mod alloc;
pub mod bind;
pub mod call;
pub mod copy;
pub mod freeze;
pub mod get_type;
pub mod get_wrapper;
pub mod init;
pub mod quit;
pub mod read;
pub mod register_class;
pub mod resolve_type;
pub mod set_wrapper;
pub mod unfreeze;
pub mod write;

use napi::Env;
use napi::bindgen_prelude::*;

use crate::ffi::value::{JsHandle, Value};
use crate::messaging;

pub trait Request: Sized + Send + 'static {
    type Output: Send + 'static;
    fn execute(self) -> anyhow::Result<Self::Output>;
    fn error_context() -> &'static str;

    fn dispatch(self, env: &Env) -> napi::Result<Unknown<'_>>
    where
        Self::Output: Response,
    {
        self.dispatch_output(*env)?.to_js_response(env)
    }

    fn dispatch_output(self, env: Env) -> napi::Result<Self::Output> {
        messaging::Mailbox::global()
            .invoke_glib_and_wait_napi(env, move || self.execute())?
            .map_err(|e| {
                napi::Error::new(
                    napi::Status::GenericFailure,
                    format!("Error during {}: {e:#}", Self::error_context()),
                )
            })
    }
}

pub trait Response: Sized {
    fn to_js_response(self, env: &Env) -> napi::Result<Unknown<'_>>;
}

impl Response for Value {
    fn to_js_response(self, env: &Env) -> napi::Result<Unknown<'_>> {
        self.to_js_value(env)
    }
}

impl Response for () {
    fn to_js_response(self, env: &Env) -> napi::Result<Unknown<'_>> {
        ().into_unknown(env)
    }
}

pub type RefUpdate = (JsHandle, Value);

impl Response for (Value, Vec<RefUpdate>) {
    fn to_js_response(self, env: &Env) -> napi::Result<Unknown<'_>> {
        let (value, ref_updates) = self;
        for (js_obj_ref, new_value) in ref_updates {
            let mut js_obj: Object = js_obj_ref.get(env)?;
            let new_js_value = new_value.to_js_value(env)?;
            js_obj.set_named_property("value", new_js_value)?;
        }
        value.to_js_value(env)
    }
}

use std::thread::ThreadId;

use napi::bindgen_prelude::*;
use napi::sys;
use napi::Env;

use crate::messaging::{JsRefDeletion, Mailbox};

pub struct JsRef {
    raw: sys::napi_ref,
    env: sys::napi_env,
    owner_thread: ThreadId,
}

unsafe impl Send for JsRef {}
unsafe impl Sync for JsRef {}

impl std::fmt::Debug for JsRef {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("JsRef").finish_non_exhaustive()
    }
}

impl Drop for JsRef {
    fn drop(&mut self) {
        let reference = JsRefDeletion::new(self.env, self.raw);
        if std::thread::current().id() == self.owner_thread {
            reference.delete_on_node_thread();
        } else {
            Mailbox::global().schedule_js_reference_delete(reference);
        }
    }
}

impl JsRef {
    pub fn from_js_value<'a, V: JsValue<'a>>(env: &Env, value: &V) -> napi::Result<Self> {
        let raw_value = value.raw();
        let mut raw_ref = std::ptr::null_mut();
        let status = unsafe { sys::napi_create_reference(env.raw(), raw_value, 1, &mut raw_ref) };
        check_status!(status, "Failed to create reference")?;
        Ok(Self {
            raw: raw_ref,
            env: env.raw(),
            owner_thread: std::thread::current().id(),
        })
    }

    pub fn get_raw(&self, env: &Env) -> napi::Result<sys::napi_value> {
        let mut raw_value = std::ptr::null_mut();
        let status = unsafe { sys::napi_get_reference_value(env.raw(), self.raw, &mut raw_value) };
        check_status!(status, "Failed to get reference value")?;
        Ok(raw_value)
    }

    pub fn get<T: FromNapiValue>(&self, env: &Env) -> napi::Result<T> {
        let raw_value = self.get_raw(env)?;
        unsafe { T::from_napi_value(env.raw(), raw_value) }
    }
}

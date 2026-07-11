use std::rc::Rc;

use napi::Env;
use napi::bindgen_prelude::*;
use napi::sys;

struct JsRef {
    raw: sys::napi_ref,
    env: sys::napi_env,
}

impl Drop for JsRef {
    fn drop(&mut self) {
        let status = unsafe { sys::napi_delete_reference(self.env, self.raw) };
        debug_assert_eq!(status, sys::Status::napi_ok);
    }
}

#[derive(Clone)]
pub struct JsHandle(Rc<JsRef>);

impl std::fmt::Debug for JsHandle {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("JsHandle").finish_non_exhaustive()
    }
}

impl JsHandle {
    pub fn from_js_value<'a, V: JsValue<'a>>(env: &Env, value: &V) -> napi::Result<Self> {
        let mut raw_ref = std::ptr::null_mut();
        let status = unsafe { sys::napi_create_reference(env.raw(), value.raw(), 1, &mut raw_ref) };
        check_status!(status, "Failed to create reference")?;
        Ok(Self(Rc::new(JsRef {
            raw: raw_ref,
            env: env.raw(),
        })))
    }

    pub fn get<T: FromNapiValue>(&self, env: &Env) -> napi::Result<T> {
        let mut raw_value = std::ptr::null_mut();
        let status =
            unsafe { sys::napi_get_reference_value(env.raw(), self.0.raw, &mut raw_value) };
        check_status!(status, "Failed to get reference value")?;
        unsafe { T::from_napi_value(env.raw(), raw_value) }
    }
}

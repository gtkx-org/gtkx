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

pub struct ClosureHandle(JsRef);

impl std::fmt::Debug for ClosureHandle {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("ClosureHandle").finish_non_exhaustive()
    }
}

impl ClosureHandle {
    pub fn from_js_value<'a, V: JsValue<'a>>(env: &Env, value: &V) -> Result<Self> {
        let mut raw_ref = std::ptr::null_mut();
        let status =
            unsafe { sys::napi_create_reference(env.raw(), value.raw(), 1, &raw mut raw_ref) };
        check_status!(status, "Failed to create reference")?;
        Ok(Self(JsRef {
            raw: raw_ref,
            env: env.raw(),
        }))
    }

    pub fn get<T: FromNapiValue>(&self, env: &Env) -> Result<T> {
        let mut raw_value = std::ptr::null_mut();
        let status =
            unsafe { sys::napi_get_reference_value(env.raw(), self.0.raw, &raw mut raw_value) };
        check_status!(status, "Failed to get reference value")?;
        unsafe { T::from_napi_value(env.raw(), raw_value) }
    }
}

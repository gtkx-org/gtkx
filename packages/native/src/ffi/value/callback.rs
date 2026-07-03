use std::sync::Arc;

use napi::Env;
use napi::bindgen_prelude::*;

use super::js_ref::JsRef;

#[derive(Clone)]
pub struct Callback {
    pub js_fn: Arc<JsRef>,
}

impl std::fmt::Debug for Callback {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Callback").finish_non_exhaustive()
    }
}

impl Callback {
    pub fn new(js_fn: Arc<JsRef>) -> Self {
        Self { js_fn }
    }

    pub fn from_js_value(env: &Env, value: Unknown<'_>) -> napi::Result<Self> {
        let func_ref = JsRef::from_js_value(env, &value)?;
        Ok(Self::new(Arc::new(func_ref)))
    }
}

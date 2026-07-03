use std::sync::Arc;

use napi::Env;
use napi::bindgen_prelude::*;

use super::Value;
use super::js_ref::JsRef;

#[derive(Clone)]
pub struct Ref {
    pub value: Box<Value>,
    pub js_obj: Arc<JsRef>,
}

impl std::fmt::Debug for Ref {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Ref")
            .field("value", &self.value)
            .finish_non_exhaustive()
    }
}

impl Ref {
    pub fn new(value: Value, js_obj: Arc<JsRef>) -> Self {
        Self {
            value: Box::new(value),
            js_obj,
        }
    }

    pub(super) fn from_js_value_at_depth(
        env: &Env,
        value: Unknown<'_>,
        depth: usize,
    ) -> napi::Result<Self> {
        let obj = Object::from_raw(env.raw(), value.raw());
        let value_prop: Unknown<'_> = obj.get_named_property("value")?;
        let inner = Value::from_js_value_at_depth(env, value_prop, depth)?;
        let js_obj_ref = JsRef::from_js_value(env, &obj)?;

        Ok(Self::new(inner, Arc::new(js_obj_ref)))
    }
}

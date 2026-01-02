use std::sync::Arc;

use neon::{handle::Root, object::Object as _, prelude::*};

use super::Value;

#[derive(Debug, Clone)]
pub struct Ref {
    pub value: Box<Value>,
    pub js_obj: Arc<Root<JsObject>>,
}

impl Ref {
    pub fn new(value: Value, js_obj: Arc<Root<JsObject>>) -> Self {
        Ref {
            value: Box::new(value),
            js_obj,
        }
    }

    pub fn from_js_value<'a, C: Context<'a>>(
        cx: &mut C,
        value: Handle<JsValue>,
    ) -> NeonResult<Self> {
        let obj = value.downcast::<JsObject, _>(cx).or_throw(cx)?;
        let js_obj_root = obj.root(cx);
        let value_prop: Handle<JsValue> = obj.get(cx, "value")?;
        let value = Value::from_js_value(cx, value_prop)?;

        Ok(Ref::new(value, Arc::new(js_obj_root)))
    }
}

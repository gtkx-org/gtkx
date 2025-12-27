

use libffi::middle as ffi;
use neon::prelude::*;

use crate::types::Type;

#[derive(Debug, Clone)]
pub struct RefType {

    pub inner_type: Box<Type>,
}

impl RefType {

    pub fn new(inner_type: Type) -> Self {
        RefType {
            inner_type: Box::new(inner_type),
        }
    }

    pub fn from_js_value(cx: &mut FunctionContext, value: Handle<JsValue>) -> NeonResult<Self> {
        let obj = value.downcast::<JsObject, _>(cx).or_throw(cx)?;
        let inner_type_value: Handle<'_, JsValue> = obj.prop(cx, "innerType").get()?;
        let inner_type = Type::from_js_value(cx, inner_type_value)?;

        Ok(Self::new(inner_type))
    }
}

impl From<&RefType> for ffi::Type {
    fn from(_value: &RefType) -> Self {
        ffi::Type::pointer()
    }
}

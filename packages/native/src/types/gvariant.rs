

use libffi::middle as ffi;
use neon::prelude::*;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GVariantType {
    pub is_borrowed: bool,
}

impl GVariantType {
    pub fn new(is_borrowed: bool) -> Self {
        GVariantType { is_borrowed }
    }

    pub fn from_js_value(cx: &mut FunctionContext, value: Handle<JsValue>) -> NeonResult<Self> {
        let obj = value.downcast::<JsObject, _>(cx).or_throw(cx)?;
        let is_borrowed_prop: Handle<'_, JsValue> = obj.prop(cx, "borrowed").get()?;

        let is_borrowed = is_borrowed_prop
            .downcast::<JsBoolean, _>(cx)
            .map(|b| b.value(cx))
            .unwrap_or(false);

        Ok(Self::new(is_borrowed))
    }
}

impl From<&GVariantType> for ffi::Type {
    fn from(_value: &GVariantType) -> Self {
        ffi::Type::pointer()
    }
}

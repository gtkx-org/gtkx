

use libffi::middle as ffi;
use neon::prelude::*;

use crate::types::Type;

#[derive(Debug, Clone, Default, PartialEq)]
pub enum ListType {

    #[default]
    Array,

    GList,

    GSList,
}

#[derive(Debug, Clone)]
pub struct ArrayType {

    pub item_type: Box<Type>,

    pub list_type: ListType,

    pub is_borrowed: bool,
}

impl ArrayType {

    pub fn new(item_type: Type) -> Self {
        ArrayType {
            item_type: Box::new(item_type),
            list_type: ListType::Array,
            is_borrowed: false,
        }
    }

    pub fn from_js_value(cx: &mut FunctionContext, value: Handle<JsValue>) -> NeonResult<Self> {
        let obj = value.downcast::<JsObject, _>(cx).or_throw(cx)?;
        let item_type_value: Handle<'_, JsValue> = obj.prop(cx, "itemType").get()?;
        let item_type = Type::from_js_value(cx, item_type_value)?;

        let list_type_str: Option<Handle<JsString>> = obj.get_opt(cx, "listType")?;
        let list_type = match list_type_str.map(|s| s.value(cx)).as_deref() {
            Some("glist") => ListType::GList,
            Some("gslist") => ListType::GSList,
            _ => ListType::Array,
        };

        let is_borrowed: Option<Handle<JsBoolean>> = obj.get_opt(cx, "borrowed")?;
        let is_borrowed = is_borrowed.map(|b| b.value(cx)).unwrap_or(false);

        Ok(ArrayType {
            item_type: Box::new(item_type),
            list_type,
            is_borrowed,
        })
    }
}

impl From<&ArrayType> for ffi::Type {
    fn from(_value: &ArrayType) -> Self {
        ffi::Type::pointer()
    }
}

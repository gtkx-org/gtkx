use libffi::middle as ffi;
use neon::prelude::*;

use crate::ownership::parse_is_transfer_full;
use crate::types::Type;

#[derive(Debug, Clone)]
pub struct HashTableType {
    pub key_type: Box<Type>,
    pub value_type: Box<Type>,
    pub is_transfer_full: bool,
}

impl HashTableType {
    pub fn new(key_type: Type, value_type: Type, is_transfer_full: bool) -> Self {
        HashTableType {
            key_type: Box::new(key_type),
            value_type: Box::new(value_type),
            is_transfer_full,
        }
    }

    pub fn from_js_value(cx: &mut FunctionContext, value: Handle<JsValue>) -> NeonResult<Self> {
        let obj = value.downcast::<JsObject, _>(cx).or_throw(cx)?;

        let key_type_value: Handle<'_, JsValue> = obj.prop(cx, "keyType").get()?;
        let key_type = Type::from_js_value(cx, key_type_value)?;

        let value_type_value: Handle<'_, JsValue> = obj.prop(cx, "valueType").get()?;
        let value_type = Type::from_js_value(cx, value_type_value)?;

        let is_transfer_full = parse_is_transfer_full(cx, obj, "hashtable")?;

        Ok(HashTableType {
            key_type: Box::new(key_type),
            value_type: Box::new(value_type),
            is_transfer_full,
        })
    }
}

impl From<&HashTableType> for ffi::Type {
    fn from(_value: &HashTableType) -> Self {
        ffi::Type::pointer()
    }
}

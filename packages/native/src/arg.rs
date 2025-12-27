

use neon::{object::Object as _, prelude::*};

use crate::{types::Type, value::Value};

#[derive(Debug, Clone)]
pub struct Arg {

    pub type_: Type,

    pub value: Value,

    pub optional: bool,
}

impl Arg {

    pub fn new(type_: Type, value: Value) -> Self {
        Arg {
            type_,
            value,
            optional: false,
        }
    }

    pub fn from_js_array(
        cx: &mut FunctionContext,
        value: Handle<JsArray>,
    ) -> NeonResult<Vec<Self>> {
        let array = value.to_vec(cx)?;
        let mut args = Vec::with_capacity(array.len());

        for item in array {
            args.push(Self::from_js_value(cx, item)?);
        }

        Ok(args)
    }

    pub fn from_js_value(cx: &mut FunctionContext, value: Handle<JsValue>) -> NeonResult<Self> {
        let obj = value.downcast::<JsObject, _>(cx).or_throw(cx)?;
        let type_prop: Handle<'_, JsValue> = obj.prop(cx, "type").get()?;
        let value_prop: Handle<'_, JsValue> = obj.prop(cx, "value").get()?;
        let type_ = Type::from_js_value(cx, type_prop)?;
        let value = Value::from_js_value(cx, value_prop)?;

        let optional_prop: Option<Handle<JsBoolean>> = obj.get_opt(cx, "optional")?;
        let optional = optional_prop.map(|h| h.value(cx)).unwrap_or(false);

        Ok(Arg {
            type_,
            value,
            optional,
        })
    }
}

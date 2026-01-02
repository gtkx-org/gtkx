//! Function argument representation combining type and value.
//!
//! [`Arg`] pairs a [`Type`] descriptor with a [`Value`], representing a single
//! argument to an FFI function call. Arguments are parsed from JavaScript
//! objects containing `type`, `value`, and optional `optional` properties.
//!
//! ## Structure
//!
//! ```text
//! { type: TypeDescriptor, value: any, optional?: boolean }
//! ```
//!
//! The `optional` flag allows null/undefined values for otherwise required types,
//! converting them to appropriate defaults (null pointers, zero values).

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

        let optional = {
            let optional_prop: Result<Handle<JsValue>, _> = obj.prop(cx, "optional").get();
            match optional_prop {
                Ok(prop) => {
                    // Check if it's undefined/null (which means false) or a boolean
                    if prop.is_a::<JsUndefined, _>(cx) || prop.is_a::<JsNull, _>(cx) {
                        false
                    } else {
                        prop
                            .downcast::<JsBoolean, _>(cx)
                            .or_else(|_| cx.throw_type_error("'optional' property must be a boolean"))?
                            .value(cx)
                    }
                }
                Err(_) => false,
            }
        };

        Ok(Arg {
            type_,
            value,
            optional,
        })
    }
}

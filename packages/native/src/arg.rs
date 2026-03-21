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
    pub ty: Type,
    pub value: Value,
    pub optional: bool,
}

impl Arg {
    #[must_use]
    pub fn new(ty: Type, value: Value) -> Self {
        Arg {
            ty,
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
        let ty = Type::from_js_value(cx, type_prop)?;
        let value = Value::from_js_value(cx, value_prop)?;

        let optional = obj
            .get_opt::<JsBoolean, _, _>(cx, "optional")?
            .map(|v| v.value(cx))
            .unwrap_or(false);

        Ok(Arg {
            ty,
            value,
            optional,
        })
    }
}

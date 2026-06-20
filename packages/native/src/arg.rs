use napi::bindgen_prelude::*;
use napi::{Env, JsObject};

use crate::{types::Type, value::Value};

#[derive(Debug, Clone)]
pub struct Arg {
    pub ty: Type,
    pub value: Value,
}

impl Arg {
    #[must_use]
    pub fn new(ty: Type, value: Value) -> Self {
        Self { ty, value }
    }

    #[cfg_attr(coverage_nightly, coverage(off))]
    pub fn from_js_array(env: &Env, value: &Array) -> napi::Result<Vec<Self>> {
        crate::value::map_js_array(env, value, Self::from_js_value)
    }

    #[cfg_attr(coverage_nightly, coverage(off))]
    pub fn from_js_value(env: &Env, value: Unknown<'_>) -> napi::Result<Self> {
        let obj: JsObject = crate::value::unknown_as_object(env, &value)?;
        let type_prop: Unknown<'_> = obj.get_named_property("type")?;
        let value_prop: Unknown<'_> = obj.get_named_property("value")?;
        let ty = Type::from_js_value(env, type_prop)?;
        if !ty.can_be_argument_type() {
            return Err(napi::Error::new(
                napi::Status::InvalidArg,
                format!("'{ty}' cannot be used as a function argument type"),
            ));
        }
        let value = Value::from_js_value(env, value_prop)?;

        Ok(Self { ty, value })
    }
}

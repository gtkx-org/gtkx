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

use napi::bindgen_prelude::*;
use napi::{Env, JsObject};

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
        Self {
            ty,
            value,
            optional: false,
        }
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

        let optional =
            crate::types::optional_descriptor_property::<bool>(&obj, "optional")?.unwrap_or(false);

        Ok(Self {
            ty,
            value,
            optional,
        })
    }
}

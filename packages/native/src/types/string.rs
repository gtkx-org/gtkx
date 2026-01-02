//! String type representation for FFI.
//!
//! Defines [`StringType`] with an ownership flag. Strings are passed as
//! pointers (`*const c_char`) at the FFI level.
//!
//! - `ownership: "full"` - Caller takes ownership and must free
//! - `ownership: "none"` - Caller must not free the string

use libffi::middle as ffi;
use neon::prelude::*;

use crate::ownership::parse_is_transfer_full;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct StringType {
    /// Whether ownership is transferred (transfer full).
    pub is_transfer_full: bool,
    pub length: Option<usize>,
}

impl StringType {
    pub fn new(is_transfer_full: bool) -> Self {
        StringType {
            is_transfer_full,
            length: None,
        }
    }

    pub fn with_length(is_transfer_full: bool, length: usize) -> Self {
        StringType {
            is_transfer_full,
            length: Some(length),
        }
    }

    pub fn from_js_value(cx: &mut FunctionContext, value: Handle<JsValue>) -> NeonResult<Self> {
        let obj = value.downcast::<JsObject, _>(cx).or_throw(cx)?;
        let is_transfer_full = parse_is_transfer_full(cx, obj, "string")?;

        let length_prop: Handle<'_, JsValue> = obj.prop(cx, "length").get()?;
        let length = length_prop
            .downcast::<JsNumber, _>(cx)
            .map(|n| n.value(cx) as usize)
            .ok();

        Ok(StringType {
            is_transfer_full,
            length,
        })
    }
}

impl From<&StringType> for ffi::Type {
    fn from(_: &StringType) -> Self {
        ffi::Type::pointer()
    }
}


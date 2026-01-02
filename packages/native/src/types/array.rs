//! Array and list type representation for FFI.
//!
//! Defines [`ArrayType`] for homogeneous collections. Supports three container types:
//!
//! - [`ListType::Array`] - C-style null-terminated arrays
//! - [`ListType::GList`] - GLib doubly-linked lists
//! - [`ListType::GSList`] - GLib singly-linked lists
//!
//! All are passed as pointers at the FFI level.
//!
//! - `ownership: "full"` - Ownership transferred, caller should free when done
//! - `ownership: "none"` - Reference is borrowed, caller must not free

use libffi::middle as ffi;
use neon::prelude::*;

use crate::ownership::parse_is_transfer_full;
use crate::types::Type;

#[derive(Debug, Clone, PartialEq)]
pub enum ListType {
    Array,
    GList,
    GSList,
}

#[derive(Debug, Clone)]
pub struct ArrayType {
    pub item_type: Box<Type>,
    pub list_type: ListType,
    /// Whether ownership is transferred (transfer full).
    pub is_transfer_full: bool,
}

impl ArrayType {
    pub fn new(item_type: Type, list_type: ListType, is_transfer_full: bool) -> Self {
        ArrayType {
            item_type: Box::new(item_type),
            list_type,
            is_transfer_full,
        }
    }

    pub fn from_js_value(cx: &mut FunctionContext, value: Handle<JsValue>) -> NeonResult<Self> {
        let obj = value.downcast::<JsObject, _>(cx).or_throw(cx)?;
        let item_type_value: Handle<'_, JsValue> = obj.prop(cx, "itemType").get()?;
        let item_type = Type::from_js_value(cx, item_type_value)?;

        let list_type_prop: Handle<'_, JsValue> = obj.prop(cx, "listType").get()?;
        let list_type_str = list_type_prop
            .downcast::<JsString, _>(cx)
            .or_else(|_| cx.throw_type_error("'listType' property is required for array types"))?
            .value(cx);

        let list_type = match list_type_str.as_str() {
            "array" => ListType::Array,
            "glist" => ListType::GList,
            "gslist" => ListType::GSList,
            _ => return cx.throw_type_error("'listType' must be 'array', 'glist', or 'gslist'"),
        };

        let is_transfer_full = parse_is_transfer_full(cx, obj, "array")?;

        Ok(ArrayType {
            item_type: Box::new(item_type),
            list_type,
            is_transfer_full,
        })
    }
}

impl From<&ArrayType> for ffi::Type {
    fn from(_: &ArrayType) -> Self {
        ffi::Type::pointer()
    }
}


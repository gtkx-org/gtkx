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
    GPtrArray,
    GArray,
    Sized { length_param_index: usize },
    Fixed { size: usize },
}

#[derive(Debug, Clone)]
pub struct ArrayType {
    pub item_type: Box<Type>,
    pub list_type: ListType,
    pub is_transfer_full: bool,
    pub element_size: Option<usize>,
}

impl ArrayType {
    pub fn new(item_type: Type, list_type: ListType, is_transfer_full: bool) -> Self {
        ArrayType {
            item_type: Box::new(item_type),
            list_type,
            is_transfer_full,
            element_size: None,
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
            "gptrarray" => ListType::GPtrArray,
            "garray" => ListType::GArray,
            "sized" => {
                let length_param_index: Handle<JsNumber> =
                    obj.get_opt(cx, "lengthParamIndex")?.ok_or_else(|| {
                        cx.throw_type_error::<_, ()>(
                            "'lengthParamIndex' is required for sized arrays",
                        )
                        .unwrap_err()
                    })?;
                ListType::Sized {
                    length_param_index: length_param_index.value(cx) as usize,
                }
            }
            "fixed" => {
                let fixed_size: Handle<JsNumber> =
                    obj.get_opt(cx, "fixedSize")?.ok_or_else(|| {
                        cx.throw_type_error::<_, ()>("'fixedSize' is required for fixed arrays")
                            .unwrap_err()
                    })?;
                ListType::Fixed {
                    size: fixed_size.value(cx) as usize,
                }
            }
            _ => {
                return cx.throw_type_error(
                    "'listType' must be 'array', 'glist', 'gslist', 'gptrarray', 'garray', 'sized', or 'fixed'",
                );
            }
        };

        let element_size: Option<usize> = if list_type == ListType::GArray {
            let size_prop: Option<Handle<JsNumber>> = obj.get_opt(cx, "elementSize")?;
            size_prop.map(|n| n.value(cx) as usize)
        } else {
            None
        };

        let is_transfer_full = parse_is_transfer_full(cx, obj, "array")?;

        Ok(ArrayType {
            item_type: Box::new(item_type),
            list_type,
            is_transfer_full,
            element_size,
        })
    }
}

impl From<&ArrayType> for ffi::Type {
    fn from(_: &ArrayType) -> Self {
        ffi::Type::pointer()
    }
}

//! Plain struct type representation for FFI.
//!
//! Defines [`StructType`] for plain C structs that don't have GType registration
//! (like `PangoRectangle`). Unlike boxed types, these are simply allocated with
//! `g_malloc0` and freed with `g_free`.
//!
//! - `ownership: "full"` - Ownership transferred, caller should free when done
//! - `ownership: "none"` - Reference is borrowed, caller must not free

use libffi::middle as ffi;
use neon::prelude::*;

use crate::ownership::parse_is_transfer_full;

/// Represents a plain C struct type without GType registration.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StructType {
    /// Whether ownership is transferred (transfer full).
    pub is_transfer_full: bool,
    /// The struct type name (for debugging/error messages).
    pub type_: String,
    /// Size of the struct in bytes (for allocation).
    pub size: Option<usize>,
}

impl StructType {
    pub fn new(is_transfer_full: bool, type_: String, size: Option<usize>) -> Self {
        StructType {
            is_transfer_full,
            type_,
            size,
        }
    }

    pub fn from_js_value(cx: &mut FunctionContext, value: Handle<JsValue>) -> NeonResult<Self> {
        let obj = value.downcast::<JsObject, _>(cx).or_throw(cx)?;
        let is_transfer_full = parse_is_transfer_full(cx, obj, "struct")?;

        let type_prop: Handle<'_, JsValue> = obj.prop(cx, "innerType").get()?;
        let type_ = type_prop
            .downcast::<JsString, _>(cx)
            .or_throw(cx)?
            .value(cx);

        let size_prop: Handle<'_, JsValue> = obj.prop(cx, "size").get()?;
        let size = size_prop
            .downcast::<JsNumber, _>(cx)
            .map(|n| n.value(cx) as usize)
            .ok();

        Ok(Self::new(is_transfer_full, type_, size))
    }
}

impl From<&StructType> for ffi::Type {
    fn from(_: &StructType) -> Self {
        ffi::Type::pointer()
    }
}


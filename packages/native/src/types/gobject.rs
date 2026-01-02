//! GObject type representation for FFI.
//!
//! Defines [`GObjectType`] with an ownership flag. GObjects are passed as
//! pointers at the FFI level.
//!
//! - `ownership: "full"` - Ownership transferred, caller should unref when done
//! - `ownership: "none"` - Reference is borrowed, caller must not unref

use libffi::middle as ffi;
use neon::prelude::*;

use crate::ownership::parse_is_transfer_full;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct GObjectType {
    /// Whether ownership is transferred (transfer full).
    pub is_transfer_full: bool,
}

impl GObjectType {
    pub fn new(is_transfer_full: bool) -> Self {
        GObjectType { is_transfer_full }
    }

    pub fn from_js_value(cx: &mut FunctionContext, value: Handle<JsValue>) -> NeonResult<Self> {
        let obj = value.downcast::<JsObject, _>(cx).or_throw(cx)?;
        let is_transfer_full = parse_is_transfer_full(cx, obj, "gobject")?;
        Ok(Self::new(is_transfer_full))
    }
}

impl From<&GObjectType> for ffi::Type {
    fn from(_: &GObjectType) -> Self {
        ffi::Type::pointer()
    }
}


//! GVariant type representation for FFI.
//!
//! Defines [`GVariantType`] with an ownership flag. GVariants are passed as
//! pointers at the FFI level and use reference counting internally.
//!
//! - `ownership: "full"` - Ownership transferred, caller should unref when done
//! - `ownership: "none"` - Reference is borrowed, caller must not unref

use libffi::middle as ffi;
use neon::prelude::*;

use crate::ownership::parse_is_transfer_full;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GVariantType {
    /// Whether ownership is transferred (transfer full).
    pub is_transfer_full: bool,
}

impl GVariantType {
    pub fn new(is_transfer_full: bool) -> Self {
        GVariantType { is_transfer_full }
    }

    pub fn from_js_value(cx: &mut FunctionContext, value: Handle<JsValue>) -> NeonResult<Self> {
        let obj = value.downcast::<JsObject, _>(cx).or_throw(cx)?;
        let is_transfer_full = parse_is_transfer_full(cx, obj, "gvariant")?;
        Ok(Self::new(is_transfer_full))
    }
}

impl From<&GVariantType> for ffi::Type {
    fn from(_: &GVariantType) -> Self {
        ffi::Type::pointer()
    }
}


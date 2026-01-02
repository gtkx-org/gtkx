//! GParamSpec type representation for FFI.
//!
//! Defines [`GParamType`] with an ownership flag. GParamSpec is a fundamental
//! type in GLib that requires `g_value_get_param` for extraction from GValues.
//!
//! - `ownership: "full"` - Ownership transferred, caller should unref when done
//! - `ownership: "none"` - Reference is borrowed, caller must not unref

use libffi::middle as ffi;
use neon::prelude::*;

use crate::ownership::parse_is_transfer_full;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct GParamType {
    /// Whether ownership is transferred (transfer full).
    pub is_transfer_full: bool,
}

impl GParamType {
    pub fn new(is_transfer_full: bool) -> Self {
        GParamType { is_transfer_full }
    }

    pub fn from_js_value(cx: &mut FunctionContext, value: Handle<JsValue>) -> NeonResult<Self> {
        let obj = value.downcast::<JsObject, _>(cx).or_throw(cx)?;
        let is_transfer_full = parse_is_transfer_full(cx, obj, "gparam")?;
        Ok(Self::new(is_transfer_full))
    }
}

impl From<&GParamType> for ffi::Type {
    fn from(_: &GParamType) -> Self {
        ffi::Type::pointer()
    }
}


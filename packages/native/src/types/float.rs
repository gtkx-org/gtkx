//! Floating-point type representation for FFI.
//!
//! Defines [`FloatType`] with size information for proper memory layout
//! and libffi type selection. Supports 32-bit (f32) and 64-bit (f64) floats.

use libffi::middle as ffi;
use neon::prelude::*;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FloatSize {
    _32,
    _64,
}

impl std::fmt::Display for FloatSize {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            FloatSize::_32 => write!(f, "32"),
            FloatSize::_64 => write!(f, "64"),
        }
    }
}

impl TryFrom<u64> for FloatSize {
    type Error = ();

    fn try_from(value: u64) -> Result<Self, Self::Error> {
        match value {
            32 => Ok(FloatSize::_32),
            64 => Ok(FloatSize::_64),
            _ => Err(()),
        }
    }
}

impl FloatSize {
    pub fn from_js_value(cx: &mut FunctionContext, value: Handle<JsValue>) -> NeonResult<Self> {
        let size = value.downcast::<JsNumber, _>(cx).or_throw(cx)?;

        (size.value(cx) as u64)
            .try_into()
            .or_else(|_| cx.throw_type_error("Invalid float size"))
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct FloatType {
    pub size: FloatSize,
}

impl FloatType {
    pub fn new(size: FloatSize) -> Self {
        FloatType { size }
    }

    pub fn from_js_value(cx: &mut FunctionContext, value: Handle<JsValue>) -> NeonResult<Self> {
        let obj = value.downcast::<JsObject, _>(cx).or_throw(cx)?;
        let size_prop = obj.prop(cx, "size").get()?;
        let size = FloatSize::from_js_value(cx, size_prop)?;

        Ok(Self::new(size))
    }
}

impl From<&FloatType> for ffi::Type {
    fn from(value: &FloatType) -> Self {
        match value.size {
            FloatSize::_32 => ffi::Type::f32(),
            FloatSize::_64 => ffi::Type::f64(),
        }
    }
}


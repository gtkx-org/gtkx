

use libffi::middle as ffi;
use neon::prelude::*;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FloatSize {

    _32,

    _64,
}

impl FloatSize {

    pub fn from_js_value(cx: &mut FunctionContext, value: Handle<JsValue>) -> NeonResult<Self> {
        let size = value.downcast::<JsNumber, _>(cx).or_throw(cx)?;

        match size.value(cx) as u64 {
            32 => Ok(FloatSize::_32),
            64 => Ok(FloatSize::_64),
            _ => cx.throw_type_error("Invalid float size"),
        }
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

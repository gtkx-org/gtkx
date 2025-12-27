

use libffi::middle as ffi;
use neon::prelude::*;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum IntegerSize {

    _8,

    _16,

    _32,

    _64,
}

impl IntegerSize {

    pub fn from_js_value(cx: &mut FunctionContext, value: Handle<JsValue>) -> NeonResult<Self> {
        let size = value.downcast::<JsNumber, _>(cx).or_throw(cx)?;

        match size.value(cx) as u64 {
            8 => Ok(IntegerSize::_8),
            16 => Ok(IntegerSize::_16),
            32 => Ok(IntegerSize::_32),
            64 => Ok(IntegerSize::_64),
            _ => cx.throw_type_error("Invalid integer size"),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum IntegerSign {

    Unsigned,

    Signed,
}

impl IntegerSign {

    pub fn from_js_value(cx: &mut FunctionContext, value: Handle<JsValue>) -> NeonResult<Self> {
        let is_unsigned = value
            .downcast::<JsBoolean, _>(cx)
            .map(|b| b.value(cx))
            .unwrap_or(true);

        Ok(if is_unsigned {
            IntegerSign::Unsigned
        } else {
            IntegerSign::Signed
        })
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct IntegerType {

    pub size: IntegerSize,

    pub sign: IntegerSign,
}

impl IntegerType {

    pub fn new(size: IntegerSize, sign: IntegerSign) -> Self {
        IntegerType { size, sign }
    }

    pub fn from_js_value(cx: &mut FunctionContext, value: Handle<JsValue>) -> NeonResult<Self> {
        let obj = value.downcast::<JsObject, _>(cx).or_throw(cx)?;
        let size_prop = obj.prop(cx, "size").get()?;
        let sign_prop = obj.prop(cx, "unsigned").get()?;
        let size = IntegerSize::from_js_value(cx, size_prop)?;
        let sign = IntegerSign::from_js_value(cx, sign_prop)?;

        Ok(Self::new(size, sign))
    }
}

impl From<&IntegerType> for ffi::Type {
    fn from(value: &IntegerType) -> Self {
        match (value.size, value.sign) {
            (IntegerSize::_8, IntegerSign::Unsigned) => ffi::Type::u8(),
            (IntegerSize::_8, IntegerSign::Signed) => ffi::Type::i8(),
            (IntegerSize::_16, IntegerSign::Unsigned) => ffi::Type::u16(),
            (IntegerSize::_16, IntegerSign::Signed) => ffi::Type::i16(),
            (IntegerSize::_32, IntegerSign::Unsigned) => ffi::Type::u32(),
            (IntegerSize::_32, IntegerSign::Signed) => ffi::Type::i32(),
            (IntegerSize::_64, IntegerSign::Unsigned) => ffi::Type::u64(),
            (IntegerSize::_64, IntegerSign::Signed) => ffi::Type::i64(),
        }
    }
}

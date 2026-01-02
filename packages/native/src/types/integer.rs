//! Integer type representation for FFI.
//!
//! Defines [`IntegerType`] with size and sign information for proper
//! memory layout and libffi type selection. Supports 8, 16, 32, and 64-bit
//! integers in both signed and unsigned variants.

use libffi::middle as ffi;
use neon::prelude::*;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum IntegerSize {
    _8,
    _16,
    _32,
    _64,
}

impl std::fmt::Display for IntegerSize {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            IntegerSize::_8 => write!(f, "8"),
            IntegerSize::_16 => write!(f, "16"),
            IntegerSize::_32 => write!(f, "32"),
            IntegerSize::_64 => write!(f, "64"),
        }
    }
}

impl TryFrom<u64> for IntegerSize {
    type Error = ();

    fn try_from(value: u64) -> Result<Self, Self::Error> {
        match value {
            8 => Ok(IntegerSize::_8),
            16 => Ok(IntegerSize::_16),
            32 => Ok(IntegerSize::_32),
            64 => Ok(IntegerSize::_64),
            _ => Err(()),
        }
    }
}

impl IntegerSize {
    pub fn from_js_value(cx: &mut FunctionContext, value: Handle<JsValue>) -> NeonResult<Self> {
        let size = value.downcast::<JsNumber, _>(cx).or_throw(cx)?;

        (size.value(cx) as u64)
            .try_into()
            .or_else(|_| cx.throw_type_error("Invalid integer size"))
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum IntegerSign {
    Unsigned,
    Signed,
}

impl std::fmt::Display for IntegerSign {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            IntegerSign::Unsigned => write!(f, "unsigned"),
            IntegerSign::Signed => write!(f, "signed"),
        }
    }
}

impl IntegerSign {
    pub fn from_js_value(cx: &mut FunctionContext, value: Handle<JsValue>) -> NeonResult<Self> {
        let is_unsigned = value
            .downcast::<JsBoolean, _>(cx)
            .or_else(|_| cx.throw_type_error("'unsigned' property is required for integer types"))?
            .value(cx);

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


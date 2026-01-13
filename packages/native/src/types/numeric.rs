use anyhow::bail;
use libffi::middle as libffi;
use neon::prelude::*;

use crate::{ffi, value};

pub trait NumericPrimitive: Sized + Copy + 'static {
    fn ffi_type() -> libffi::Type;
    fn to_f64(self) -> f64;
    fn from_f64(value: f64) -> Self;
    fn to_ffi_value(self) -> ffi::FfiValue;
    fn vec_to_ffi_storage(vec: Vec<Self>) -> ffi::FfiStorage;

    fn read_unaligned(ptr: *const u8) -> Self {
        // SAFETY: The caller guarantees ptr is valid for reading a Self value
        unsafe { ptr.cast::<Self>().read_unaligned() }
    }

    fn write_unaligned(ptr: *mut u8, value: Self) {
        // SAFETY: The caller guarantees ptr is valid for writing a Self value
        unsafe { ptr.cast::<Self>().write_unaligned(value) }
    }
}

pub trait IntegerPrimitive: NumericPrimitive {
    fn read_slice(ptr: *const u8, length: usize) -> Vec<f64> {
        // SAFETY: The caller guarantees ptr points to at least `length` elements
        unsafe {
            std::slice::from_raw_parts(ptr.cast::<Self>(), length)
                .iter()
                .map(|v| v.to_f64())
                .collect()
        }
    }

    fn to_ffi_storage(values: &[f64]) -> ffi::FfiStorage {
        let vec: Vec<Self> = values.iter().map(|&v| Self::from_f64(v)).collect();
        Self::vec_to_ffi_storage(vec)
    }
}

impl NumericPrimitive for u8 {
    fn ffi_type() -> libffi::Type {
        libffi::Type::u8()
    }
    fn to_f64(self) -> f64 {
        self as f64
    }
    fn from_f64(value: f64) -> Self {
        value as Self
    }
    fn to_ffi_value(self) -> ffi::FfiValue {
        ffi::FfiValue::U8(self)
    }
    fn vec_to_ffi_storage(vec: Vec<Self>) -> ffi::FfiStorage {
        vec.into()
    }
}

impl NumericPrimitive for i8 {
    fn ffi_type() -> libffi::Type {
        libffi::Type::i8()
    }
    fn to_f64(self) -> f64 {
        self as f64
    }
    fn from_f64(value: f64) -> Self {
        value as Self
    }
    fn to_ffi_value(self) -> ffi::FfiValue {
        ffi::FfiValue::I8(self)
    }
    fn vec_to_ffi_storage(vec: Vec<Self>) -> ffi::FfiStorage {
        vec.into()
    }
}

impl NumericPrimitive for u16 {
    fn ffi_type() -> libffi::Type {
        libffi::Type::u16()
    }
    fn to_f64(self) -> f64 {
        self as f64
    }
    fn from_f64(value: f64) -> Self {
        value as Self
    }
    fn to_ffi_value(self) -> ffi::FfiValue {
        ffi::FfiValue::U16(self)
    }
    fn vec_to_ffi_storage(vec: Vec<Self>) -> ffi::FfiStorage {
        vec.into()
    }
}

impl NumericPrimitive for i16 {
    fn ffi_type() -> libffi::Type {
        libffi::Type::i16()
    }
    fn to_f64(self) -> f64 {
        self as f64
    }
    fn from_f64(value: f64) -> Self {
        value as Self
    }
    fn to_ffi_value(self) -> ffi::FfiValue {
        ffi::FfiValue::I16(self)
    }
    fn vec_to_ffi_storage(vec: Vec<Self>) -> ffi::FfiStorage {
        vec.into()
    }
}

impl NumericPrimitive for u32 {
    fn ffi_type() -> libffi::Type {
        libffi::Type::u32()
    }
    fn to_f64(self) -> f64 {
        self as f64
    }
    fn from_f64(value: f64) -> Self {
        value as Self
    }
    fn to_ffi_value(self) -> ffi::FfiValue {
        ffi::FfiValue::U32(self)
    }
    fn vec_to_ffi_storage(vec: Vec<Self>) -> ffi::FfiStorage {
        vec.into()
    }
}

impl NumericPrimitive for i32 {
    fn ffi_type() -> libffi::Type {
        libffi::Type::i32()
    }
    fn to_f64(self) -> f64 {
        self as f64
    }
    fn from_f64(value: f64) -> Self {
        value as Self
    }
    fn to_ffi_value(self) -> ffi::FfiValue {
        ffi::FfiValue::I32(self)
    }
    fn vec_to_ffi_storage(vec: Vec<Self>) -> ffi::FfiStorage {
        vec.into()
    }
}

impl NumericPrimitive for u64 {
    fn ffi_type() -> libffi::Type {
        libffi::Type::u64()
    }
    fn to_f64(self) -> f64 {
        self as f64
    }
    fn from_f64(value: f64) -> Self {
        value as Self
    }
    fn to_ffi_value(self) -> ffi::FfiValue {
        ffi::FfiValue::U64(self)
    }
    fn vec_to_ffi_storage(vec: Vec<Self>) -> ffi::FfiStorage {
        vec.into()
    }
}

impl NumericPrimitive for i64 {
    fn ffi_type() -> libffi::Type {
        libffi::Type::i64()
    }
    fn to_f64(self) -> f64 {
        self as f64
    }
    fn from_f64(value: f64) -> Self {
        value as Self
    }
    fn to_ffi_value(self) -> ffi::FfiValue {
        ffi::FfiValue::I64(self)
    }
    fn vec_to_ffi_storage(vec: Vec<Self>) -> ffi::FfiStorage {
        vec.into()
    }
}

impl NumericPrimitive for f32 {
    fn ffi_type() -> libffi::Type {
        libffi::Type::f32()
    }
    fn to_f64(self) -> f64 {
        self as f64
    }
    fn from_f64(value: f64) -> Self {
        value as Self
    }
    fn to_ffi_value(self) -> ffi::FfiValue {
        ffi::FfiValue::F32(self)
    }
    fn vec_to_ffi_storage(vec: Vec<Self>) -> ffi::FfiStorage {
        vec.into()
    }
}

impl NumericPrimitive for f64 {
    fn ffi_type() -> libffi::Type {
        libffi::Type::f64()
    }
    fn to_f64(self) -> f64 {
        self
    }
    fn from_f64(value: f64) -> Self {
        value
    }
    fn to_ffi_value(self) -> ffi::FfiValue {
        ffi::FfiValue::F64(self)
    }
    fn vec_to_ffi_storage(vec: Vec<Self>) -> ffi::FfiStorage {
        vec.into()
    }
}

impl IntegerPrimitive for u8 {}
impl IntegerPrimitive for i8 {}
impl IntegerPrimitive for u16 {}
impl IntegerPrimitive for i16 {}
impl IntegerPrimitive for u32 {}
impl IntegerPrimitive for i32 {}
impl IntegerPrimitive for u64 {}
impl IntegerPrimitive for i64 {}

#[derive(Debug, Clone, Copy)]
pub enum IntegerKind {
    U8,
    I8,
    U16,
    I16,
    U32,
    I32,
    U64,
    I64,
}

impl IntegerKind {
    pub fn from_size_and_sign(size: u64, unsigned: bool) -> Option<Self> {
        match (size, unsigned) {
            (8, true) => Some(Self::U8),
            (8, false) => Some(Self::I8),
            (16, true) => Some(Self::U16),
            (16, false) => Some(Self::I16),
            (32, true) => Some(Self::U32),
            (32, false) => Some(Self::I32),
            (64, true) => Some(Self::U64),
            (64, false) => Some(Self::I64),
            _ => None,
        }
    }

    pub fn from_js_value(cx: &mut FunctionContext, value: Handle<JsValue>) -> NeonResult<Self> {
        let obj = value.downcast::<JsObject, _>(cx).or_throw(cx)?;

        let size_prop: Handle<JsNumber> = obj.prop(cx, "size").get()?;
        let size = size_prop.value(cx) as u64;

        let unsigned_prop: Handle<JsBoolean> = obj.get_opt(cx, "unsigned")?.ok_or_else(|| {
            cx.throw_type_error::<_, ()>("'unsigned' property is required for integer types")
                .unwrap_err()
        })?;
        let unsigned = unsigned_prop.value(cx);

        IntegerKind::from_size_and_sign(size, unsigned).ok_or_else(|| {
            cx.throw_type_error::<_, ()>(format!("Invalid integer size: {}", size))
                .unwrap_err()
        })
    }

    pub fn is_unsigned(self) -> bool {
        matches!(self, Self::U8 | Self::U16 | Self::U32 | Self::U64)
    }

    pub fn byte_size(self) -> usize {
        match self {
            Self::U8 | Self::I8 => 1,
            Self::U16 | Self::I16 => 2,
            Self::U32 | Self::I32 => 4,
            Self::U64 | Self::I64 => 8,
        }
    }

    pub fn ffi_type(self) -> libffi::Type {
        match self {
            Self::U8 => u8::ffi_type(),
            Self::I8 => i8::ffi_type(),
            Self::U16 => u16::ffi_type(),
            Self::I16 => i16::ffi_type(),
            Self::U32 => u32::ffi_type(),
            Self::I32 => i32::ffi_type(),
            Self::U64 => u64::ffi_type(),
            Self::I64 => i64::ffi_type(),
        }
    }

    pub fn read_ptr(self, ptr: *const u8) -> f64 {
        match self {
            Self::U8 => u8::read_unaligned(ptr).to_f64(),
            Self::I8 => i8::read_unaligned(ptr).to_f64(),
            Self::U16 => u16::read_unaligned(ptr).to_f64(),
            Self::I16 => i16::read_unaligned(ptr).to_f64(),
            Self::U32 => u32::read_unaligned(ptr).to_f64(),
            Self::I32 => i32::read_unaligned(ptr).to_f64(),
            Self::U64 => u64::read_unaligned(ptr).to_f64(),
            Self::I64 => i64::read_unaligned(ptr).to_f64(),
        }
    }

    pub fn write_ptr(self, ptr: *mut u8, value: f64) {
        match self {
            Self::U8 => u8::write_unaligned(ptr, u8::from_f64(value)),
            Self::I8 => i8::write_unaligned(ptr, i8::from_f64(value)),
            Self::U16 => u16::write_unaligned(ptr, u16::from_f64(value)),
            Self::I16 => i16::write_unaligned(ptr, i16::from_f64(value)),
            Self::U32 => u32::write_unaligned(ptr, u32::from_f64(value)),
            Self::I32 => i32::write_unaligned(ptr, i32::from_f64(value)),
            Self::U64 => u64::write_unaligned(ptr, u64::from_f64(value)),
            Self::I64 => i64::write_unaligned(ptr, i64::from_f64(value)),
        }
    }

    pub fn to_ffi_value(self, value: f64) -> ffi::FfiValue {
        match self {
            Self::U8 => u8::from_f64(value).to_ffi_value(),
            Self::I8 => i8::from_f64(value).to_ffi_value(),
            Self::U16 => u16::from_f64(value).to_ffi_value(),
            Self::I16 => i16::from_f64(value).to_ffi_value(),
            Self::U32 => u32::from_f64(value).to_ffi_value(),
            Self::I32 => i32::from_f64(value).to_ffi_value(),
            Self::U64 => u64::from_f64(value).to_ffi_value(),
            Self::I64 => i64::from_f64(value).to_ffi_value(),
        }
    }

    pub fn read_slice(self, ptr: *const u8, length: usize) -> Vec<f64> {
        match self {
            Self::U8 => u8::read_slice(ptr, length),
            Self::I8 => i8::read_slice(ptr, length),
            Self::U16 => u16::read_slice(ptr, length),
            Self::I16 => i16::read_slice(ptr, length),
            Self::U32 => u32::read_slice(ptr, length),
            Self::I32 => i32::read_slice(ptr, length),
            Self::U64 => u64::read_slice(ptr, length),
            Self::I64 => i64::read_slice(ptr, length),
        }
    }

    pub fn vec_to_f64(self, storage: &ffi::FfiStorage) -> anyhow::Result<Vec<f64>> {
        storage.as_numeric_slice(self)
    }

    pub fn to_ffi_storage(self, values: &[f64]) -> ffi::FfiStorage {
        match self {
            Self::U8 => u8::to_ffi_storage(values),
            Self::I8 => i8::to_ffi_storage(values),
            Self::U16 => u16::to_ffi_storage(values),
            Self::I16 => i16::to_ffi_storage(values),
            Self::U32 => u32::to_ffi_storage(values),
            Self::I32 => i32::to_ffi_storage(values),
            Self::U64 => u64::to_ffi_storage(values),
            Self::I64 => i64::to_ffi_storage(values),
        }
    }

    /// # Safety
    ///
    /// The caller must ensure that:
    /// - `cif` was constructed with the correct signature for the function at `ptr`
    /// - `ptr` points to a valid callable function
    /// - `args` contains valid arguments matching the CIF signature
    pub unsafe fn call_cif(
        self,
        cif: &libffi::Cif,
        ptr: libffi::CodePtr,
        args: &[libffi::Arg],
    ) -> ffi::FfiValue {
        // SAFETY: Caller guarantees cif, ptr, and args are valid for the FFI call
        unsafe {
            match self {
                Self::U8 => cif.call::<u8>(ptr, args).to_ffi_value(),
                Self::I8 => cif.call::<i8>(ptr, args).to_ffi_value(),
                Self::U16 => cif.call::<u16>(ptr, args).to_ffi_value(),
                Self::I16 => cif.call::<i16>(ptr, args).to_ffi_value(),
                Self::U32 => cif.call::<u32>(ptr, args).to_ffi_value(),
                Self::I32 => cif.call::<i32>(ptr, args).to_ffi_value(),
                Self::U64 => cif.call::<u64>(ptr, args).to_ffi_value(),
                Self::I64 => cif.call::<i64>(ptr, args).to_ffi_value(),
            }
        }
    }
}

impl From<IntegerKind> for libffi::Type {
    fn from(kind: IntegerKind) -> Self {
        kind.ffi_type()
    }
}

impl ffi::FfiEncode for IntegerKind {
    fn encode(&self, value: &value::Value, optional: bool) -> anyhow::Result<ffi::FfiValue> {
        let number = match value {
            value::Value::Number(n) => *n,
            value::Value::Null | value::Value::Undefined if optional => 0.0,
            _ => bail!("Expected a Number for integer type, got {:?}", value),
        };

        Ok(self.to_ffi_value(number))
    }
}

impl ffi::FfiDecode for IntegerKind {
    fn decode(&self, ffi_value: &ffi::FfiValue) -> anyhow::Result<value::Value> {
        Ok(value::Value::Number(ffi_value.to_number()?))
    }
}

#[derive(Debug, Clone)]
pub struct IntegerType {
    pub kind: IntegerKind,
    pub lib: Option<String>,
    pub get_type_fn: Option<String>,
}

impl IntegerType {
    pub fn from_js_value(cx: &mut FunctionContext, value: Handle<JsValue>) -> NeonResult<Self> {
        let obj = value.downcast::<JsObject, _>(cx).or_throw(cx)?;
        let kind = IntegerKind::from_js_value(cx, value)?;

        let lib: Option<String> = obj
            .get_opt::<JsString, _, _>(cx, "lib")?
            .map(|h| h.value(cx));
        let get_type_fn: Option<String> = obj
            .get_opt::<JsString, _, _>(cx, "getTypeFn")?
            .map(|h| h.value(cx));

        Ok(IntegerType {
            kind,
            lib,
            get_type_fn,
        })
    }

    pub fn is_enum_or_flags(&self) -> bool {
        self.lib.is_some() && self.get_type_fn.is_some()
    }
}

impl From<IntegerKind> for IntegerType {
    fn from(kind: IntegerKind) -> Self {
        IntegerType {
            kind,
            lib: None,
            get_type_fn: None,
        }
    }
}

impl From<&IntegerType> for libffi::Type {
    fn from(value: &IntegerType) -> Self {
        value.kind.ffi_type()
    }
}

impl ffi::FfiEncode for IntegerType {
    fn encode(&self, value: &value::Value, optional: bool) -> anyhow::Result<ffi::FfiValue> {
        self.kind.encode(value, optional)
    }
}

impl ffi::FfiDecode for IntegerType {
    fn decode(&self, ffi_value: &ffi::FfiValue) -> anyhow::Result<value::Value> {
        self.kind.decode(ffi_value)
    }
}

#[derive(Debug, Clone, Copy)]
pub enum FloatKind {
    F32,
    F64,
}

impl FloatKind {
    pub fn from_size(size: u64) -> Option<Self> {
        match size {
            32 => Some(Self::F32),
            64 => Some(Self::F64),
            _ => None,
        }
    }

    pub fn from_js_value(cx: &mut FunctionContext, value: Handle<JsValue>) -> NeonResult<Self> {
        let obj = value.downcast::<JsObject, _>(cx).or_throw(cx)?;
        let size_prop: Handle<JsNumber> = obj.prop(cx, "size").get()?;
        let size = size_prop.value(cx) as u64;

        FloatKind::from_size(size).ok_or_else(|| {
            cx.throw_type_error::<_, ()>(format!("Invalid float size: {}", size))
                .unwrap_err()
        })
    }

    pub fn ffi_type(self) -> libffi::Type {
        match self {
            Self::F32 => f32::ffi_type(),
            Self::F64 => f64::ffi_type(),
        }
    }

    pub fn read_ptr(self, ptr: *const u8) -> f64 {
        match self {
            Self::F32 => f32::read_unaligned(ptr).to_f64(),
            Self::F64 => f64::read_unaligned(ptr),
        }
    }

    pub fn write_ptr(self, ptr: *mut u8, value: f64) {
        match self {
            Self::F32 => f32::write_unaligned(ptr, value as f32),
            Self::F64 => f64::write_unaligned(ptr, value),
        }
    }

    pub fn to_ffi_value(self, value: f64) -> ffi::FfiValue {
        match self {
            Self::F32 => ffi::FfiValue::F32(value as f32),
            Self::F64 => ffi::FfiValue::F64(value),
        }
    }

    /// # Safety
    ///
    /// The caller must ensure that:
    /// - `cif` was constructed with the correct signature for the function at `ptr`
    /// - `ptr` points to a valid callable function
    /// - `args` contains valid arguments matching the CIF signature
    pub unsafe fn call_cif(
        self,
        cif: &libffi::Cif,
        ptr: libffi::CodePtr,
        args: &[libffi::Arg],
    ) -> ffi::FfiValue {
        // SAFETY: Caller guarantees cif, ptr, and args are valid for the FFI call
        unsafe {
            match self {
                Self::F32 => cif.call::<f32>(ptr, args).to_ffi_value(),
                Self::F64 => cif.call::<f64>(ptr, args).to_ffi_value(),
            }
        }
    }
}

impl From<FloatKind> for libffi::Type {
    fn from(kind: FloatKind) -> Self {
        kind.ffi_type()
    }
}

impl ffi::FfiEncode for FloatKind {
    fn encode(&self, value: &value::Value, optional: bool) -> anyhow::Result<ffi::FfiValue> {
        let number = match value {
            value::Value::Number(n) => *n,
            value::Value::Null | value::Value::Undefined if optional => 0.0,
            _ => bail!("Expected a Number for float type, got {:?}", value),
        };

        Ok(self.to_ffi_value(number))
    }
}

impl ffi::FfiDecode for FloatKind {
    fn decode(&self, ffi_value: &ffi::FfiValue) -> anyhow::Result<value::Value> {
        Ok(value::Value::Number(ffi_value.to_number()?))
    }
}

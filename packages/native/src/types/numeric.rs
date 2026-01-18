use anyhow::bail;
use libffi::middle as libffi;
use neon::prelude::*;

use crate::{ffi, value};

mod sealed {
    pub trait Sealed {}
    impl Sealed for u8 {}
    impl Sealed for i8 {}
    impl Sealed for u16 {}
    impl Sealed for i16 {}
    impl Sealed for u32 {}
    impl Sealed for i32 {}
    impl Sealed for u64 {}
    impl Sealed for i64 {}
    impl Sealed for f32 {}
    impl Sealed for f64 {}
}

pub trait NumericConfig: sealed::Sealed + Sized + Copy + 'static {
    const FFI_TYPE: fn() -> libffi::Type;
    fn into_ffi_value(self) -> ffi::FfiValue;
    fn into_ffi_storage(vec: Vec<Self>) -> ffi::FfiStorage;
}

impl NumericConfig for u8 {
    const FFI_TYPE: fn() -> libffi::Type = libffi::Type::u8;
    fn into_ffi_value(self) -> ffi::FfiValue {
        ffi::FfiValue::U8(self)
    }
    fn into_ffi_storage(vec: Vec<Self>) -> ffi::FfiStorage {
        vec.into()
    }
}

impl NumericConfig for i8 {
    const FFI_TYPE: fn() -> libffi::Type = libffi::Type::i8;
    fn into_ffi_value(self) -> ffi::FfiValue {
        ffi::FfiValue::I8(self)
    }
    fn into_ffi_storage(vec: Vec<Self>) -> ffi::FfiStorage {
        vec.into()
    }
}

impl NumericConfig for u16 {
    const FFI_TYPE: fn() -> libffi::Type = libffi::Type::u16;
    fn into_ffi_value(self) -> ffi::FfiValue {
        ffi::FfiValue::U16(self)
    }
    fn into_ffi_storage(vec: Vec<Self>) -> ffi::FfiStorage {
        vec.into()
    }
}

impl NumericConfig for i16 {
    const FFI_TYPE: fn() -> libffi::Type = libffi::Type::i16;
    fn into_ffi_value(self) -> ffi::FfiValue {
        ffi::FfiValue::I16(self)
    }
    fn into_ffi_storage(vec: Vec<Self>) -> ffi::FfiStorage {
        vec.into()
    }
}

impl NumericConfig for u32 {
    const FFI_TYPE: fn() -> libffi::Type = libffi::Type::u32;
    fn into_ffi_value(self) -> ffi::FfiValue {
        ffi::FfiValue::U32(self)
    }
    fn into_ffi_storage(vec: Vec<Self>) -> ffi::FfiStorage {
        vec.into()
    }
}

impl NumericConfig for i32 {
    const FFI_TYPE: fn() -> libffi::Type = libffi::Type::i32;
    fn into_ffi_value(self) -> ffi::FfiValue {
        ffi::FfiValue::I32(self)
    }
    fn into_ffi_storage(vec: Vec<Self>) -> ffi::FfiStorage {
        vec.into()
    }
}

impl NumericConfig for u64 {
    const FFI_TYPE: fn() -> libffi::Type = libffi::Type::u64;
    fn into_ffi_value(self) -> ffi::FfiValue {
        ffi::FfiValue::U64(self)
    }
    fn into_ffi_storage(vec: Vec<Self>) -> ffi::FfiStorage {
        vec.into()
    }
}

impl NumericConfig for i64 {
    const FFI_TYPE: fn() -> libffi::Type = libffi::Type::i64;
    fn into_ffi_value(self) -> ffi::FfiValue {
        ffi::FfiValue::I64(self)
    }
    fn into_ffi_storage(vec: Vec<Self>) -> ffi::FfiStorage {
        vec.into()
    }
}

impl NumericConfig for f32 {
    const FFI_TYPE: fn() -> libffi::Type = libffi::Type::f32;
    fn into_ffi_value(self) -> ffi::FfiValue {
        ffi::FfiValue::F32(self)
    }
    fn into_ffi_storage(vec: Vec<Self>) -> ffi::FfiStorage {
        vec.into()
    }
}

impl NumericConfig for f64 {
    const FFI_TYPE: fn() -> libffi::Type = libffi::Type::f64;
    fn into_ffi_value(self) -> ffi::FfiValue {
        ffi::FfiValue::F64(self)
    }
    fn into_ffi_storage(vec: Vec<Self>) -> ffi::FfiStorage {
        vec.into()
    }
}

pub trait NumericPrimitive: NumericConfig {
    fn ffi_type() -> libffi::Type {
        (Self::FFI_TYPE)()
    }

    fn to_f64(self) -> f64;
    fn from_f64(value: f64) -> Self;

    fn to_ffi_value(self) -> ffi::FfiValue {
        self.into_ffi_value()
    }

    fn vec_to_ffi_storage(vec: Vec<Self>) -> ffi::FfiStorage {
        Self::into_ffi_storage(vec)
    }

    fn read_unaligned(ptr: *const u8) -> Self {
        unsafe { ptr.cast::<Self>().read_unaligned() }
    }

    fn write_unaligned(ptr: *mut u8, value: Self) {
        unsafe { ptr.cast::<Self>().write_unaligned(value) }
    }
}

pub trait IntegerPrimitive: NumericPrimitive {
    fn read_slice(ptr: *const u8, length: usize) -> Vec<f64> {
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
    fn to_f64(self) -> f64 {
        self as f64
    }
    fn from_f64(value: f64) -> Self {
        value as Self
    }
}

impl NumericPrimitive for i8 {
    fn to_f64(self) -> f64 {
        self as f64
    }
    fn from_f64(value: f64) -> Self {
        value as Self
    }
}

impl NumericPrimitive for u16 {
    fn to_f64(self) -> f64 {
        self as f64
    }
    fn from_f64(value: f64) -> Self {
        value as Self
    }
}

impl NumericPrimitive for i16 {
    fn to_f64(self) -> f64 {
        self as f64
    }
    fn from_f64(value: f64) -> Self {
        value as Self
    }
}

impl NumericPrimitive for u32 {
    fn to_f64(self) -> f64 {
        self as f64
    }
    fn from_f64(value: f64) -> Self {
        value as Self
    }
}

impl NumericPrimitive for i32 {
    fn to_f64(self) -> f64 {
        self as f64
    }
    fn from_f64(value: f64) -> Self {
        value as Self
    }
}

impl NumericPrimitive for u64 {
    fn to_f64(self) -> f64 {
        self as f64
    }
    fn from_f64(value: f64) -> Self {
        value as Self
    }
}

impl NumericPrimitive for i64 {
    fn to_f64(self) -> f64 {
        self as f64
    }
    fn from_f64(value: f64) -> Self {
        value as Self
    }
}

impl NumericPrimitive for f32 {
    fn to_f64(self) -> f64 {
        self as f64
    }
    fn from_f64(value: f64) -> Self {
        value as Self
    }
}

impl NumericPrimitive for f64 {
    fn to_f64(self) -> f64 {
        self
    }
    fn from_f64(value: f64) -> Self {
        value
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

struct IntegerDispatch {
    ffi_type: fn() -> libffi::Type,
    read_ptr: fn(*const u8) -> f64,
    write_ptr: fn(*mut u8, f64),
    to_ffi_value: fn(f64) -> ffi::FfiValue,
    read_slice: fn(*const u8, usize) -> Vec<f64>,
    to_ffi_storage: fn(&[f64]) -> ffi::FfiStorage,
    call_cif: unsafe fn(&libffi::Cif, libffi::CodePtr, &[libffi::Arg]) -> ffi::FfiValue,
}

fn dispatch_for<T: IntegerPrimitive>() -> IntegerDispatch {
    IntegerDispatch {
        ffi_type: T::ffi_type,
        read_ptr: |ptr| T::read_unaligned(ptr).to_f64(),
        write_ptr: |ptr, v| T::write_unaligned(ptr, T::from_f64(v)),
        to_ffi_value: |v| T::from_f64(v).to_ffi_value(),
        read_slice: T::read_slice,
        to_ffi_storage: T::to_ffi_storage,
        call_cif: |cif, ptr, args| unsafe { cif.call::<T>(ptr, args).to_ffi_value() },
    }
}

static U8_DISPATCH: std::sync::LazyLock<IntegerDispatch> =
    std::sync::LazyLock::new(dispatch_for::<u8>);
static I8_DISPATCH: std::sync::LazyLock<IntegerDispatch> =
    std::sync::LazyLock::new(dispatch_for::<i8>);
static U16_DISPATCH: std::sync::LazyLock<IntegerDispatch> =
    std::sync::LazyLock::new(dispatch_for::<u16>);
static I16_DISPATCH: std::sync::LazyLock<IntegerDispatch> =
    std::sync::LazyLock::new(dispatch_for::<i16>);
static U32_DISPATCH: std::sync::LazyLock<IntegerDispatch> =
    std::sync::LazyLock::new(dispatch_for::<u32>);
static I32_DISPATCH: std::sync::LazyLock<IntegerDispatch> =
    std::sync::LazyLock::new(dispatch_for::<i32>);
static U64_DISPATCH: std::sync::LazyLock<IntegerDispatch> =
    std::sync::LazyLock::new(dispatch_for::<u64>);
static I64_DISPATCH: std::sync::LazyLock<IntegerDispatch> =
    std::sync::LazyLock::new(dispatch_for::<i64>);

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

    fn dispatch(&self) -> &'static IntegerDispatch {
        match self {
            Self::U8 => &U8_DISPATCH,
            Self::I8 => &I8_DISPATCH,
            Self::U16 => &U16_DISPATCH,
            Self::I16 => &I16_DISPATCH,
            Self::U32 => &U32_DISPATCH,
            Self::I32 => &I32_DISPATCH,
            Self::U64 => &U64_DISPATCH,
            Self::I64 => &I64_DISPATCH,
        }
    }

    pub fn ffi_type(self) -> libffi::Type {
        (self.dispatch().ffi_type)()
    }

    pub fn read_ptr(self, ptr: *const u8) -> f64 {
        (self.dispatch().read_ptr)(ptr)
    }

    pub fn write_ptr(self, ptr: *mut u8, value: f64) {
        (self.dispatch().write_ptr)(ptr, value)
    }

    pub fn to_ffi_value(self, value: f64) -> ffi::FfiValue {
        (self.dispatch().to_ffi_value)(value)
    }

    pub fn read_slice(self, ptr: *const u8, length: usize) -> Vec<f64> {
        (self.dispatch().read_slice)(ptr, length)
    }

    pub fn vec_to_f64(self, storage: &ffi::FfiStorage) -> anyhow::Result<Vec<f64>> {
        storage.as_numeric_slice(self)
    }

    pub fn to_ffi_storage(self, values: &[f64]) -> ffi::FfiStorage {
        (self.dispatch().to_ffi_storage)(values)
    }

    /// # Safety
    ///
    /// The caller must ensure:
    /// - `cif` matches the function signature of the symbol at `ptr`
    /// - `ptr` is a valid function pointer
    /// - `args` contains valid arguments matching the CIF's expected types
    pub unsafe fn call_cif(
        self,
        cif: &libffi::Cif,
        ptr: libffi::CodePtr,
        args: &[libffi::Arg],
    ) -> ffi::FfiValue {
        unsafe { (self.dispatch().call_cif)(cif, ptr, args) }
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
            value::Value::Object(handle) => handle
                .get_ptr_as_usize()
                .ok_or_else(|| anyhow::anyhow!("Object has been garbage collected"))?
                as f64,
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
    pub library: Option<String>,
    pub get_type_fn: Option<String>,
}

impl IntegerType {
    pub fn from_js_value(cx: &mut FunctionContext, value: Handle<JsValue>) -> NeonResult<Self> {
        let obj = value.downcast::<JsObject, _>(cx).or_throw(cx)?;
        let kind = IntegerKind::from_js_value(cx, value)?;

        let library: Option<String> = obj
            .get_opt::<JsString, _, _>(cx, "library")?
            .map(|h| h.value(cx));
        let get_type_fn: Option<String> = obj
            .get_opt::<JsString, _, _>(cx, "getTypeFn")?
            .map(|h| h.value(cx));

        Ok(IntegerType {
            kind,
            library,
            get_type_fn,
        })
    }

    pub fn is_enum_or_flags(&self) -> bool {
        self.library.is_some() && self.get_type_fn.is_some()
    }
}

impl From<IntegerKind> for IntegerType {
    fn from(kind: IntegerKind) -> Self {
        IntegerType {
            kind,
            library: None,
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

struct FloatDispatch {
    ffi_type: fn() -> libffi::Type,
    read_ptr: fn(*const u8) -> f64,
    write_ptr: fn(*mut u8, f64),
    to_ffi_value: fn(f64) -> ffi::FfiValue,
    call_cif: unsafe fn(&libffi::Cif, libffi::CodePtr, &[libffi::Arg]) -> ffi::FfiValue,
}

static F32_DISPATCH: FloatDispatch = FloatDispatch {
    ffi_type: f32::ffi_type,
    read_ptr: |ptr| f32::read_unaligned(ptr).to_f64(),
    write_ptr: |ptr, v| f32::write_unaligned(ptr, v as f32),
    to_ffi_value: |v| ffi::FfiValue::F32(v as f32),
    call_cif: |cif, ptr, args| unsafe { cif.call::<f32>(ptr, args).to_ffi_value() },
};

static F64_DISPATCH: FloatDispatch = FloatDispatch {
    ffi_type: f64::ffi_type,
    read_ptr: f64::read_unaligned,
    write_ptr: f64::write_unaligned,
    to_ffi_value: ffi::FfiValue::F64,
    call_cif: |cif, ptr, args| unsafe { cif.call::<f64>(ptr, args).to_ffi_value() },
};

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

    fn dispatch(&self) -> &'static FloatDispatch {
        match self {
            Self::F32 => &F32_DISPATCH,
            Self::F64 => &F64_DISPATCH,
        }
    }

    pub fn ffi_type(self) -> libffi::Type {
        (self.dispatch().ffi_type)()
    }

    pub fn read_ptr(self, ptr: *const u8) -> f64 {
        (self.dispatch().read_ptr)(ptr)
    }

    pub fn write_ptr(self, ptr: *mut u8, value: f64) {
        (self.dispatch().write_ptr)(ptr, value)
    }

    pub fn to_ffi_value(self, value: f64) -> ffi::FfiValue {
        (self.dispatch().to_ffi_value)(value)
    }

    /// # Safety
    ///
    /// The caller must ensure:
    /// - `cif` matches the function signature of the symbol at `ptr`
    /// - `ptr` is a valid function pointer
    /// - `args` contains valid arguments matching the CIF's expected types
    pub unsafe fn call_cif(
        self,
        cif: &libffi::Cif,
        ptr: libffi::CodePtr,
        args: &[libffi::Arg],
    ) -> ffi::FfiValue {
        unsafe { (self.dispatch().call_cif)(cif, ptr, args) }
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

use std::ffi::c_void;

use anyhow::bail;
use gtk4::glib::{
    self,
    translate::{IntoGlib as _, ToGlibPtr as _},
};
use libffi::middle as libffi;
use neon::prelude::*;

use super::FfiCodec;
use crate::{ffi, value};

#[derive(Debug, Clone, Copy)]
#[non_exhaustive]
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

macro_rules! impl_integer_kind_dispatch {
    ($($variant:ident : $ty:ident : $vec_variant:ident),+ $(,)?) => {
        impl IntegerKind {
            pub fn ffi_type(self) -> libffi::Type {
                match self {
                    $(Self::$variant => libffi::Type::$ty()),+
                }
            }

            pub fn read_ptr(self, ptr: *const u8) -> f64 {
                unsafe {
                    match self {
                        $(Self::$variant => ptr.cast::<$ty>().read_unaligned() as f64),+
                    }
                }
            }

            pub fn write_ptr(self, ptr: *mut u8, value: f64) {
                unsafe {
                    match self {
                        $(Self::$variant => ptr.cast::<$ty>().write_unaligned(value as $ty)),+
                    }
                }
            }

            pub fn to_ffi_value(self, value: f64) -> ffi::FfiValue {
                match self {
                    $(Self::$variant => ffi::FfiValue::$variant(value as $ty)),+
                }
            }

            pub fn read_slice(self, ptr: *const u8, length: usize) -> Vec<f64> {
                unsafe {
                    match self {
                        $(Self::$variant => {
                            std::slice::from_raw_parts(ptr.cast::<$ty>(), length)
                                .iter()
                                .map(|&v| v as f64)
                                .collect()
                        }),+
                    }
                }
            }

            pub fn to_ffi_storage(self, values: &[f64]) -> ffi::FfiStorage {
                match self {
                    $(Self::$variant => {
                        values.iter().map(|&v| v as $ty).collect::<Vec<_>>().into()
                    }),+
                }
            }

            /// # Safety
            ///
            /// The caller must ensure:
            /// - `cif` matches the function signature of the symbol at `ptr`
            /// - `ptr` is a valid function pointer
            /// - `args` contains valid arguments matching the CIF's expected types
            pub unsafe fn call_cif_raw(
                self,
                cif: &libffi::Cif,
                ptr: libffi::CodePtr,
                args: &[libffi::Arg],
            ) -> ffi::FfiValue {
                unsafe {
                    match self {
                        $(Self::$variant => ffi::FfiValue::$variant(cif.call::<$ty>(ptr, args))),+
                    }
                }
            }
        }
    };
}
with_integer_kinds!(impl_integer_kind_dispatch);

const MAX_SAFE_INTEGER: f64 = 9_007_199_254_740_992.0;

fn check_int_range(value: f64, min: f64, max: f64, type_name: &str) -> anyhow::Result<()> {
    if !value.is_finite() || value.fract() != 0.0 || value < min || value > max {
        bail!(
            "Value {} is out of range for {} [{}, {}]",
            value,
            type_name,
            min,
            max
        );
    }
    Ok(())
}

impl IntegerKind {
    #[must_use]
    pub fn is_unsigned(self) -> bool {
        matches!(self, Self::U8 | Self::U16 | Self::U32 | Self::U64)
    }

    #[must_use]
    pub fn byte_size(self) -> usize {
        match self {
            Self::U8 | Self::I8 => 1,
            Self::U16 | Self::I16 => 2,
            Self::U32 | Self::I32 => 4,
            Self::U64 | Self::I64 => 8,
        }
    }

    pub fn checked_to_ffi_value(self, value: f64) -> anyhow::Result<ffi::FfiValue> {
        match self {
            Self::I8 => {
                check_int_range(value, i8::MIN as f64, i8::MAX as f64, "i8")?;
                Ok(ffi::FfiValue::I8(value as i8))
            }
            Self::U8 => {
                check_int_range(value, 0.0, u8::MAX as f64, "u8")?;
                Ok(ffi::FfiValue::U8(value as u8))
            }
            Self::I16 => {
                check_int_range(value, i16::MIN as f64, i16::MAX as f64, "i16")?;
                Ok(ffi::FfiValue::I16(value as i16))
            }
            Self::U16 => {
                check_int_range(value, 0.0, u16::MAX as f64, "u16")?;
                Ok(ffi::FfiValue::U16(value as u16))
            }
            Self::I32 => {
                check_int_range(value, i32::MIN as f64, i32::MAX as f64, "i32")?;
                Ok(ffi::FfiValue::I32(value as i32))
            }
            Self::U32 => {
                check_int_range(value, 0.0, u32::MAX as f64, "u32")?;
                Ok(ffi::FfiValue::U32(value as u32))
            }
            Self::I64 => {
                check_int_range(value, -MAX_SAFE_INTEGER, MAX_SAFE_INTEGER, "i64")?;
                Ok(ffi::FfiValue::I64(value as i64))
            }
            Self::U64 => {
                check_int_range(value, 0.0, MAX_SAFE_INTEGER, "u64")?;
                Ok(ffi::FfiValue::U64(value as u64))
            }
        }
    }

    pub fn checked_to_ffi_storage(self, values: &[f64]) -> anyhow::Result<ffi::FfiStorage> {
        for (i, &v) in values.iter().enumerate() {
            if let Err(e) = self.checked_to_ffi_value(v) {
                bail!("Array element {}: {}", i, e);
            }
        }
        Ok(self.to_ffi_storage(values))
    }

    pub fn vec_to_f64(self, storage: &ffi::FfiStorage) -> anyhow::Result<Vec<f64>> {
        storage.as_numeric_slice(self)
    }

    pub fn ptr_to_value_raw(self, ptr: *mut c_void) -> value::Value {
        let number = match self {
            IntegerKind::I8 | IntegerKind::I16 => ptr as isize as f64,
            IntegerKind::U8 | IntegerKind::U16 => ptr as usize as f64,
            IntegerKind::I32 => ptr as i32 as f64,
            IntegerKind::U32 => ptr as u32 as f64,
            IntegerKind::I64 => ptr as i64 as f64,
            IntegerKind::U64 => ptr as u64 as f64,
        };
        value::Value::Number(number)
    }
}

impl FfiCodec for IntegerKind {
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
        self.checked_to_ffi_value(number)
    }

    fn decode(&self, ffi_value: &ffi::FfiValue) -> anyhow::Result<value::Value> {
        Ok(value::Value::Number(ffi_value.to_number()?))
    }

    fn from_glib_value(&self, gvalue: &glib::Value) -> anyhow::Result<value::Value> {
        let number = match self {
            IntegerKind::I8 => gvalue
                .get::<i8>()
                .map_err(|e| anyhow::anyhow!("Failed to get i8 from GValue: {}", e))?
                as f64,
            IntegerKind::U8 => gvalue
                .get::<u8>()
                .map_err(|e| anyhow::anyhow!("Failed to get u8 from GValue: {}", e))?
                as f64,
            IntegerKind::I16 => gvalue
                .get::<i32>()
                .map_err(|e| anyhow::anyhow!("Failed to get i32 (as i16) from GValue: {}", e))?
                as i16 as f64,
            IntegerKind::U16 => gvalue
                .get::<u32>()
                .map_err(|e| anyhow::anyhow!("Failed to get u32 (as u16) from GValue: {}", e))?
                as u16 as f64,
            IntegerKind::I32 => gvalue
                .get::<i32>()
                .map_err(|e| anyhow::anyhow!("Failed to get i32 from GValue: {}", e))?
                as f64,
            IntegerKind::U32 => gvalue
                .get::<u32>()
                .map_err(|e| anyhow::anyhow!("Failed to get u32 from GValue: {}", e))?
                as f64,
            IntegerKind::I64 => gvalue
                .get::<i64>()
                .map_err(|e| anyhow::anyhow!("Failed to get i64 from GValue: {}", e))?
                as f64,
            IntegerKind::U64 => gvalue
                .get::<u64>()
                .map_err(|e| anyhow::anyhow!("Failed to get u64 from GValue: {}", e))?
                as f64,
        };
        Ok(value::Value::Number(number))
    }

    fn libffi_type(&self) -> libffi::Type {
        self.ffi_type()
    }

    fn call_cif(
        &self,
        cif: &libffi::Cif,
        ptr: libffi::CodePtr,
        args: &[libffi::Arg],
    ) -> anyhow::Result<ffi::FfiValue> {
        Ok(unsafe { IntegerKind::call_cif_raw(*self, cif, ptr, args) })
    }

    fn ptr_to_value(&self, ptr: *mut c_void, _context: &str) -> anyhow::Result<value::Value> {
        Ok(IntegerKind::ptr_to_value_raw(*self, ptr))
    }

    fn read_from_raw_ptr(
        &self,
        ptr: *const c_void,
        _context: &str,
    ) -> anyhow::Result<value::Value> {
        Ok(value::Value::Number(self.read_ptr(ptr as *const u8)))
    }

    fn write_return_to_raw_ptr(&self, ret: *mut c_void, value: &Result<value::Value, ()>) {
        let n = match value {
            Ok(value::Value::Number(n)) => *n,
            _ => 0.0,
        };
        self.write_ptr(ret as *mut u8, n);
    }
}

impl From<IntegerKind> for libffi::Type {
    fn from(kind: IntegerKind) -> Self {
        kind.ffi_type()
    }
}

#[derive(Debug, Clone)]
pub struct TaggedType {
    pub library: String,
    pub get_type_fn: String,
}

impl TaggedType {
    pub fn from_js_value(cx: &mut FunctionContext, value: Handle<JsValue>) -> NeonResult<Self> {
        let obj = value.downcast::<JsObject, _>(cx).or_throw(cx)?;

        let library: Handle<JsString> = obj.prop(cx, "library").get()?;
        let get_type_fn: Handle<JsString> = obj.prop(cx, "getTypeFn").get()?;

        Ok(TaggedType {
            library: library.value(cx),
            get_type_fn: get_type_fn.value(cx),
        })
    }
}

#[derive(Debug, Clone, Copy)]
#[non_exhaustive]
pub enum FloatKind {
    F32,
    F64,
}

impl FloatKind {
    #[must_use]
    pub fn ffi_type(self) -> libffi::Type {
        match self {
            Self::F32 => libffi::Type::f32(),
            Self::F64 => libffi::Type::f64(),
        }
    }

    #[must_use]
    pub fn read_ptr(self, ptr: *const u8) -> f64 {
        unsafe {
            match self {
                Self::F32 => ptr.cast::<f32>().read_unaligned() as f64,
                Self::F64 => ptr.cast::<f64>().read_unaligned(),
            }
        }
    }

    pub fn write_ptr(self, ptr: *mut u8, value: f64) {
        unsafe {
            match self {
                Self::F32 => ptr.cast::<f32>().write_unaligned(value as f32),
                Self::F64 => ptr.cast::<f64>().write_unaligned(value),
            }
        }
    }

    pub fn checked_to_ffi_value(self, value: f64) -> anyhow::Result<ffi::FfiValue> {
        match self {
            Self::F32 => {
                if value.is_finite() && (value > f32::MAX as f64 || value < -(f32::MAX as f64)) {
                    bail!("Value {} is out of range for f32", value);
                }
                Ok(ffi::FfiValue::F32(value as f32))
            }
            Self::F64 => Ok(ffi::FfiValue::F64(value)),
        }
    }

    #[must_use]
    pub fn to_ffi_value(self, value: f64) -> ffi::FfiValue {
        match self {
            Self::F32 => ffi::FfiValue::F32(value as f32),
            Self::F64 => ffi::FfiValue::F64(value),
        }
    }

    /// # Safety
    ///
    /// The caller must ensure:
    /// - `cif` matches the function signature of the symbol at `ptr`
    /// - `ptr` is a valid function pointer
    /// - `args` contains valid arguments matching the CIF's expected types
    #[must_use]
    pub unsafe fn call_cif_raw(
        self,
        cif: &libffi::Cif,
        ptr: libffi::CodePtr,
        args: &[libffi::Arg],
    ) -> ffi::FfiValue {
        unsafe {
            match self {
                Self::F32 => ffi::FfiValue::F32(cif.call::<f32>(ptr, args)),
                Self::F64 => ffi::FfiValue::F64(cif.call::<f64>(ptr, args)),
            }
        }
    }
}

impl FfiCodec for FloatKind {
    fn encode(&self, value: &value::Value, optional: bool) -> anyhow::Result<ffi::FfiValue> {
        let number = match value {
            value::Value::Number(n) => *n,
            value::Value::Null | value::Value::Undefined if optional => 0.0,
            _ => bail!("Expected a Number for float type, got {:?}", value),
        };
        self.checked_to_ffi_value(number)
    }

    fn decode(&self, ffi_value: &ffi::FfiValue) -> anyhow::Result<value::Value> {
        Ok(value::Value::Number(ffi_value.to_number()?))
    }

    fn from_glib_value(&self, gvalue: &glib::Value) -> anyhow::Result<value::Value> {
        let number = match self {
            FloatKind::F32 => gvalue
                .get::<f32>()
                .map_err(|e| anyhow::anyhow!("Failed to get f32 from GValue: {}", e))?
                as f64,
            FloatKind::F64 => gvalue
                .get::<f64>()
                .map_err(|e| anyhow::anyhow!("Failed to get f64 from GValue: {}", e))?,
        };
        Ok(value::Value::Number(number))
    }

    fn libffi_type(&self) -> libffi::Type {
        self.ffi_type()
    }

    fn call_cif(
        &self,
        cif: &libffi::Cif,
        ptr: libffi::CodePtr,
        args: &[libffi::Arg],
    ) -> anyhow::Result<ffi::FfiValue> {
        Ok(unsafe { FloatKind::call_cif_raw(*self, cif, ptr, args) })
    }

    fn ptr_to_value(&self, ptr: *mut c_void, _context: &str) -> anyhow::Result<value::Value> {
        if ptr.is_null() {
            return Ok(value::Value::Number(0.0));
        }
        let val = match self {
            FloatKind::F32 => (unsafe { *(ptr as *const f32) }) as f64,
            FloatKind::F64 => unsafe { *(ptr as *const f64) },
        };
        Ok(value::Value::Number(val))
    }

    fn read_from_raw_ptr(
        &self,
        ptr: *const c_void,
        _context: &str,
    ) -> anyhow::Result<value::Value> {
        Ok(value::Value::Number(self.read_ptr(ptr as *const u8)))
    }

    fn write_return_to_raw_ptr(&self, ret: *mut c_void, value: &Result<value::Value, ()>) {
        let n = match value {
            Ok(value::Value::Number(n)) => *n,
            _ => 0.0,
        };
        self.write_ptr(ret as *mut u8, n);
    }
}

impl From<FloatKind> for libffi::Type {
    fn from(kind: FloatKind) -> Self {
        kind.ffi_type()
    }
}

#[derive(Debug, Clone)]
pub struct EnumType {
    pub tagged: TaggedType,
    pub storage: IntegerKind,
}

impl EnumType {
    pub fn from_js_value(cx: &mut FunctionContext, value: Handle<JsValue>) -> NeonResult<Self> {
        let tagged = TaggedType::from_js_value(cx, value)?;
        let obj = value.downcast::<JsObject, _>(cx).or_throw(cx)?;
        let signed: Handle<JsBoolean> = obj.prop(cx, "signed").get()?;
        let storage = if signed.value(cx) {
            IntegerKind::I32
        } else {
            IntegerKind::U32
        };
        Ok(EnumType { tagged, storage })
    }
}

impl EnumType {
    fn validate_enum_value(&self, value: i32) {
        if let Ok(gtype) = crate::state::GtkThreadState::gtype_from_lib(
            &self.tagged.library,
            &self.tagged.get_type_fn,
        ) {
            unsafe {
                let enum_class = glib::gobject_ffi::g_type_class_ref(gtype.into_glib())
                    as *mut glib::gobject_ffi::GEnumClass;
                if !enum_class.is_null() {
                    let enum_value = glib::gobject_ffi::g_enum_get_value(enum_class, value);
                    if enum_value.is_null() {
                        gtkx_warn!(
                            "Enum value {} is not a valid member of {} (GType {})",
                            value,
                            self.tagged.get_type_fn,
                            gtype
                        );
                    }
                    glib::gobject_ffi::g_type_class_unref(enum_class as *mut _);
                }
            }
        }
    }
}

impl FfiCodec for EnumType {
    fn encode(&self, value: &value::Value, optional: bool) -> anyhow::Result<ffi::FfiValue> {
        let result = FfiCodec::encode(&self.storage, value, optional)?;
        #[cfg(debug_assertions)]
        if let value::Value::Number(n) = value {
            self.validate_enum_value(*n as i32);
        }
        Ok(result)
    }

    fn decode(&self, ffi_value: &ffi::FfiValue) -> anyhow::Result<value::Value> {
        FfiCodec::decode(&self.storage, ffi_value)
    }

    fn from_glib_value(&self, gvalue: &glib::Value) -> anyhow::Result<value::Value> {
        let v = unsafe { glib::gobject_ffi::g_value_get_enum(gvalue.to_glib_none().0 as *const _) };
        Ok(value::Value::Number(v as f64))
    }

    fn libffi_type(&self) -> libffi::Type {
        self.storage.ffi_type()
    }

    fn call_cif(
        &self,
        cif: &libffi::Cif,
        ptr: libffi::CodePtr,
        args: &[libffi::Arg],
    ) -> anyhow::Result<ffi::FfiValue> {
        FfiCodec::call_cif(&self.storage, cif, ptr, args)
    }

    fn ptr_to_value(&self, ptr: *mut c_void, _context: &str) -> anyhow::Result<value::Value> {
        Ok(self.storage.ptr_to_value_raw(ptr))
    }

    fn read_from_raw_ptr(
        &self,
        ptr: *const c_void,
        _context: &str,
    ) -> anyhow::Result<value::Value> {
        Ok(value::Value::Number(
            self.storage.read_ptr(ptr as *const u8),
        ))
    }

    fn write_return_to_raw_ptr(&self, ret: *mut c_void, value: &Result<value::Value, ()>) {
        FfiCodec::write_return_to_raw_ptr(&self.storage, ret, value);
    }
}

#[derive(Debug, Clone)]
pub struct FlagsType {
    pub tagged: TaggedType,
    pub storage: IntegerKind,
}

impl FlagsType {
    pub fn from_js_value(cx: &mut FunctionContext, value: Handle<JsValue>) -> NeonResult<Self> {
        let tagged = TaggedType::from_js_value(cx, value)?;
        let obj = value.downcast::<JsObject, _>(cx).or_throw(cx)?;
        let signed: Handle<JsBoolean> = obj.prop(cx, "signed").get()?;
        let storage = if signed.value(cx) {
            IntegerKind::I32
        } else {
            IntegerKind::U32
        };
        Ok(FlagsType { tagged, storage })
    }
}

impl FfiCodec for FlagsType {
    fn encode(&self, value: &value::Value, optional: bool) -> anyhow::Result<ffi::FfiValue> {
        FfiCodec::encode(&self.storage, value, optional)
    }

    fn decode(&self, ffi_value: &ffi::FfiValue) -> anyhow::Result<value::Value> {
        FfiCodec::decode(&self.storage, ffi_value)
    }

    fn from_glib_value(&self, gvalue: &glib::Value) -> anyhow::Result<value::Value> {
        let v =
            unsafe { glib::gobject_ffi::g_value_get_flags(gvalue.to_glib_none().0 as *const _) };
        Ok(value::Value::Number(v as f64))
    }

    fn libffi_type(&self) -> libffi::Type {
        self.storage.ffi_type()
    }

    fn call_cif(
        &self,
        cif: &libffi::Cif,
        ptr: libffi::CodePtr,
        args: &[libffi::Arg],
    ) -> anyhow::Result<ffi::FfiValue> {
        FfiCodec::call_cif(&self.storage, cif, ptr, args)
    }

    fn ptr_to_value(&self, ptr: *mut c_void, _context: &str) -> anyhow::Result<value::Value> {
        Ok(self.storage.ptr_to_value_raw(ptr))
    }

    fn read_from_raw_ptr(
        &self,
        ptr: *const c_void,
        _context: &str,
    ) -> anyhow::Result<value::Value> {
        Ok(value::Value::Number(
            self.storage.read_ptr(ptr as *const u8),
        ))
    }

    fn write_return_to_raw_ptr(&self, ret: *mut c_void, value: &Result<value::Value, ()>) {
        FfiCodec::write_return_to_raw_ptr(&self.storage, ret, value);
    }
}

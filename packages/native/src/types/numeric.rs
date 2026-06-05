use anyhow::bail;
#[cfg(debug_assertions)]
use gtk4::glib;
#[cfg(debug_assertions)]
use gtk4::glib::translate::IntoGlib as _;
use libffi::middle as libffi;
use napi::{Env, JsObject};

use super::prelude::*;

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

/// Generates the three FFI codec trait impls (`FfiEncoder`, `FfiDecoder`,
/// `RawPtrCodec`) for a numeric kind enum.
///
/// Every numeric kind marshals identically across the codec boundary — a JS
/// `Number` to and from an `f64` — so the trait surface is uniform. The
/// genuinely type-specific behavior (range checking, pointer interpretation)
/// lives in inherent methods (`checked_to_ffi_value`, `ptr_to_value_raw`,
/// `ffi_type`, `read_ptr`, `write_ptr`, `call_cif_raw`) that the generated
/// impls delegate to. `$label` names the kind in error messages.
macro_rules! impl_numeric_codecs {
    ($kind:ty, $label:literal) => {
        impl FfiEncoder for $kind {
            fn encode(
                &self,
                value: &value::Value,
                optional: bool,
            ) -> anyhow::Result<ffi::FfiValue> {
                let number = match value {
                    value::Value::Number(n) => *n,
                    value::Value::Object(handle) => handle.ptr_as_usize() as f64,
                    value::Value::Null | value::Value::Undefined if optional => 0.0,
                    _ => bail!("Expected a Number for {} type, got {value:?}", $label),
                };
                self.checked_to_ffi_value(number)
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
                Ok(unsafe { Self::call_cif_raw(*self, cif, ptr, args) })
            }
        }

        impl FfiDecoder for $kind {
            fn decode(&self, ffi_value: &ffi::FfiValue) -> anyhow::Result<value::Value> {
                Ok(value::Value::Number(ffi_value.to_number()?))
            }
        }

        impl RawPtrCodec for $kind {
            fn ptr_to_value(
                &self,
                ptr: *mut c_void,
                _context: &str,
            ) -> anyhow::Result<value::Value> {
                Ok(self.ptr_to_value_raw(ptr))
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

            fn write_value_to_raw_ptr(
                &self,
                ptr: *mut c_void,
                value: &value::Value,
            ) -> anyhow::Result<()> {
                let value::Value::Number(n) = value else {
                    bail!(
                        "Expected a Number for {} field write, got {value:?}",
                        $label
                    );
                };
                self.write_ptr(ptr as *mut u8, *n);
                Ok(())
            }
        }
    };
}

const MAX_SAFE_INTEGER: f64 = 9_007_199_254_740_992.0;

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

    fn check_range(self, value: f64) -> anyhow::Result<()> {
        let (min, max, name) = match self {
            Self::I8 => (i8::MIN as f64, i8::MAX as f64, "i8"),
            Self::U8 => (0.0, u8::MAX as f64, "u8"),
            Self::I16 => (i16::MIN as f64, i16::MAX as f64, "i16"),
            Self::U16 => (0.0, u16::MAX as f64, "u16"),
            Self::I32 => (i32::MIN as f64, i32::MAX as f64, "i32"),
            Self::U32 => (0.0, u32::MAX as f64, "u32"),
            Self::I64 => (-MAX_SAFE_INTEGER, MAX_SAFE_INTEGER, "i64"),
            Self::U64 => (0.0, MAX_SAFE_INTEGER, "u64"),
        };
        if !value.is_finite() || value.fract() != 0.0 || value < min || value > max {
            bail!("Value {value} is out of range for {name} [{min}, {max}]");
        }
        Ok(())
    }

    pub fn checked_to_ffi_value(self, value: f64) -> anyhow::Result<ffi::FfiValue> {
        self.check_range(value)?;
        Ok(self.to_ffi_value(value))
    }

    pub fn checked_to_ffi_storage(self, values: &[f64]) -> anyhow::Result<ffi::FfiStorage> {
        for (i, &v) in values.iter().enumerate() {
            if let Err(e) = self.checked_to_ffi_value(v) {
                bail!("Array element {i}: {e}");
            }
        }
        Ok(self.to_ffi_storage(values))
    }

    pub fn vec_to_f64(self, storage: &ffi::FfiStorage) -> anyhow::Result<Vec<f64>> {
        storage.as_numeric_slice(self)
    }

    pub fn ptr_to_value_raw(self, ptr: *mut c_void) -> value::Value {
        let number = match self {
            Self::I8 | Self::I16 => ptr as isize as f64,
            Self::U8 | Self::U16 => ptr as usize as f64,
            Self::I32 => ptr as i32 as f64,
            Self::U32 => ptr as u32 as f64,
            Self::I64 => ptr as i64 as f64,
            Self::U64 => ptr as u64 as f64,
        };
        value::Value::Number(number)
    }
}

impl_numeric_codecs!(IntegerKind, "integer");

impl From<IntegerKind> for libffi::Type {
    fn from(kind: IntegerKind) -> Self {
        kind.ffi_type()
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
                    bail!("Value {value} is out of range for f32");
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

    #[must_use]
    pub fn ptr_to_value_raw(self, ptr: *mut c_void) -> value::Value {
        if ptr.is_null() {
            return value::Value::Number(0.0);
        }
        value::Value::Number(self.read_ptr(ptr as *const u8))
    }
}

impl_numeric_codecs!(FloatKind, "float");

impl From<FloatKind> for libffi::Type {
    fn from(kind: FloatKind) -> Self {
        kind.ffi_type()
    }
}

/// Distinguishes a `GLib` enumeration from a flags (bitfield) type.
///
/// The two share an identical FFI representation and differ only in how they
/// convert to and from a `GValue`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[non_exhaustive]
pub enum TaggedKind {
    Enum,
    Flags,
}

/// A `GLib`-registered enumeration or flags type.
///
/// Marshaled across the FFI boundary as its underlying integer `storage`, and
/// converted to a `GValue` of the `GType` resolved from `library` and
/// `get_type_fn`.
#[derive(Debug, Clone)]
pub struct TaggedType {
    pub kind: TaggedKind,
    pub library: String,
    pub get_type_fn: String,
    pub storage: IntegerKind,
}

impl TaggedType {
    #[cfg_attr(coverage_nightly, coverage(off))]
    pub fn from_js_value(_env: &Env, obj: &JsObject, kind: TaggedKind) -> napi::Result<Self> {
        let library: String = obj.get_named_property("library")?;
        let get_type_fn: String = obj.get_named_property("getTypeFn")?;
        let signed: bool = obj.get_named_property("signed")?;
        let storage = if signed {
            IntegerKind::I32
        } else {
            IntegerKind::U32
        };

        Ok(Self {
            kind,
            library,
            get_type_fn,
            storage,
        })
    }

    #[cfg(debug_assertions)]
    fn resolve_gtype(&self) -> anyhow::Result<glib::Type> {
        crate::state::GlibThreadState::with(|state| {
            state.resolve_gtype(&self.library, &self.get_type_fn)
        })
    }

    #[cfg(debug_assertions)]
    #[cfg_attr(coverage_nightly, coverage(off))]
    fn validate_enum_value(&self, value: i32) {
        let Ok(gtype) = self.resolve_gtype() else {
            return;
        };
        unsafe {
            let enum_class = glib::gobject_ffi::g_type_class_ref(gtype.into_glib())
                as *mut glib::gobject_ffi::GEnumClass;
            if enum_class.is_null() {
                return;
            }
            if glib::gobject_ffi::g_enum_get_value(enum_class, value).is_null() {
                crate::error_reporter::NativeErrorReporter::global().report_str(&format!(
                    "Enum value {value} is not a valid member of {} (GType {gtype})",
                    self.get_type_fn
                ));
            }
            glib::gobject_ffi::g_type_class_unref(enum_class as *mut _);
        }
    }
}

impl FfiEncoder for TaggedType {
    fn encode(&self, value: &value::Value, optional: bool) -> anyhow::Result<ffi::FfiValue> {
        let result = FfiEncoder::encode(&self.storage, value, optional)?;
        #[cfg(debug_assertions)]
        if self.kind == TaggedKind::Enum
            && let value::Value::Number(n) = value
        {
            self.validate_enum_value(*n as i32);
        }
        Ok(result)
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
        FfiEncoder::call_cif(&self.storage, cif, ptr, args)
    }
}

impl FfiDecoder for TaggedType {
    fn decode(&self, ffi_value: &ffi::FfiValue) -> anyhow::Result<value::Value> {
        FfiDecoder::decode(&self.storage, ffi_value)
    }
}

impl RawPtrCodec for TaggedType {
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
        RawPtrCodec::write_return_to_raw_ptr(&self.storage, ret, value);
    }

    fn write_value_to_raw_ptr(&self, ptr: *mut c_void, value: &value::Value) -> anyhow::Result<()> {
        RawPtrCodec::write_value_to_raw_ptr(&self.storage, ptr, value)
    }
}

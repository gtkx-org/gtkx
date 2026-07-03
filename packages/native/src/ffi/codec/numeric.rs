use anyhow::bail;
use libffi::middle as libffi;

use super::prelude::*;

pub const MAX_SAFE_INTEGER_I128: i128 = 9_007_199_254_740_992;

pub(super) const MAX_SAFE_INTEGER: f64 = MAX_SAFE_INTEGER_I128 as f64;

#[derive(Debug, Clone, Copy)]
pub enum IntegerCodec {
    U8,
    I8,
    U16,
    I16,
    U32,
    I32,
    U64,
    I64,
}

macro_rules! impl_integer_codec_dispatch {
    ($($variant:ident : $codec:ident),+ $(,)?) => {
        impl IntegerCodec {
            pub fn ffi_type(self) -> libffi::Type {
                match self {
                    $(Self::$variant => libffi::Type::$codec()),+
                }
            }

            pub unsafe fn read_ptr(self, ptr: *const u8) -> f64 {
                unsafe {
                    match self {
                        $(Self::$variant => ptr.cast::<$codec>().read_unaligned() as f64),+
                    }
                }
            }

            pub unsafe fn write_ptr(self, ptr: *mut u8, value: f64) {
                unsafe {
                    match self {
                        $(Self::$variant => ptr.cast::<$codec>().write_unaligned(value as $codec)),+
                    }
                }
            }

            pub fn to_stash(self, value: f64) -> ffi::Stash {
                match self {
                    $(Self::$variant => ffi::Stash::$variant(value as $codec)),+
                }
            }

            pub unsafe fn read_slice(self, ptr: *const u8, length: usize) -> Vec<f64> {
                unsafe {
                    match self {
                        $(Self::$variant => {
                            std::slice::from_raw_parts(ptr.cast::<$codec>(), length)
                                .iter()
                                .map(|&v| v as f64)
                                .collect()
                        }),+
                    }
                }
            }

            pub fn to_stash_storage(self, values: &[f64]) -> ffi::StashStorage {
                match self {
                    $(Self::$variant => {
                        values.iter().map(|&v| v as $codec).collect::<Vec<_>>().into()
                    }),+
                }
            }

            pub fn call_return(
                self,
                cif: &libffi::Cif,
                ptr: libffi::CodePtr,
                args: &[libffi::Arg],
            ) -> ffi::Stash {
                unsafe {
                    match self {
                        $(Self::$variant => ffi::Stash::$variant(cif.call::<$codec>(ptr, args))),+
                    }
                }
            }
        }
    };
}

impl_integer_codec_dispatch! {
    U8: u8,
    I8: i8,
    U16: u16,
    I16: i16,
    U32: u32,
    I32: i32,
    U64: u64,
    I64: i64,
}

macro_rules! impl_numeric_codecs {
    ($kind:ty, $label:literal, $ptr_to_value:item) => {
        impl Encoder for $kind {
            fn encode(&self, value: &value::Value) -> anyhow::Result<ffi::Stash> {
                let number = Self::number_from_value(value)?;
                self.checked_to_stash(number)
            }

            fn libffi_type(&self) -> libffi::Type {
                self.ffi_type()
            }

            fn call_cif(
                &self,
                cif: &libffi::Cif,
                ptr: libffi::CodePtr,
                args: &[libffi::Arg],
            ) -> anyhow::Result<ffi::Stash> {
                Ok(self.call_return(cif, ptr, args))
            }
        }

        impl $kind {
            $ptr_to_value
        }

        impl Decoder for $kind {
            unsafe fn read(&self, src: ReadSource<'_>) -> anyhow::Result<value::Value> {
                match src {
                    ReadSource::Call(stash) => Ok(value::Value::Number(stash.to_number()?)),
                    ReadSource::Slot(ptr, context) => {
                        Ok(value::Value::Number(unsafe {
                            self.checked_read_ptr(ptr as *const u8, context)?
                        }))
                    }
                    ReadSource::Value(ptr, context) => unsafe { self.ptr_to_value(ptr, context) },
                }
            }
        }

        impl PtrWriter for $kind {
            fn write_return_to_ptr(&self, ret: ffi::Slot, value: &Result<value::Value, ()>) {
                let n = match value {
                    Ok(value::Value::Number(n)) => *n,
                    _ => 0.0,
                };
                unsafe { self.write_return_widened(ret.as_ptr(), n) };
            }

            fn write_value_to_ptr(
                &self,
                slot: ffi::Slot,
                value: &value::Value,
            ) -> anyhow::Result<()> {
                let value::Value::Number(n) = value else {
                    bail!(
                        "Expected a Number for {} field write, got {value:?}",
                        $label
                    );
                };
                unsafe { self.write_ptr(slot.as_ptr() as *mut u8, *n) };
                Ok(())
            }
        }
    };
}

pub fn lossless_f64(value: i128, context: &str) -> anyhow::Result<f64> {
    if !(-MAX_SAFE_INTEGER_I128..=MAX_SAFE_INTEGER_I128).contains(&value) {
        bail!(
            "{context}: value {value} exceeds the 2^53 range JavaScript numbers represent exactly; use a bigint codec (t.bigint64/t.biguint64) for this slot"
        );
    }
    Ok(value as f64)
}

fn coerce_number(value: &value::Value, label: &str, allow_object: bool) -> anyhow::Result<f64> {
    match value {
        value::Value::Number(n) => Ok(*n),
        value::Value::Object(handle) if allow_object => Ok(handle.ptr_as_usize() as f64),
        value::Value::Null | value::Value::Undefined => Ok(0.0),
        _ => bail!("Expected a Number for {label}, got {value:?}"),
    }
}

impl IntegerCodec {
    pub fn byte_size(self) -> usize {
        match self {
            Self::U8 | Self::I8 => 1,
            Self::U16 | Self::I16 => 2,
            Self::U32 | Self::I32 => 4,
            Self::U64 | Self::I64 => 8,
        }
    }

    fn name(self) -> &'static str {
        match self {
            Self::U8 => "u8",
            Self::I8 => "i8",
            Self::U16 => "u16",
            Self::I16 => "i16",
            Self::U32 => "u32",
            Self::I32 => "i32",
            Self::U64 => "u64",
            Self::I64 => "i64",
        }
    }

    pub(super) fn check_range(self, value: f64) -> anyhow::Result<()> {
        let name = self.name();
        let (min, max) = match self {
            Self::I8 => (i8::MIN as f64, i8::MAX as f64),
            Self::U8 => (0.0, u8::MAX as f64),
            Self::I16 => (i16::MIN as f64, i16::MAX as f64),
            Self::U16 => (0.0, u16::MAX as f64),
            Self::I32 => (i32::MIN as f64, i32::MAX as f64),
            Self::U32 => (0.0, u32::MAX as f64),
            Self::I64 => (-MAX_SAFE_INTEGER, MAX_SAFE_INTEGER),
            Self::U64 => (0.0, MAX_SAFE_INTEGER),
        };
        if !value.is_finite() || value.fract() != 0.0 || value < min || value > max {
            bail!("Value {value} is out of range for {name} [{min}, {max}]");
        }
        Ok(())
    }

    pub fn checked_to_stash(self, value: f64) -> anyhow::Result<ffi::Stash> {
        self.check_range(value)?;
        Ok(self.to_stash(value))
    }

    pub fn checked_to_stash_storage(self, values: &[f64]) -> anyhow::Result<ffi::StashStorage> {
        for (i, &v) in values.iter().enumerate() {
            if let Err(e) = self.checked_to_stash(v) {
                bail!("Array element {i}: {e}");
            }
        }
        Ok(self.to_stash_storage(values))
    }

    pub unsafe fn checked_read_slice(
        self,
        ptr: *const u8,
        length: usize,
        context: &str,
    ) -> anyhow::Result<Vec<f64>> {
        unsafe {
            match self {
                Self::I64 => std::slice::from_raw_parts(ptr.cast::<i64>(), length)
                    .iter()
                    .map(|&v| lossless_f64(i128::from(v), context))
                    .collect(),
                Self::U64 => std::slice::from_raw_parts(ptr.cast::<u64>(), length)
                    .iter()
                    .map(|&v| lossless_f64(i128::from(v), context))
                    .collect(),
                other => Ok(other.read_slice(ptr, length)),
            }
        }
    }

    pub(crate) unsafe fn checked_read_ptr(
        self,
        ptr: *const u8,
        context: &str,
    ) -> anyhow::Result<f64> {
        unsafe {
            match self {
                Self::I64 => lossless_f64(i128::from(ptr.cast::<i64>().read_unaligned()), context),
                Self::U64 => lossless_f64(i128::from(ptr.cast::<u64>().read_unaligned()), context),
                other => Ok(other.read_ptr(ptr)),
            }
        }
    }

    pub fn ptr_to_value_raw(self, ptr: *mut c_void, context: &str) -> anyhow::Result<value::Value> {
        let number = match self {
            Self::I8 | Self::I16 => ptr as isize as f64,
            Self::U8 | Self::U16 => ptr as usize as f64,
            Self::I32 => ptr as i32 as f64,
            Self::U32 => ptr as u32 as f64,
            Self::I64 => lossless_f64(i128::from(ptr as i64), context)?,
            Self::U64 => lossless_f64(i128::from(ptr as u64), context)?,
        };
        Ok(value::Value::Number(number))
    }

    fn number_from_value(value: &value::Value) -> anyhow::Result<f64> {
        coerce_number(value, "integer codec", true)
    }

    pub(super) unsafe fn write_return_widened(self, ret: *mut c_void, value: f64) {
        unsafe {
            match self {
                Self::I8 => ret.cast::<i64>().write_unaligned(i64::from(value as i8)),
                Self::I16 => ret.cast::<i64>().write_unaligned(i64::from(value as i16)),
                Self::I32 => ret.cast::<i64>().write_unaligned(i64::from(value as i32)),
                Self::I64 => ret.cast::<i64>().write_unaligned(value as i64),
                Self::U8 => ret.cast::<u64>().write_unaligned(u64::from(value as u8)),
                Self::U16 => ret.cast::<u64>().write_unaligned(u64::from(value as u16)),
                Self::U32 => ret.cast::<u64>().write_unaligned(u64::from(value as u32)),
                Self::U64 => ret.cast::<u64>().write_unaligned(value as u64),
            }
        }
    }
}

impl_numeric_codecs!(
    IntegerCodec,
    "integer",
    unsafe fn ptr_to_value(&self, ptr: *mut c_void, context: &str) -> anyhow::Result<value::Value> {
        self.ptr_to_value_raw(ptr, context)
    }
);

#[derive(Debug, Clone, Copy)]
pub enum FloatCodec {
    F32,
    F64,
}

impl FloatCodec {
    pub fn ffi_type(self) -> libffi::Type {
        match self {
            Self::F32 => libffi::Type::f32(),
            Self::F64 => libffi::Type::f64(),
        }
    }

    pub unsafe fn read_ptr(self, ptr: *const u8) -> f64 {
        unsafe {
            match self {
                Self::F32 => ptr.cast::<f32>().read_unaligned() as f64,
                Self::F64 => ptr.cast::<f64>().read_unaligned(),
            }
        }
    }

    pub unsafe fn write_ptr(self, ptr: *mut u8, value: f64) {
        unsafe {
            match self {
                Self::F32 => ptr.cast::<f32>().write_unaligned(value as f32),
                Self::F64 => ptr.cast::<f64>().write_unaligned(value),
            }
        }
    }

    fn name(self) -> &'static str {
        match self {
            Self::F32 => "f32",
            Self::F64 => "f64",
        }
    }

    fn check_range(self, value: f64) -> anyhow::Result<()> {
        if let Self::F32 = self
            && value.is_finite()
            && (value > f32::MAX as f64 || value < -(f32::MAX as f64))
        {
            let name = self.name();
            bail!("Value {value} is out of range for {name}");
        }
        Ok(())
    }

    pub fn checked_to_stash(self, value: f64) -> anyhow::Result<ffi::Stash> {
        self.check_range(value)?;
        Ok(match self {
            Self::F32 => ffi::Stash::F32(value as f32),
            Self::F64 => ffi::Stash::F64(value),
        })
    }

    pub fn checked_to_stash_storage(self, values: &[f64]) -> anyhow::Result<ffi::StashStorage> {
        match self {
            Self::F32 => {
                let mut out = Vec::with_capacity(values.len());
                for (i, &v) in values.iter().enumerate() {
                    self.check_range(v)
                        .map_err(|e| anyhow::anyhow!("Array element {i}: {e}"))?;
                    out.push(v as f32);
                }
                Ok(out.into())
            }
            Self::F64 => Ok(values.to_vec().into()),
        }
    }

    pub fn call_return(
        self,
        cif: &libffi::Cif,
        ptr: libffi::CodePtr,
        args: &[libffi::Arg],
    ) -> ffi::Stash {
        unsafe {
            match self {
                Self::F32 => ffi::Stash::F32(cif.call::<f32>(ptr, args)),
                Self::F64 => ffi::Stash::F64(cif.call::<f64>(ptr, args)),
            }
        }
    }

    pub unsafe fn ptr_to_value_raw(self, ptr: *mut c_void) -> value::Value {
        if ptr.is_null() {
            return value::Value::Number(0.0);
        }
        value::Value::Number(unsafe { self.read_ptr(ptr as *const u8) })
    }

    pub(crate) unsafe fn checked_read_ptr(
        self,
        ptr: *const u8,
        _context: &str,
    ) -> anyhow::Result<f64> {
        Ok(unsafe { self.read_ptr(ptr) })
    }

    fn number_from_value(value: &value::Value) -> anyhow::Result<f64> {
        coerce_number(value, "float type", false)
    }

    unsafe fn write_return_widened(self, ret: *mut c_void, value: f64) {
        unsafe { self.write_ptr(ret as *mut u8, value) };
    }
}

impl_numeric_codecs!(
    FloatCodec,
    "float",
    unsafe fn ptr_to_value(
        &self,
        ptr: *mut c_void,
        _context: &str,
    ) -> anyhow::Result<value::Value> {
        Ok(unsafe { self.ptr_to_value_raw(ptr) })
    }
);

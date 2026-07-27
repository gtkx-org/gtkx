use anyhow::bail;
use libffi::middle as libffi;

use super::prelude::*;

const MAX_SAFE_INTEGER_I128: i128 = 9_007_199_254_740_992;

pub(super) const MAX_SAFE_INTEGER: f64 = 9_007_199_254_740_992.0;

trait NumberCast: Copy {
    fn to_f64(self) -> f64;

    fn from_f64(value: f64) -> Self;
}

macro_rules! impl_number_cast {
    ($($ty:ty),+ $(,)?) => {
        $(impl NumberCast for $ty {
            fn to_f64(self) -> f64 {
                f64::from(self)
            }

            // Filling a C integer slot from a JavaScript number is Rust's saturating
            // float-to-int conversion: NaN becomes 0 and an out-of-range magnitude clamps to
            // the slot type's bounds. That is the marshalling contract this boundary needs:
            // range checking is a separate step (`IntegerCodec::check_range`), and the
            // callback-return path has no channel on which to report a rejected value.
            #[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
            fn from_f64(value: f64) -> Self {
                value as Self
            }
        })+
    };
}

macro_rules! impl_number_cast_64 {
    ($($ty:ty),+ $(,)?) => {
        $(impl NumberCast for $ty {
            // A 64-bit C integer past 2^53 has no exact f64. The paths that must stay exact
            // (`IntegerCodec::checked_read_ptr` and `IntegerCodec::checked_read_slice`) route
            // the 64-bit codecs through `lossless_f64` and fail instead, so reaching this
            // conversion means the caller explicitly asked for the raw, unchecked read.
            #[allow(clippy::cast_precision_loss)]
            fn to_f64(self) -> f64 {
                self as f64
            }

            // The same saturating float-to-int contract as the narrower widths.
            #[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
            fn from_f64(value: f64) -> Self {
                value as Self
            }
        })+
    };
}

impl_number_cast!(u8, i8, u16, i16, u32, i32);

impl_number_cast_64!(u64, i64);

#[allow(clippy::cast_possible_truncation)]
fn narrow_f32(value: f64) -> f32 {
    value as f32
}

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

            /// # Safety
            ///
            /// `ptr` must point at `self.byte_size()` initialized, readable bytes. Alignment
            /// is not required: the value is read with `read_unaligned`.
            pub unsafe fn read_ptr(self, ptr: *const u8) -> f64 {
                unsafe {
                    match self {
                        $(Self::$variant => ptr.cast::<$codec>().read_unaligned().to_f64()),+
                    }
                }
            }

            /// # Safety
            ///
            /// `ptr` must point at `self.byte_size()` writable bytes. Alignment is not
            /// required: the value is written with `write_unaligned`.
            pub unsafe fn write_ptr(self, ptr: *mut u8, value: f64) {
                unsafe {
                    match self {
                        $(Self::$variant => ptr
                            .cast::<$codec>()
                            .write_unaligned(<$codec as NumberCast>::from_f64(value))),+
                    }
                }
            }

            pub fn to_stash(self, value: f64) -> ffi::Stash {
                match self {
                    $(Self::$variant => {
                        ffi::Stash::$variant(<$codec as NumberCast>::from_f64(value))
                    }),+
                }
            }

            /// # Safety
            ///
            /// `ptr` must point at `length * self.byte_size()` initialized, readable bytes
            /// that stay valid for the whole call. Alignment is not required: every element is
            /// read with `read_unaligned`.
            pub unsafe fn read_slice(self, ptr: *const u8, length: usize) -> Vec<f64> {
                let size = self.byte_size();
                unsafe {
                    match self {
                        $(Self::$variant => (0..length)
                            .map(|i| {
                                ptr.add(i * size).cast::<$codec>().read_unaligned().to_f64()
                            })
                            .collect()),+
                    }
                }
            }

            pub fn to_stash_storage(self, values: &[f64]) -> ffi::StashStorage {
                match self {
                    $(Self::$variant => {
                        values
                            .iter()
                            .map(|&v| <$codec as NumberCast>::from_f64(v))
                            .collect::<Vec<_>>()
                            .into()
                    }),+
                }
            }

            pub fn call_return(
                self,
                cif: &libffi::Cif,
                ptr: libffi::CodePtr,
                args: &[libffi::Arg<'_>],
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
    (
        $kind:ty,
        $label:literal,
        value: |$self_:ident, $ptr:ident, $context:ident| $value_arm:expr,
        slot: |$slot_self:ident, $slot_ptr:ident, $slot_context:ident| $slot_arm:expr,
    ) => {
        impl Encoder for $kind {
            fn encode(&self, _env: &Env, value: Unknown<'_>) -> anyhow::Result<ffi::Stash> {
                let number = <$kind>::number_from_value(value)?;
                self.checked_to_stash(number)
            }

            fn libffi_type(&self) -> libffi::Type {
                self.ffi_type()
            }

            fn call_cif(
                &self,
                cif: &libffi::Cif,
                ptr: libffi::CodePtr,
                args: &[libffi::Arg<'_>],
            ) -> anyhow::Result<ffi::Stash> {
                Ok(self.call_return(cif, ptr, args))
            }
        }

        impl Decoder for $kind {
            unsafe fn read<'e>(
                &self,
                env: &'e Env,
                src: ReadSource<'_>,
            ) -> anyhow::Result<Unknown<'e>> {
                let number = match src {
                    ReadSource::Call(stash) => stash.to_number()?,
                    ReadSource::Slot($slot_ptr, $slot_context) => {
                        let $slot_self = self;
                        $slot_arm
                    }
                    ReadSource::Value($ptr, $context) => {
                        let $self_ = self;
                        $value_arm
                    }
                };
                Ok(number.into_unknown(env)?)
            }
        }

        impl PtrWriter for $kind {
            fn write_return_to_ptr(
                &self,
                _env: &Env,
                ret: ffi::Slot,
                value: &std::result::Result<Unknown<'_>, ()>,
            ) {
                let n = match value {
                    Ok(unknown) => <$kind>::number_from_value(*unknown).unwrap_or(0.0),
                    Err(()) => 0.0,
                };
                unsafe { self.write_return_widened(ret.as_ptr(), n) };
            }

            fn write_value_to_ptr(
                &self,
                _env: &Env,
                slot: ffi::Slot,
                value: Unknown<'_>,
                _init: $crate::ffi::codec::SlotInit,
            ) -> anyhow::Result<()> {
                let n = <$kind>::number_from_value(value)?;
                self.check_range(n)?;
                unsafe { self.write_ptr(slot.as_ptr().cast::<u8>(), n) };
                Ok(())
            }
        }
    };
}

#[allow(clippy::cast_precision_loss)]
pub fn lossless_f64(value: i128, context: &str) -> anyhow::Result<f64> {
    if !(-MAX_SAFE_INTEGER_I128..=MAX_SAFE_INTEGER_I128).contains(&value) {
        bail!(
            "{context}: value {value} exceeds the 2^53 range JavaScript numbers represent exactly; use a bigint codec (t.bigint64/t.biguint64) for this slot"
        );
    }
    Ok(value as f64)
}

fn coerce_number(value: Unknown<'_>, label: &str, allow_object: bool) -> anyhow::Result<f64> {
    match value.get_type()? {
        ValueType::Number => Ok(value::read_napi::<f64>(value)?),
        // An External carries a GObject handle, i.e. a Linux user-space virtual address. Those
        // are 48 bits wide at most under the 4-level paging layout every supported target uses,
        // so the address stays inside f64's 53-bit exact-integer range and survives the trip
        // through the JavaScript number it is handed to.
        #[allow(clippy::cast_precision_loss)]
        ValueType::External if allow_object => {
            let ptr = value::handle_ptr(value, label)?;
            Ok(ptr as usize as f64)
        }
        ValueType::Null | ValueType::Undefined => Ok(0.0),
        other => bail!("Expected a Number for {label}, got {other:?}"),
    }
}

impl IntegerCodec {
    #[must_use]
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
        if !value.is_finite() {
            bail!("Value {value} is not finite, {name} expects a whole number");
        }
        if value.fract() != 0.0 {
            bail!("Value {value} is not an integer, {name} expects a whole number");
        }
        let (min, max) = match self {
            Self::I8 => (f64::from(i8::MIN), f64::from(i8::MAX)),
            Self::U8 => (0.0, f64::from(u8::MAX)),
            Self::I16 => (f64::from(i16::MIN), f64::from(i16::MAX)),
            Self::U16 => (0.0, f64::from(u16::MAX)),
            Self::I32 => (f64::from(i32::MIN), f64::from(i32::MAX)),
            Self::U32 => (0.0, f64::from(u32::MAX)),
            Self::I64 => (-MAX_SAFE_INTEGER, MAX_SAFE_INTEGER),
            Self::U64 => (0.0, MAX_SAFE_INTEGER),
        };
        if value < min || value > max {
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

    /// # Safety
    ///
    /// `ptr` must point at `length * self.byte_size()` initialized, readable bytes that stay
    /// valid for the whole call. Alignment is not required: every element is read with
    /// `read_unaligned`.
    pub unsafe fn checked_read_slice(
        self,
        ptr: *const u8,
        length: usize,
        context: &str,
    ) -> anyhow::Result<Vec<f64>> {
        unsafe {
            match self {
                Self::I64 | Self::U64 => (0..length)
                    .map(|i| self.checked_read_ptr(ptr.add(i * self.byte_size()), context))
                    .collect(),
                other => Ok(other.read_slice(ptr, length)),
            }
        }
    }

    unsafe fn checked_read_ptr(self, ptr: *const u8, context: &str) -> anyhow::Result<f64> {
        unsafe {
            match self {
                Self::I64 => lossless_f64(i128::from(ptr.cast::<i64>().read_unaligned()), context),
                Self::U64 => lossless_f64(i128::from(ptr.cast::<u64>().read_unaligned()), context),
                other => Ok(other.read_ptr(ptr)),
            }
        }
    }

    pub fn number_from_ptr_raw(self, ptr: *mut c_void, context: &str) -> anyhow::Result<f64> {
        match self {
            // The C ABI promotes a narrow integer into a full pointer-width word, so the word
            // read back here is the sign- or zero-extended value of a `gint8`/`gint16` or a
            // `guint8`/`guint16` and therefore lies inside that type's range, well within
            // f64's 53-bit exact-integer range.
            #[allow(clippy::cast_precision_loss)]
            Self::I8 | Self::I16 => Ok(ptr as isize as f64),
            // The same promoted word, zero-extended, for a `guint8`/`guint16`.
            #[allow(clippy::cast_precision_loss)]
            Self::U8 | Self::U16 => Ok(ptr as usize as f64),
            Self::I32 => Ok(f64::from(ptr as i32)),
            Self::U32 => Ok(f64::from(ptr as u32)),
            Self::I64 => lossless_f64(i128::from(ptr as i64), context),
            Self::U64 => lossless_f64(i128::from(ptr as u64), context),
        }
    }

    fn number_from_value(value: Unknown<'_>) -> anyhow::Result<f64> {
        coerce_number(value, "integer codec", true)
    }

    pub(super) unsafe fn write_return_widened(self, ret: *mut c_void, value: f64) {
        unsafe {
            match self {
                Self::I8 => ret
                    .cast::<i64>()
                    .write_unaligned(i64::from(i8::from_f64(value))),
                Self::I16 => ret
                    .cast::<i64>()
                    .write_unaligned(i64::from(i16::from_f64(value))),
                Self::I32 => ret
                    .cast::<i64>()
                    .write_unaligned(i64::from(i32::from_f64(value))),
                Self::I64 => ret.cast::<i64>().write_unaligned(i64::from_f64(value)),
                Self::U8 => ret
                    .cast::<u64>()
                    .write_unaligned(u64::from(u8::from_f64(value))),
                Self::U16 => ret
                    .cast::<u64>()
                    .write_unaligned(u64::from(u16::from_f64(value))),
                Self::U32 => ret
                    .cast::<u64>()
                    .write_unaligned(u64::from(u32::from_f64(value))),
                Self::U64 => ret.cast::<u64>().write_unaligned(u64::from_f64(value)),
            }
        }
    }
}

impl_numeric_codecs!(
    IntegerCodec,
    "integer",
    value: |codec, ptr, context| codec.number_from_ptr_raw(ptr, context)?,
    slot: |codec, ptr, context| unsafe { codec.checked_read_ptr(ptr.cast::<u8>(), context)? },
);

#[derive(Debug, Clone, Copy)]
pub enum FloatCodec {
    F32,
    F64,
}

impl FloatCodec {
    #[must_use]
    pub fn ffi_type(self) -> libffi::Type {
        match self {
            Self::F32 => libffi::Type::f32(),
            Self::F64 => libffi::Type::f64(),
        }
    }

    /// # Safety
    ///
    /// `ptr` must point at 4 initialized, readable bytes for `F32` and 8 for `F64`. Alignment
    /// is not required: the value is read with `read_unaligned`.
    #[must_use]
    pub unsafe fn read_ptr(self, ptr: *const u8) -> f64 {
        unsafe {
            match self {
                Self::F32 => f64::from(ptr.cast::<f32>().read_unaligned()),
                Self::F64 => ptr.cast::<f64>().read_unaligned(),
            }
        }
    }

    /// # Safety
    ///
    /// `ptr` must point at 4 writable bytes for `F32` and 8 for `F64`. Alignment is not
    /// required: the value is written with `write_unaligned`.
    pub unsafe fn write_ptr(self, ptr: *mut u8, value: f64) {
        unsafe {
            match self {
                Self::F32 => ptr.cast::<f32>().write_unaligned(narrow_f32(value)),
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

    pub(super) fn check_range(self, value: f64) -> anyhow::Result<()> {
        if let Self::F32 = self
            && value.is_finite()
            && (value > f64::from(f32::MAX) || value < -f64::from(f32::MAX))
        {
            let name = self.name();
            bail!("Value {value} is out of range for {name}");
        }
        Ok(())
    }

    pub fn checked_to_stash(self, value: f64) -> anyhow::Result<ffi::Stash> {
        self.check_range(value)?;
        Ok(match self {
            Self::F32 => ffi::Stash::F32(narrow_f32(value)),
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
                    out.push(narrow_f32(v));
                }
                Ok(out.into())
            }
            Self::F64 => Ok(values.to_vec().into()),
        }
    }

    #[must_use]
    pub fn call_return(
        self,
        cif: &libffi::Cif,
        ptr: libffi::CodePtr,
        args: &[libffi::Arg<'_>],
    ) -> ffi::Stash {
        unsafe {
            match self {
                Self::F32 => ffi::Stash::F32(cif.call::<f32>(ptr, args)),
                Self::F64 => ffi::Stash::F64(cif.call::<f64>(ptr, args)),
            }
        }
    }

    /// # Safety
    ///
    /// `ptr` must be null, or point at 4 initialized, readable bytes for `F32` and 8 for
    /// `F64`. Alignment is not required.
    pub unsafe fn number_from_ptr_raw(self, ptr: *mut c_void) -> f64 {
        if ptr.is_null() {
            return 0.0;
        }
        unsafe { self.read_ptr(ptr.cast::<u8>()) }
    }

    fn number_from_value(value: Unknown<'_>) -> anyhow::Result<f64> {
        coerce_number(value, "float type", false)
    }

    unsafe fn write_return_widened(self, ret: *mut c_void, value: f64) {
        unsafe { self.write_ptr(ret.cast::<u8>(), value) };
    }
}

impl_numeric_codecs!(
    FloatCodec,
    "float",
    value: |codec, ptr, context| {
        let _ = context;
        unsafe { codec.number_from_ptr_raw(ptr) }
    },
    slot: |codec, ptr, context| {
        let _ = context;
        unsafe { codec.read_ptr(ptr.cast::<u8>()) }
    },
);

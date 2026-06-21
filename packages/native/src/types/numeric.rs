use anyhow::bail;
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

            /// # Safety
            ///
            /// `ptr` must point to at least `byte_size()` readable bytes holding a value of this
            /// kind's wire integer type; alignment is not required because the read is unaligned.
            pub unsafe fn read_ptr(self, ptr: *const u8) -> f64 {
                // SAFETY: per the contract `ptr` addresses an in-range value of the matched wire
                // type; `read_unaligned` loads it without an alignment requirement, then widens to f64.
                unsafe {
                    match self {
                        $(Self::$variant => ptr.cast::<$ty>().read_unaligned() as f64),+
                    }
                }
            }

            /// # Safety
            ///
            /// `ptr` must point to at least `byte_size()` writable bytes; the f64 is narrowed to
            /// this kind's wire integer type and stored unaligned.
            pub unsafe fn write_ptr(self, ptr: *mut u8, value: f64) {
                // SAFETY: per the contract `ptr` addresses `byte_size()` writable bytes;
                // `write_unaligned` stores the narrowed value there without an alignment requirement.
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

            /// # Safety
            ///
            /// `ptr` must point to a contiguous array of at least `length` elements of this kind's
            /// wire integer type (`byte_size() * length` readable bytes).
            pub unsafe fn read_slice(self, ptr: *const u8, length: usize) -> Vec<f64> {
                // SAFETY: per the contract there are `length` contiguous wire-type elements at
                // `ptr`; `from_raw_parts` builds a slice over exactly that region, widened to f64.
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
            /// `cif`, `ptr`, and `args` must describe a callable whose return type matches this
            /// kind's wire integer type, as ensured by the codec that built the cif and arg list.
            pub unsafe fn call_cif_raw(
                self,
                cif: &libffi::Cif,
                ptr: libffi::CodePtr,
                args: &[libffi::Arg],
            ) -> ffi::FfiValue {
                // SAFETY: the codec guarantees `cif`/`args` agree with the C signature and the
                // requested `$ty` matches the function's return type, so `cif.call` reads back the
                // correct scalar from the invoked function.
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

macro_rules! impl_numeric_codecs {
    ($kind:ty, $label:literal, $ptr_to_value:item) => {
        impl FfiEncoder for $kind {
            fn encode(&self, value: &value::Value) -> anyhow::Result<ffi::FfiValue> {
                let number = Self::number_from_value(value)?;
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
                // SAFETY: this codec built `cif`/`args` to match the C function's signature and
                // its return type matches `*self`'s wire type, satisfying `call_cif_raw`'s contract.
                Ok(unsafe { Self::call_cif_raw(*self, cif, ptr, args) })
            }
        }

        impl $kind {
            $ptr_to_value
        }

        impl FfiDecoder for $kind {
            unsafe fn read(&self, src: ReadSource<'_>) -> anyhow::Result<value::Value> {
                match src {
                    ReadSource::Call(ffi_value) => Ok(value::Value::Number(ffi_value.to_number()?)),
                    ReadSource::Slot(ptr, context) => {
                        // SAFETY: `ReadSource::Slot` carries a marshalling-provided pointer to a
                        // wire-type slot of this kind, satisfying `read_ptr_checked`'s precondition.
                        Ok(value::Value::Number(unsafe {
                            self.read_ptr_checked(ptr as *const u8, context)?
                        }))
                    }
                    // SAFETY: `ReadSource::Value` carries a pointer whose interpretation is defined
                    // by this codec's `ptr_to_value` (it reinterprets the pointer bits/value), which
                    // the marshalling layer guarantees matches the slot.
                    ReadSource::Value(ptr, context) => unsafe { self.ptr_to_value(ptr, context) },
                }
            }
        }

        impl RawPtrCodec for $kind {
            /// # Safety
            ///
            /// `ret` must point to a writable return slot wide enough for this kind's wire type
            /// (the trampoline widens integers to 8 bytes), as provided by the return path.
            unsafe fn write_return_to_raw_ptr(
                &self,
                ret: *mut c_void,
                value: &Result<value::Value, ()>,
            ) {
                let n = match value {
                    Ok(value::Value::Number(n)) => *n,
                    _ => 0.0,
                };
                // SAFETY: `ret` is the writable return slot per the contract; `write_return_widened`
                // stores the widened scalar into it.
                unsafe { self.write_return_widened(ret, n) };
            }

            /// # Safety
            ///
            /// `ptr` must point to a writable field slot of at least `byte_size()` bytes, as
            /// provided by the field marshalling layer.
            unsafe fn write_value_to_raw_ptr(
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
                // SAFETY: `ptr` addresses a writable wire-type slot per the contract;
                // `write_ptr` narrows and stores the number there.
                unsafe { self.write_ptr(ptr as *mut u8, *n) };
                Ok(())
            }
        }
    };
}

pub const MAX_SAFE_INTEGER_I128: i128 = 9_007_199_254_740_992;

const MAX_SAFE_INTEGER: f64 = MAX_SAFE_INTEGER_I128 as f64;

pub fn lossless_f64(value: i128, context: &str) -> anyhow::Result<f64> {
    if !(-MAX_SAFE_INTEGER_I128..=MAX_SAFE_INTEGER_I128).contains(&value) {
        bail!(
            "{context}: value {value} exceeds the 2^53 range JavaScript numbers represent exactly; use a bigint descriptor (t.bigint64/t.biguint64) for this slot"
        );
    }
    Ok(value as f64)
}

impl IntegerKind {
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

    /// # Safety
    ///
    /// `ptr` must point to a contiguous array of at least `length` elements of this kind's wire
    /// integer type (`byte_size() * length` readable bytes).
    pub unsafe fn read_slice_checked(
        self,
        ptr: *const u8,
        length: usize,
        context: &str,
    ) -> anyhow::Result<Vec<f64>> {
        // SAFETY: per the contract `ptr` covers `length` contiguous wire-type elements; for the
        // 64-bit kinds `from_raw_parts` reads exactly that region (checking each fits in an f64),
        // and the smaller kinds forward the same in-bounds buffer to `read_slice`.
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

    /// # Safety
    ///
    /// `ptr` must point to at least `byte_size()` readable bytes holding a value of this kind's
    /// wire integer type.
    pub(crate) unsafe fn read_ptr_checked(
        self,
        ptr: *const u8,
        context: &str,
    ) -> anyhow::Result<f64> {
        // SAFETY: per the contract `ptr` addresses an in-range wire-type value; the 64-bit kinds
        // read it unaligned and verify it fits in an f64, and the smaller kinds forward to
        // `read_ptr` over the same in-bounds slot.
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
        match value {
            value::Value::Number(n) => Ok(*n),
            value::Value::Object(handle) => Ok(handle.ptr_as_usize() as f64),
            value::Value::Null | value::Value::Undefined => Ok(0.0),
            _ => bail!("Expected a Number for integer type, got {value:?}"),
        }
    }

    /// # Safety
    ///
    /// `ret` must point to at least 8 writable bytes. The value is narrowed to this kind's wire
    /// integer type and stored widened to 8 bytes, matching libffi's promotion of small integer
    /// return values.
    pub(super) unsafe fn write_return_widened(self, ret: *mut c_void, value: f64) {
        // SAFETY: per the contract `ret` addresses 8 writable bytes; each arm narrows the value to
        // its wire type, re-widens to the 8-byte libffi return slot, and stores it unaligned.
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
    IntegerKind,
    "integer",
    /// # Safety
    ///
    /// `ptr` carries the raw value bits for this integer kind directly (it is not dereferenced),
    /// so any pointer-sized bit pattern is accepted; `context` only labels range-check errors.
    unsafe fn ptr_to_value(&self, ptr: *mut c_void, context: &str) -> anyhow::Result<value::Value> {
        self.ptr_to_value_raw(ptr, context)
    }
);

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

    /// # Safety
    ///
    /// `ptr` must point to at least 4 (`F32`) or 8 (`F64`) readable bytes holding a value of the
    /// matching float type; alignment is not required because the read is unaligned.
    #[must_use]
    pub unsafe fn read_ptr(self, ptr: *const u8) -> f64 {
        // SAFETY: per the contract `ptr` addresses a value of the matched float width;
        // `read_unaligned` loads it without an alignment requirement, widening `f32` to `f64`.
        unsafe {
            match self {
                Self::F32 => ptr.cast::<f32>().read_unaligned() as f64,
                Self::F64 => ptr.cast::<f64>().read_unaligned(),
            }
        }
    }

    /// # Safety
    ///
    /// `ptr` must point to at least 4 (`F32`) or 8 (`F64`) writable bytes; the value is narrowed
    /// to the matching float type and stored unaligned.
    pub unsafe fn write_ptr(self, ptr: *mut u8, value: f64) {
        // SAFETY: per the contract `ptr` addresses writable bytes for the matched float width;
        // `write_unaligned` stores the (possibly narrowed) value without an alignment requirement.
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

    /// # Safety
    ///
    /// `cif`, `ptr`, and `args` must describe a callable whose return type matches this float
    /// kind, as ensured by the codec that built the cif and arg list.
    #[must_use]
    pub unsafe fn call_cif_raw(
        self,
        cif: &libffi::Cif,
        ptr: libffi::CodePtr,
        args: &[libffi::Arg],
    ) -> ffi::FfiValue {
        // SAFETY: the codec guarantees `cif`/`args` agree with the C signature and the requested
        // float width matches the function's return type, so `cif.call` reads back the right scalar.
        unsafe {
            match self {
                Self::F32 => ffi::FfiValue::F32(cif.call::<f32>(ptr, args)),
                Self::F64 => ffi::FfiValue::F64(cif.call::<f64>(ptr, args)),
            }
        }
    }

    /// # Safety
    ///
    /// `ptr` must be null or point to at least 4 (`F32`) or 8 (`F64`) readable bytes holding a
    /// value of the matching float type.
    #[must_use]
    pub unsafe fn ptr_to_value_raw(self, ptr: *mut c_void) -> value::Value {
        if ptr.is_null() {
            return value::Value::Number(0.0);
        }
        // SAFETY: `ptr` is non-null here and points to a value of the matching float width per the
        // contract, satisfying `read_ptr`'s precondition.
        value::Value::Number(unsafe { self.read_ptr(ptr as *const u8) })
    }

    /// # Safety
    ///
    /// `ptr` must point to at least 4 (`F32`) or 8 (`F64`) readable bytes holding a value of the
    /// matching float type.
    #[allow(clippy::unnecessary_wraps)]
    pub(crate) unsafe fn read_ptr_checked(
        self,
        ptr: *const u8,
        _context: &str,
    ) -> anyhow::Result<f64> {
        // SAFETY: forwards the caller's float-slot guarantee to `read_ptr`; floats need no range
        // check, so this is infallible.
        Ok(unsafe { self.read_ptr(ptr) })
    }

    fn number_from_value(value: &value::Value) -> anyhow::Result<f64> {
        match value {
            value::Value::Number(n) => Ok(*n),
            value::Value::Null | value::Value::Undefined => Ok(0.0),
            _ => bail!("Expected a Number for float type, got {value:?}"),
        }
    }

    /// # Safety
    ///
    /// `ret` must point to at least 4 (`F32`) or 8 (`F64`) writable bytes, as provided by the
    /// trampoline return path.
    unsafe fn write_return_widened(self, ret: *mut c_void, value: f64) {
        // SAFETY: `ret` addresses a writable float-width return slot per the contract; `write_ptr`
        // narrows and stores the value there.
        unsafe { self.write_ptr(ret as *mut u8, value) };
    }
}

impl_numeric_codecs!(
    FloatKind,
    "float",
    /// # Safety
    ///
    /// `ptr` must be null or point to readable bytes of the matching float width, as provided by
    /// the value marshalling layer.
    #[allow(clippy::unnecessary_wraps)]
    unsafe fn ptr_to_value(
        &self,
        ptr: *mut c_void,
        _context: &str,
    ) -> anyhow::Result<value::Value> {
        // SAFETY: forwards the caller's float-slot guarantee to `ptr_to_value_raw`, which itself
        // null-guards before reading.
        Ok(unsafe { self.ptr_to_value_raw(ptr) })
    }
);

impl From<FloatKind> for libffi::Type {
    fn from(kind: FloatKind) -> Self {
        kind.ffi_type()
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[non_exhaustive]
pub enum TaggedKind {
    Enum,
    Flags,
}

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

    fn wire_kind(&self) -> IntegerKind {
        self.storage
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
        let Some(enum_class) = glib::EnumClass::with_type(gtype) else {
            return;
        };
        if enum_class.value(value).is_none() {
            crate::error_reporter::NativeErrorReporter::global().report_str(&format!(
                "Enum value {value} is not a valid member of {} (GType {gtype})",
                self.get_type_fn
            ));
        }
    }
}

impl FfiEncoder for TaggedType {
    fn encode(&self, value: &value::Value) -> anyhow::Result<ffi::FfiValue> {
        let result = FfiEncoder::encode(&self.storage, value)?;
        #[cfg(debug_assertions)]
        if self.kind == TaggedKind::Enum
            && let value::Value::Number(n) = value
        {
            self.validate_enum_value(*n as i32);
        }
        Ok(result)
    }

    integer_wire_encoder!(wire_kind);
}

impl FfiDecoder for TaggedType {
    unsafe fn read(&self, src: ReadSource<'_>) -> anyhow::Result<value::Value> {
        match src {
            ReadSource::Call(ffi_value) => FfiDecoder::decode(&self.storage, ffi_value),
            ReadSource::Value(ptr, context) => self.storage.ptr_to_value_raw(ptr, context),
            // SAFETY: `ReadSource::Slot` carries a marshalling-provided pointer to a slot of the
            // backing integer storage type, satisfying `read_ptr`'s precondition.
            ReadSource::Slot(ptr, _context) => Ok(value::Value::Number(unsafe {
                self.storage.read_ptr(ptr as *const u8)
            })),
        }
    }
}

impl RawPtrCodec for TaggedType {
    /// # Safety
    ///
    /// `ret` must point to a writable return slot wide enough for the backing integer storage
    /// type, as provided by the trampoline return path.
    unsafe fn write_return_to_raw_ptr(&self, ret: *mut c_void, value: &Result<value::Value, ()>) {
        // SAFETY: `ret` satisfies the backing integer codec's return-slot precondition per this
        // method's contract; the delegate writes the tag value there.
        unsafe { RawPtrCodec::write_return_to_raw_ptr(&self.storage, ret, value) };
    }

    /// # Safety
    ///
    /// `ptr` must point to a writable field slot wide enough for the backing integer storage type,
    /// as provided by the field marshalling layer.
    unsafe fn write_value_to_raw_ptr(
        &self,
        ptr: *mut c_void,
        value: &value::Value,
    ) -> anyhow::Result<()> {
        // SAFETY: `ptr` satisfies the backing integer codec's field-slot precondition per this
        // method's contract; the delegate writes the tag value there.
        unsafe { RawPtrCodec::write_value_to_raw_ptr(&self.storage, ptr, value) }
    }
}

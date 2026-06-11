//! BigInt-represented 64-bit integers.
//!
//! [`BigIntKind`] is the codec for FFI slots whose JavaScript representation
//! is a `bigint` instead of a `number`. The wire format matches the 64-bit
//! [`super::IntegerKind`] variants exactly — the kinds differ only in the IR
//! variant they produce and accept ([`value::Value::BigInt`]), which spans
//! the full `i64`/`u64` range instead of capping at 2^53.

use anyhow::bail;
use libffi::middle as libffi;

use super::IntegerKind;
use super::numeric::MAX_SAFE_INTEGER_I128;
use super::prelude::*;

/// Signedness of a BigInt-represented 64-bit FFI slot.
#[derive(Debug, Clone, Copy)]
#[non_exhaustive]
pub enum BigIntKind {
    I64,
    U64,
}

impl BigIntKind {
    /// The number-represented integer kind sharing this kind's wire format,
    /// which the codec delegates ABI-level work to.
    fn wire_kind(self) -> IntegerKind {
        match self {
            Self::I64 => IntegerKind::I64,
            Self::U64 => IntegerKind::U64,
        }
    }

    #[must_use]
    pub fn ffi_type(self) -> libffi::Type {
        self.wire_kind().ffi_type()
    }

    fn label(self) -> &'static str {
        match self {
            Self::I64 => "bigint64",
            Self::U64 => "biguint64",
        }
    }

    fn zero_ffi_value(self) -> ffi::FfiValue {
        match self {
            Self::I64 => ffi::FfiValue::I64(0),
            Self::U64 => ffi::FfiValue::U64(0),
        }
    }

    /// Extracts the integer payload a bigint argument encodes. `BigInt`
    /// values pass through exactly; `Number` values are accepted for
    /// ergonomics under the same integrality and 2^53 constraints the
    /// number-represented integer kinds enforce.
    fn int_from_value(self, value: &value::Value, optional: bool) -> anyhow::Result<i128> {
        match value {
            value::Value::BigInt(v) => Ok(*v),
            value::Value::Number(n) => {
                if !n.is_finite()
                    || n.fract() != 0.0
                    || *n > MAX_SAFE_INTEGER_I128 as f64
                    || *n < -(MAX_SAFE_INTEGER_I128 as f64)
                {
                    bail!(
                        "Value {n} is not an integer Number exactly representable as {}; pass a bigint",
                        self.label()
                    );
                }
                Ok(*n as i128)
            }
            value::Value::Null | value::Value::Undefined if optional => Ok(0),
            _ => bail!("Expected a BigInt for {} type, got {value:?}", self.label()),
        }
    }

    fn checked_to_ffi_value(self, value: i128) -> anyhow::Result<ffi::FfiValue> {
        match self {
            Self::I64 => i64::try_from(value).map(ffi::FfiValue::I64).map_err(|_| {
                anyhow::anyhow!(
                    "Value {value} is out of range for bigint64 [{}, {}]",
                    i64::MIN,
                    i64::MAX
                )
            }),
            Self::U64 => u64::try_from(value).map(ffi::FfiValue::U64).map_err(|_| {
                anyhow::anyhow!(
                    "Value {value} is out of range for biguint64 [0, {}]",
                    u64::MAX
                )
            }),
        }
    }

    /// # Safety
    ///
    /// `ptr` must be valid for a read of 8 bytes.
    unsafe fn read_i128(self, ptr: *const u8) -> i128 {
        // SAFETY: The caller guarantees `ptr` is readable at this kind's
        // 8-byte width; the reads are unaligned-tolerant.
        unsafe {
            match self {
                Self::I64 => i128::from(ptr.cast::<i64>().read_unaligned()),
                Self::U64 => i128::from(ptr.cast::<u64>().read_unaligned()),
            }
        }
    }
}

impl FfiEncoder for BigIntKind {
    fn encode(&self, value: &value::Value, optional: bool) -> anyhow::Result<ffi::FfiValue> {
        let int = self.int_from_value(value, optional)?;
        self.checked_to_ffi_value(int)
    }

    integer_wire_encoder!(wire_kind);
}

impl FfiDecoder for BigIntKind {
    fn decode(&self, ffi_value: &ffi::FfiValue) -> anyhow::Result<value::Value> {
        match ffi_value {
            ffi::FfiValue::I64(v) => Ok(value::Value::BigInt(i128::from(*v))),
            ffi::FfiValue::U64(v) => Ok(value::Value::BigInt(i128::from(*v))),
            other => bail!(
                "Expected a 64-bit FfiValue for {}, got {other:?}",
                self.label()
            ),
        }
    }
}

impl RawPtrCodec for BigIntKind {
    unsafe fn ptr_to_value(
        &self,
        ptr: *mut c_void,
        _context: &str,
    ) -> anyhow::Result<value::Value> {
        Ok(value::Value::BigInt(match self {
            Self::I64 => i128::from(ptr as i64),
            Self::U64 => i128::from(ptr as u64),
        }))
    }

    unsafe fn read_from_raw_ptr(
        &self,
        ptr: *const c_void,
        _context: &str,
    ) -> anyhow::Result<value::Value> {
        // SAFETY: The caller guarantees `ptr` is readable at this kind's
        // 8-byte width.
        Ok(value::Value::BigInt(unsafe { self.read_i128(ptr.cast()) }))
    }

    unsafe fn write_return_to_raw_ptr(
        &self,
        ret: *mut c_void,
        value: &std::result::Result<value::Value, ()>,
    ) {
        let int = value
            .as_ref()
            .ok()
            .and_then(|v| self.int_from_value(v, false).ok())
            .unwrap_or(0);
        let ffi_value = self
            .checked_to_ffi_value(int)
            .unwrap_or_else(|_| self.zero_ffi_value());
        // SAFETY: The caller guarantees `ret` is a writable 8-byte libffi
        // return slot, the exact width of this kind's scalar payload.
        let _ = unsafe { ffi_value.write_scalar_to(ret) };
    }

    unsafe fn write_value_to_raw_ptr(
        &self,
        ptr: *mut c_void,
        value: &value::Value,
    ) -> anyhow::Result<()> {
        let int = self.int_from_value(value, false)?;
        let ffi_value = self.checked_to_ffi_value(int)?;
        // SAFETY: The caller guarantees `ptr` is writable at this kind's
        // 8-byte width.
        unsafe { ffi_value.write_scalar_to(ptr) }
    }
}

impl From<BigIntKind> for libffi::Type {
    fn from(kind: BigIntKind) -> Self {
        kind.ffi_type()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn encode_accepts_bigint_beyond_2_53() {
        let value = value::Value::BigInt(i128::from(u64::MAX));
        let encoded = BigIntKind::U64.encode(&value, false).expect("encode");
        match encoded {
            ffi::FfiValue::U64(v) => assert_eq!(v, u64::MAX),
            other => panic!("expected U64, got {other:?}"),
        }
    }

    #[test]
    fn encode_accepts_small_integral_numbers() {
        let value = value::Value::Number(42.0);
        let encoded = BigIntKind::I64.encode(&value, false).expect("encode");
        match encoded {
            ffi::FfiValue::I64(v) => assert_eq!(v, 42),
            other => panic!("expected I64, got {other:?}"),
        }
    }

    #[test]
    fn encode_rejects_fractional_numbers() {
        let value = value::Value::Number(1.5);
        let err = BigIntKind::I64
            .encode(&value, false)
            .expect_err("fractional");
        assert!(err.to_string().contains("pass a bigint"));
    }

    #[test]
    fn encode_rejects_numbers_beyond_2_53() {
        let value = value::Value::Number(9_007_199_254_740_994.0);
        let err = BigIntKind::U64
            .encode(&value, false)
            .expect_err("imprecise");
        assert!(err.to_string().contains("pass a bigint"));
    }

    #[test]
    fn encode_rejects_negative_bigint_for_unsigned() {
        let value = value::Value::BigInt(-1);
        let err = BigIntKind::U64.encode(&value, false).expect_err("negative");
        assert!(err.to_string().contains("out of range for biguint64"));
    }

    #[test]
    fn encode_rejects_bigint_beyond_u64() {
        let value = value::Value::BigInt(i128::from(u64::MAX) + 1);
        let err = BigIntKind::U64.encode(&value, false).expect_err("overflow");
        assert!(err.to_string().contains("out of range for biguint64"));
    }

    #[test]
    fn optional_null_encodes_as_zero() {
        let encoded = BigIntKind::I64
            .encode(&value::Value::Null, true)
            .expect("encode");
        match encoded {
            ffi::FfiValue::I64(v) => assert_eq!(v, 0),
            other => panic!("expected I64, got {other:?}"),
        }
    }

    #[test]
    fn decode_produces_exact_bigint() {
        let decoded = BigIntKind::U64
            .decode(&ffi::FfiValue::U64(u64::MAX))
            .expect("decode");
        match decoded {
            value::Value::BigInt(v) => assert_eq!(v, i128::from(u64::MAX)),
            other => panic!("expected BigInt, got {other:?}"),
        }
    }

    #[test]
    fn decode_rejects_non_64_bit_payloads() {
        let err = BigIntKind::I64
            .decode(&ffi::FfiValue::F64(1.0))
            .expect_err("mismatch");
        assert!(err.to_string().contains("Expected a 64-bit FfiValue"));
    }

    #[test]
    fn field_write_then_read_round_trips_beyond_2_53() {
        let mut slot = [0u8; 8];
        let big = i128::from(u64::MAX) - 7;
        // SAFETY: The local 8-byte buffer is valid for this kind's write and
        // read.
        unsafe {
            BigIntKind::U64
                .write_value_to_raw_ptr(slot.as_mut_ptr().cast(), &value::Value::BigInt(big))
                .expect("write");
            let read = BigIntKind::U64
                .read_from_raw_ptr(slot.as_ptr().cast(), "test")
                .expect("read");
            match read {
                value::Value::BigInt(v) => assert_eq!(v, big),
                other => panic!("expected BigInt, got {other:?}"),
            }
        }
    }

    #[test]
    fn write_return_clamps_invalid_values_to_zero() {
        let mut slot = [0xFFu8; 8];
        // SAFETY: The local 8-byte buffer is a valid stand-in for the libffi
        // return slot.
        unsafe {
            BigIntKind::U64
                .write_return_to_raw_ptr(slot.as_mut_ptr().cast(), &Ok(value::Value::BigInt(-1)));
        }
        assert_eq!(slot, [0u8; 8]);
    }

    #[test]
    fn ptr_to_value_reinterprets_pointer_bits() {
        let ptr = 0x1234usize as *mut std::ffi::c_void;
        // SAFETY: ptr_to_value reinterprets the pointer value itself and
        // never dereferences it.
        let value = unsafe { BigIntKind::U64.ptr_to_value(ptr, "test") }.expect("convert");
        match value {
            value::Value::BigInt(v) => assert_eq!(v, 0x1234),
            other => panic!("expected BigInt, got {other:?}"),
        }
    }
}

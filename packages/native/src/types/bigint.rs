use anyhow::bail;
use libffi::middle as libffi;

use super::IntegerKind;
use super::numeric::MAX_SAFE_INTEGER_I128;
use super::prelude::*;

#[derive(Debug, Clone, Copy)]
#[non_exhaustive]
pub enum BigIntKind {
    I64,
    U64,
}

impl BigIntKind {
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

    fn int_from_value(self, value: &value::Value) -> anyhow::Result<i128> {
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
            value::Value::Null | value::Value::Undefined => Ok(0),
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
    /// `ptr` must point to at least 8 readable bytes holding a value of this kind's wire type
    /// (`i64` or `u64`); alignment is not required because the read is unaligned.
    unsafe fn read_i128(self, ptr: *const u8) -> i128 {
        // SAFETY: per the contract `ptr` addresses 8 readable bytes; `read_unaligned` loads the
        // wire integer without an alignment requirement, then widens it losslessly to `i128`.
        unsafe {
            match self {
                Self::I64 => i128::from(ptr.cast::<i64>().read_unaligned()),
                Self::U64 => i128::from(ptr.cast::<u64>().read_unaligned()),
            }
        }
    }

    #[must_use]
    pub fn byte_size(self) -> usize {
        self.wire_kind().byte_size()
    }

    /// # Safety
    ///
    /// `ptr` must point to a contiguous array of at least `len` elements of this kind's wire type
    /// (`8 * len` readable bytes), as produced by the FFI marshalling layer.
    #[must_use]
    pub unsafe fn read_slice(self, ptr: *const u8, len: usize) -> Vec<value::Value> {
        // SAFETY: per the contract there are `len` contiguous wire-type elements at `ptr`;
        // `ptr.add(i * byte_size)` stays within that buffer for every `i < len`, and `read_i128`
        // reads one in-bounds element each iteration.
        (0..len)
            .map(|i| value::Value::BigInt(unsafe { self.read_i128(ptr.add(i * self.byte_size())) }))
            .collect()
    }

    pub fn to_ffi_storage(self, array: &[value::Value]) -> anyhow::Result<ffi::FfiStorage> {
        let int_at = |i: usize, v: &value::Value| {
            self.int_from_value(v)
                .map_err(|e| anyhow::anyhow!("Array element {i}: {e}"))
        };
        match self {
            Self::I64 => array
                .iter()
                .enumerate()
                .map(|(i, v)| {
                    i64::try_from(int_at(i, v)?).map_err(|_| {
                        anyhow::anyhow!("Array element {i}: value out of range for bigint64")
                    })
                })
                .collect::<anyhow::Result<Vec<i64>>>()
                .map(Into::into),
            Self::U64 => array
                .iter()
                .enumerate()
                .map(|(i, v)| {
                    u64::try_from(int_at(i, v)?).map_err(|_| {
                        anyhow::anyhow!("Array element {i}: value out of range for biguint64")
                    })
                })
                .collect::<anyhow::Result<Vec<u64>>>()
                .map(Into::into),
        }
    }

    /// # Safety
    ///
    /// `ptr` must point to at least 8 writable bytes, into which the encoded 64-bit value is
    /// written.
    pub unsafe fn append_into(self, ptr: *mut u8, value: &value::Value) -> anyhow::Result<()> {
        let ffi_value = self.checked_to_ffi_value(self.int_from_value(value)?)?;
        // SAFETY: `ffi_value` is a range-checked 64-bit scalar and `ptr` addresses 8 writable
        // bytes per the contract; `write_scalar_to` stores the scalar into that slot.
        unsafe { ffi_value.write_scalar_to(ptr.cast()) }
    }
}

impl FfiEncoder for BigIntKind {
    fn encode(&self, value: &value::Value) -> anyhow::Result<ffi::FfiValue> {
        let int = self.int_from_value(value)?;
        self.checked_to_ffi_value(int)
    }

    integer_wire_encoder!(wire_kind);
}

impl FfiDecoder for BigIntKind {
    unsafe fn read(&self, src: ReadSource<'_>) -> anyhow::Result<value::Value> {
        match src {
            ReadSource::Call(ffi_value) => match ffi_value {
                ffi::FfiValue::I64(v) => Ok(value::Value::BigInt(i128::from(*v))),
                ffi::FfiValue::U64(v) => Ok(value::Value::BigInt(i128::from(*v))),
                other => bail!(
                    "Expected a 64-bit FfiValue for {}, got {other:?}",
                    self.label()
                ),
            },
            ReadSource::Value(ptr, _context) => Ok(value::Value::BigInt(match self {
                Self::I64 => i128::from(ptr as i64),
                Self::U64 => i128::from(ptr as u64),
            })),
            ReadSource::Slot(ptr, _context) => {
                // SAFETY: `ReadSource::Slot` carries a pointer to an 8-byte wire-type slot supplied
                // by the marshalling layer, satisfying `read_i128`'s precondition.
                Ok(value::Value::BigInt(unsafe { self.read_i128(ptr.cast()) }))
            }
        }
    }
}

impl RawPtrCodec for BigIntKind {
    /// # Safety
    ///
    /// `ret` must point to a writable return slot of at least 8 bytes, as provided by the
    /// trampoline return path.
    unsafe fn write_return_to_raw_ptr(
        &self,
        ret: *mut c_void,
        value: &std::result::Result<value::Value, ()>,
    ) {
        let int = value
            .as_ref()
            .ok()
            .and_then(|v| self.int_from_value(v).ok())
            .unwrap_or(0);
        let ffi_value = self
            .checked_to_ffi_value(int)
            .unwrap_or_else(|_| self.zero_ffi_value());
        // SAFETY: `ffi_value` is a 64-bit scalar and `ret` addresses an 8-byte writable return
        // slot per the contract; `write_scalar_to` stores the scalar there.
        let _ = unsafe { ffi_value.write_scalar_to(ret) };
    }

    /// # Safety
    ///
    /// `ptr` must point to a writable field slot of at least 8 bytes, as provided by the field
    /// marshalling layer.
    unsafe fn write_value_to_raw_ptr(
        &self,
        ptr: *mut c_void,
        value: &value::Value,
    ) -> anyhow::Result<()> {
        let int = self.int_from_value(value)?;
        let ffi_value = self.checked_to_ffi_value(int)?;
        // SAFETY: `ffi_value` is a range-checked 64-bit scalar and `ptr` addresses an 8-byte
        // writable slot per the contract; `write_scalar_to` stores the scalar there.
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

    fn assert_field_round_trip(kind: BigIntKind, big: i128) {
        let mut slot = [0u8; 8];
        // SAFETY: `slot` is an 8-byte local buffer, satisfying the field-write and slot-read
        // preconditions of `write_value_to_raw_ptr` and `read(ReadSource::Slot)` for a 64-bit kind.
        unsafe {
            kind.write_value_to_raw_ptr(slot.as_mut_ptr().cast(), &value::Value::BigInt(big))
                .expect("write");
            let read = kind
                .read(ReadSource::Slot(slot.as_ptr().cast(), "test"))
                .expect("read");
            assert!(matches!(read, value::Value::BigInt(v) if v == big));
        }
    }

    #[test]
    fn encode_accepts_bigint_beyond_2_53() {
        let value = value::Value::BigInt(i128::from(u64::MAX));
        let encoded = BigIntKind::U64.encode(&value).expect("encode");
        assert!(matches!(encoded, ffi::FfiValue::U64(v) if v == u64::MAX));
    }

    #[test]
    fn encode_accepts_small_integral_numbers() {
        let value = value::Value::Number(42.0);
        let encoded = BigIntKind::I64.encode(&value).expect("encode");
        assert!(matches!(encoded, ffi::FfiValue::I64(42)));
    }

    #[test]
    fn optional_null_encodes_as_zero() {
        let encoded = BigIntKind::I64.encode(&value::Value::Null).expect("encode");
        assert!(matches!(encoded, ffi::FfiValue::I64(0)));
    }

    #[test]
    fn decode_produces_exact_bigint() {
        let decoded = BigIntKind::U64
            .decode(&ffi::FfiValue::U64(u64::MAX))
            .expect("decode");
        assert!(matches!(decoded, value::Value::BigInt(v) if v == i128::from(u64::MAX)));
    }

    #[test]
    fn field_write_then_read_round_trips_beyond_2_53() {
        assert_field_round_trip(BigIntKind::U64, i128::from(u64::MAX) - 7);
    }

    #[test]
    fn ptr_to_value_reinterprets_pointer_bits() {
        let ptr = 0x1234usize as *mut std::ffi::c_void;
        // SAFETY: `ReadSource::Value` reinterprets the pointer bits directly without dereferencing,
        // so any pointer-sized value (here `0x1234`) is a valid input.
        let value =
            unsafe { BigIntKind::U64.read(ReadSource::Value(ptr, "test")) }.expect("convert");
        assert!(matches!(value, value::Value::BigInt(v) if v == 0x1234));
    }

    #[test]
    fn ffi_type_and_from_cover_both_kinds() {
        for kind in [BigIntKind::I64, BigIntKind::U64] {
            assert_eq!(
                kind.ffi_type().as_raw_ptr(),
                libffi::Type::from(kind).as_raw_ptr()
            );
        }
    }

    #[test]
    fn decode_i64_produces_exact_bigint() {
        let decoded = BigIntKind::I64
            .decode(&ffi::FfiValue::I64(i64::MIN))
            .expect("decode");
        assert!(matches!(decoded, value::Value::BigInt(v) if v == i128::from(i64::MIN)));
    }

    #[test]
    fn field_write_then_read_round_trips_i64() {
        assert_field_round_trip(BigIntKind::I64, i128::from(i64::MIN));
    }

    #[test]
    fn ptr_to_value_i64_reinterprets_pointer_bits() {
        let ptr = usize::MAX as *mut std::ffi::c_void;
        // SAFETY: `ReadSource::Value` reinterprets the pointer bits directly without dereferencing,
        // so any pointer-sized value (here all-ones) is a valid input.
        let value =
            unsafe { BigIntKind::I64.read(ReadSource::Value(ptr, "test")) }.expect("convert");
        assert!(matches!(value, value::Value::BigInt(v) if v == -1));
    }

    #[test]
    fn byte_size_is_eight_for_both_kinds() {
        assert_eq!(BigIntKind::I64.byte_size(), 8);
        assert_eq!(BigIntKind::U64.byte_size(), 8);
    }

    #[test]
    fn read_slice_reads_contiguous_elements() {
        let buffer: [u64; 3] = [u64::MAX, 0, 42];
        // SAFETY: `buffer` is a contiguous array of 3 `u64` elements, matching the `len = 3`
        // passed to `read_slice` for the U64 wire type.
        let values = unsafe { BigIntKind::U64.read_slice(buffer.as_ptr().cast(), 3) };
        assert_eq!(values.len(), 3);
        assert!(matches!(values[0], value::Value::BigInt(v) if v == i128::from(u64::MAX)));
        assert!(matches!(values[2], value::Value::BigInt(v) if v == 42));
    }

    #[test]
    fn to_ffi_storage_round_trips_through_as_bigint_vec() {
        for (kind, payload) in [
            (BigIntKind::I64, i128::from(i64::MIN)),
            (BigIntKind::U64, i128::from(u64::MAX)),
        ] {
            let storage = kind
                .to_ffi_storage(&[value::Value::BigInt(payload), value::Value::BigInt(7)])
                .expect("encode");
            let back = storage.as_bigint_vec(kind).expect("decode");
            assert_eq!(back, vec![payload, 7]);
        }
    }

    #[test]
    fn to_ffi_storage_rejects_out_of_range_element() {
        assert!(
            BigIntKind::U64
                .to_ffi_storage(&[value::Value::BigInt(-1)])
                .is_err()
        );
        assert!(
            BigIntKind::I64
                .to_ffi_storage(&[value::Value::BigInt(i128::from(i64::MAX) + 1)])
                .is_err()
        );
    }

    #[test]
    fn append_into_writes_value_into_slot() {
        let mut slot = [0u8; 8];
        // SAFETY: `slot` is an 8-byte local buffer, satisfying `append_into`'s 8-byte write slot.
        unsafe {
            BigIntKind::I64
                .append_into(slot.as_mut_ptr(), &value::Value::BigInt(-5))
                .expect("write");
        }
        // SAFETY: `slot` holds the 8-byte value just written, satisfying `read_i128`'s precondition.
        let read = unsafe { BigIntKind::I64.read_i128(slot.as_ptr()) };
        assert_eq!(read, -5);
    }

    #[test]
    fn encode_rejects_non_integer_number() {
        assert!(BigIntKind::I64.encode(&value::Value::Number(1.5)).is_err());
    }

    #[test]
    fn encode_rejects_non_numeric_value() {
        assert!(
            BigIntKind::U64
                .encode(&value::Value::String("nope".to_string()))
                .is_err()
        );
    }

    #[test]
    fn encode_rejects_out_of_range_bigint() {
        assert!(BigIntKind::U64.encode(&value::Value::BigInt(-1)).is_err());
        assert!(
            BigIntKind::I64
                .encode(&value::Value::BigInt(i128::from(i64::MAX) + 1))
                .is_err()
        );
    }

    #[test]
    fn decode_rejects_non_64bit_ffi_value() {
        assert!(BigIntKind::I64.decode(&ffi::FfiValue::I32(5)).is_err());
    }

    #[test]
    fn write_return_writes_value() {
        let mut slot = [0u8; 8];
        let value: std::result::Result<value::Value, ()> = Ok(value::Value::BigInt(123));
        // SAFETY: `slot` is an 8-byte local buffer, satisfying the return-slot precondition.
        unsafe { BigIntKind::I64.write_return_to_raw_ptr(slot.as_mut_ptr().cast(), &value) };
        // SAFETY: `slot` holds the 8-byte value just written, satisfying `read_i128`'s precondition.
        assert_eq!(unsafe { BigIntKind::I64.read_i128(slot.as_ptr()) }, 123);
    }

    #[test]
    fn write_return_falls_back_to_zero_when_unrepresentable() {
        for (kind, payload) in [
            (BigIntKind::I64, i128::from(i64::MAX) + 1),
            (BigIntKind::U64, i128::from(u64::MAX) + 1),
        ] {
            let mut slot = [0xFFu8; 8];
            let value: std::result::Result<value::Value, ()> = Ok(value::Value::BigInt(payload));
            // SAFETY: `slot` is an 8-byte local buffer, satisfying the return-slot precondition.
            unsafe { kind.write_return_to_raw_ptr(slot.as_mut_ptr().cast(), &value) };
            // SAFETY: `slot` holds the 8 bytes just written, satisfying `read_i128`'s precondition.
            assert_eq!(unsafe { kind.read_i128(slot.as_ptr()) }, 0);
        }
    }
}

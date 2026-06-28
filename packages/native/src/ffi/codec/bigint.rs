use anyhow::bail;
use libffi::middle as libffi;

use super::IntegerCodec;
use super::numeric::MAX_SAFE_INTEGER;
use super::prelude::*;
use crate::ffi::descriptor::Descriptor;

#[derive(Debug, Clone, Copy)]
pub enum BigIntCodec {
    I64,
    U64,
}

impl BigIntCodec {
    fn wire_kind(self) -> IntegerCodec {
        match self {
            Self::I64 => IntegerCodec::I64,
            Self::U64 => IntegerCodec::U64,
        }
    }

    pub fn ffi_type(self) -> libffi::Type {
        self.wire_kind().ffi_type()
    }

    fn label(self) -> &'static str {
        match self {
            Self::I64 => (&Descriptor::Bigint64).into(),
            Self::U64 => (&Descriptor::Biguint64).into(),
        }
    }

    fn zero_stashed_value(self) -> ffi::StashedValue {
        match self {
            Self::I64 => ffi::StashedValue::I64(0),
            Self::U64 => ffi::StashedValue::U64(0),
        }
    }

    fn int_from_value(self, value: &value::Value) -> anyhow::Result<i128> {
        match value {
            value::Value::BigInt(v) => Ok(*v),
            value::Value::Number(n) => {
                if !n.is_finite()
                    || n.fract() != 0.0
                    || *n > MAX_SAFE_INTEGER
                    || *n < -MAX_SAFE_INTEGER
                {
                    bail!(
                        "Value {n} is not an integer Number exactly representable as {}; pass a bigint",
                        self.label()
                    );
                }
                Ok(*n as i128)
            }
            value::Value::Null | value::Value::Undefined => Ok(0),
            _ => bail!(
                "Expected a BigInt for {} codec, got {value:?}",
                self.label()
            ),
        }
    }

    fn checked_to_stashed_value(self, value: i128) -> anyhow::Result<ffi::StashedValue> {
        match self {
            Self::I64 => i64::try_from(value)
                .map(ffi::StashedValue::I64)
                .map_err(|_| {
                    anyhow::anyhow!(
                        "Value {value} is out of range for bigint64 [{}, {}]",
                        i64::MIN,
                        i64::MAX
                    )
                }),
            Self::U64 => u64::try_from(value)
                .map(ffi::StashedValue::U64)
                .map_err(|_| {
                    anyhow::anyhow!(
                        "Value {value} is out of range for biguint64 [0, {}]",
                        u64::MAX
                    )
                }),
        }
    }

    unsafe fn read_i128(self, ptr: *const u8) -> i128 {
        unsafe {
            match self {
                Self::I64 => i128::from(ptr.cast::<i64>().read_unaligned()),
                Self::U64 => i128::from(ptr.cast::<u64>().read_unaligned()),
            }
        }
    }

    pub fn byte_size(self) -> usize {
        self.wire_kind().byte_size()
    }

    pub unsafe fn read_slice(self, ptr: *const u8, len: usize) -> Vec<value::Value> {
        (0..len)
            .map(|i| value::Value::BigInt(unsafe { self.read_i128(ptr.add(i * self.byte_size())) }))
            .collect()
    }

    pub fn to_stash(self, array: &[value::Value]) -> anyhow::Result<ffi::Stash> {
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

    pub unsafe fn append_into(self, ptr: *mut u8, value: &value::Value) -> anyhow::Result<()> {
        let stashed_value = self.checked_to_stashed_value(self.int_from_value(value)?)?;
        unsafe { stashed_value.write_scalar_to(ptr.cast()) }
    }
}

impl Encoder for BigIntCodec {
    fn encode(&self, value: &value::Value) -> anyhow::Result<ffi::StashedValue> {
        let int = self.int_from_value(value)?;
        self.checked_to_stashed_value(int)
    }

    fn libffi_type(&self) -> libffi::Type {
        Encoder::libffi_type(&self.wire_kind())
    }

    fn call_cif(
        &self,
        cif: &libffi::Cif,
        ptr: libffi::CodePtr,
        args: &[libffi::Arg],
    ) -> anyhow::Result<ffi::StashedValue> {
        Encoder::call_cif(&self.wire_kind(), cif, ptr, args)
    }
}

impl Decoder for BigIntCodec {
    unsafe fn read(&self, src: ReadSource<'_>) -> anyhow::Result<value::Value> {
        match src {
            ReadSource::Call(stashed_value) => match stashed_value {
                ffi::StashedValue::I64(v) => Ok(value::Value::BigInt(i128::from(*v))),
                ffi::StashedValue::U64(v) => Ok(value::Value::BigInt(i128::from(*v))),
                other => bail!(
                    "Expected a 64-bit StashedValue for {}, got {other:?}",
                    self.label()
                ),
            },
            ReadSource::Value(ptr, _context) => Ok(value::Value::BigInt(match self {
                Self::I64 => i128::from(ptr as i64),
                Self::U64 => i128::from(ptr as u64),
            })),
            ReadSource::Slot(ptr, _context) => {
                Ok(value::Value::BigInt(unsafe { self.read_i128(ptr.cast()) }))
            }
        }
    }
}

impl PointerWriter for BigIntCodec {
    unsafe fn write_return_to_pointer(
        &self,
        ret: *mut c_void,
        value: &std::result::Result<value::Value, ()>,
    ) {
        let int = value
            .as_ref()
            .ok()
            .and_then(|v| self.int_from_value(v).ok())
            .unwrap_or(0);
        let stashed_value = self
            .checked_to_stashed_value(int)
            .unwrap_or_else(|_| self.zero_stashed_value());
        let _ = unsafe { stashed_value.write_scalar_to(ret) };
    }

    unsafe fn write_value_to_pointer(
        &self,
        ptr: *mut c_void,
        value: &value::Value,
    ) -> anyhow::Result<()> {
        let int = self.int_from_value(value)?;
        let stashed_value = self.checked_to_stashed_value(int)?;
        unsafe { stashed_value.write_scalar_to(ptr) }
    }
}

impl From<BigIntCodec> for libffi::Type {
    fn from(kind: BigIntCodec) -> Self {
        kind.ffi_type()
    }
}

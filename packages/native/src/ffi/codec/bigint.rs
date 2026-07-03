use anyhow::bail;

use super::IntegerCodec;
use super::forward_ffi_encoder;
use super::numeric::MAX_SAFE_INTEGER;
use super::prelude::*;

#[derive(Debug, Clone, Copy)]
pub enum BigIntCodec {
    I64,
    U64,
}

impl BigIntCodec {
    fn ffi_codec(self) -> IntegerCodec {
        match self {
            Self::I64 => IntegerCodec::I64,
            Self::U64 => IntegerCodec::U64,
        }
    }

    fn name(self) -> &'static str {
        match self {
            Self::I64 => "bigint64",
            Self::U64 => "biguint64",
        }
    }

    fn zero_stash(self) -> ffi::Stash {
        match self {
            Self::I64 => ffi::Stash::I64(0),
            Self::U64 => ffi::Stash::U64(0),
        }
    }

    fn integer_from_value(self, value: &value::Value) -> anyhow::Result<i128> {
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
                        self.name()
                    );
                }
                Ok(*n as i128)
            }
            value::Value::Null | value::Value::Undefined => Ok(0),
            _ => bail_expected!("a BigInt", self.name(), value),
        }
    }

    fn checked_to_stash(self, value: i128) -> anyhow::Result<ffi::Stash> {
        match self {
            Self::I64 => i64::try_from(value).map(ffi::Stash::I64).map_err(|_| {
                anyhow::anyhow!(
                    "Value {value} is out of range for bigint64 [{}, {}]",
                    i64::MIN,
                    i64::MAX
                )
            }),
            Self::U64 => u64::try_from(value).map(ffi::Stash::U64).map_err(|_| {
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
        self.ffi_codec().byte_size()
    }

    pub unsafe fn read_slice(self, ptr: *const u8, len: usize) -> Vec<value::Value> {
        (0..len)
            .map(|i| value::Value::BigInt(unsafe { self.read_i128(ptr.add(i * self.byte_size())) }))
            .collect()
    }

    pub fn to_stash_storage(self, array: &[value::Value]) -> anyhow::Result<ffi::StashStorage> {
        let integer_at = |i: usize, v: &value::Value| {
            self.integer_from_value(v)
                .map_err(|e| anyhow::anyhow!("Array element {i}: {e}"))
        };
        match self {
            Self::I64 => array
                .iter()
                .enumerate()
                .map(|(i, v)| {
                    i64::try_from(integer_at(i, v)?).map_err(|_| {
                        anyhow::anyhow!("Array element {i}: value out of range for bigint64")
                    })
                })
                .collect::<anyhow::Result<Vec<i64>>>()
                .map(Into::into),
            Self::U64 => array
                .iter()
                .enumerate()
                .map(|(i, v)| {
                    u64::try_from(integer_at(i, v)?).map_err(|_| {
                        anyhow::anyhow!("Array element {i}: value out of range for biguint64")
                    })
                })
                .collect::<anyhow::Result<Vec<u64>>>()
                .map(Into::into),
        }
    }

    pub unsafe fn append_into(self, ptr: *mut u8, value: &value::Value) -> anyhow::Result<()> {
        let stash = self.checked_to_stash(self.integer_from_value(value)?)?;
        unsafe { stash.write_scalar_to_ptr(ptr.cast()) }
    }
}

impl Encoder for BigIntCodec {
    fn encode(&self, value: &value::Value) -> anyhow::Result<ffi::Stash> {
        let int = self.integer_from_value(value)?;
        self.checked_to_stash(int)
    }

    forward_ffi_encoder!();
}

impl Decoder for BigIntCodec {
    unsafe fn read(&self, src: ReadSource<'_>) -> anyhow::Result<value::Value> {
        match src {
            ReadSource::Call(stash) => match stash {
                ffi::Stash::I64(v) => Ok(value::Value::BigInt(i128::from(*v))),
                ffi::Stash::U64(v) => Ok(value::Value::BigInt(i128::from(*v))),
                other => bail!("Expected a 64-bit Stash for {}, got {other:?}", self.name()),
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

impl PtrWriter for BigIntCodec {
    fn write_return_to_ptr(&self, ret: ffi::Slot, value: &std::result::Result<value::Value, ()>) {
        let int = value
            .as_ref()
            .ok()
            .and_then(|v| self.integer_from_value(v).ok())
            .unwrap_or(0);
        let stash = self
            .checked_to_stash(int)
            .unwrap_or_else(|_| self.zero_stash());
        let _ = unsafe { stash.write_scalar_to_ptr(ret.as_ptr()) };
    }

    fn write_value_to_ptr(&self, slot: ffi::Slot, value: &value::Value) -> anyhow::Result<()> {
        let int = self.integer_from_value(value)?;
        let stash = self.checked_to_stash(int)?;
        unsafe { stash.write_scalar_to_ptr(slot.as_ptr()) }
    }
}

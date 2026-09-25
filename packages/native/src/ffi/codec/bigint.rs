use anyhow::bail;

use super::prelude::*;
use super::{IntegerCodec, forward_ffi_encoder};

#[derive(Debug, Clone, Copy)]
pub enum BigIntCodec {
    I64,
    U64,
}

impl IntegerBacked for BigIntCodec {
    fn ffi_codec(&self) -> IntegerCodec {
        match self {
            Self::I64 => IntegerCodec::I64,
            Self::U64 => IntegerCodec::U64,
        }
    }
}

impl BigIntCodec {
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

    fn integer_from_value(value: Unknown<'_>) -> anyhow::Result<i128> {
        let big = value::read_napi::<BigInt>(value)?;
        let (int, lossless) = big.get_i128();
        if !lossless {
            bail!("BigInt value exceeds the supported 128-bit range");
        }
        Ok(int)
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

    /// Encodes a value the way [`Encoder::encode`] does, for a caller that needs the 64-bit word
    /// itself rather than a libffi argument.
    pub(super) fn entry_stash(self, value: Unknown<'_>) -> anyhow::Result<ffi::Stash> {
        let int = Self::integer_from_value(value)?;

        self.checked_to_stash(int)
    }

    unsafe fn read_i128(self, ptr: *const u8) -> i128 {
        unsafe {
            match self {
                Self::I64 => i128::from(ptr.cast::<i64>().read_unaligned()),
                Self::U64 => i128::from(ptr.cast::<u64>().read_unaligned()),
            }
        }
    }

    #[must_use]
    pub fn byte_size(self) -> usize {
        self.ffi_codec().byte_size()
    }

    /// # Safety
    ///
    /// `ptr` must point at `len * self.byte_size()` initialized, readable bytes that stay valid
    /// for the whole call. Alignment is not required: every element is read with
    /// `read_unaligned`.
    #[must_use]
    pub unsafe fn read_slice(self, ptr: *const u8, len: usize) -> Vec<i128> {
        (0..len)
            .map(|i| unsafe { self.read_i128(ptr.add(i * self.byte_size())) })
            .collect()
    }

    pub fn to_stash_storage(self, array: &[Unknown<'_>]) -> anyhow::Result<ffi::StashStorage> {
        let integer_at = |i: usize, v: Unknown<'_>| {
            Self::integer_from_value(v).map_err(|e| anyhow::anyhow!("Array element {i}: {e}"))
        };
        match self {
            Self::I64 => array
                .iter()
                .enumerate()
                .map(|(i, &v)| {
                    i64::try_from(integer_at(i, v)?).map_err(|_| {
                        anyhow::anyhow!("Array element {i}: value out of range for bigint64")
                    })
                })
                .collect::<anyhow::Result<Vec<i64>>>()
                .map(Into::into),
            Self::U64 => array
                .iter()
                .enumerate()
                .map(|(i, &v)| {
                    u64::try_from(integer_at(i, v)?).map_err(|_| {
                        anyhow::anyhow!("Array element {i}: value out of range for biguint64")
                    })
                })
                .collect::<anyhow::Result<Vec<u64>>>()
                .map(Into::into),
        }
    }

    pub(super) fn to_pointer_words(array: &[Unknown<'_>]) -> anyhow::Result<Vec<*mut c_void>> {
        array
            .iter()
            .enumerate()
            .map(|(i, &v)| {
                let int = Self::integer_from_value(v)
                    .map_err(|e| anyhow::anyhow!("Array element {i}: {e}"))?;
                let word = usize::try_from(int).map_err(|_| {
                    anyhow::anyhow!("Array element {i}: value {int} is not a valid pointer")
                })?;

                Ok(word as *mut c_void)
            })
            .collect()
    }
}

pub(super) fn bigint_to_unknown(env: &Env, value: i128) -> anyhow::Result<Unknown<'_>> {
    Ok(BigInt::from(value).into_unknown(env)?)
}

impl Encoder for BigIntCodec {
    fn encode(&self, _env: &Env, value: Unknown<'_>) -> anyhow::Result<ffi::Stash> {
        let int = Self::integer_from_value(value)?;
        self.checked_to_stash(int)
    }

    forward_ffi_encoder!();
}

impl Decoder for BigIntCodec {
    unsafe fn read<'e>(&self, env: &'e Env, ctx: ReadCtx<'_>) -> anyhow::Result<Unknown<'e>> {
        let int = match ctx.source {
            ReadSource::Call(stash) => match stash {
                ffi::Stash::I64(v) => i128::from(*v),
                ffi::Stash::U64(v) => i128::from(*v),
                other => bail!("Expected a 64-bit Stash for {}, got {other:?}", self.name()),
            },
            ReadSource::Value(ptr, _context) => match self {
                Self::I64 => i128::from(ptr as i64),
                Self::U64 => i128::from(ptr as u64),
            },
            ReadSource::Slot(ptr, _context) => unsafe { self.read_i128(ptr.cast()) },
        };
        bigint_to_unknown(env, int)
    }
}

impl PtrWriter for BigIntCodec {
    fn write_return_to_ptr(
        &self,
        env: &Env,
        ret: ffi::Slot,
        value: &std::result::Result<Unknown<'_>, ()>,
    ) {
        let stash = match value {
            Ok(unknown) => Self::integer_from_value(*unknown)
                .and_then(|integer| self.checked_to_stash(integer))
                .unwrap_or_else(|error| {
                    reject_callback_return(*env, &error);
                    self.zero_stash()
                }),
            Err(()) => self.zero_stash(),
        };
        let _ = unsafe { stash.write_scalar_to_ptr(ret.as_ptr()) };
    }

    fn write_value_to_ptr(
        &self,
        _env: &Env,
        slot: ffi::Slot,
        value: Unknown<'_>,
        _init: SlotInit,
    ) -> anyhow::Result<Option<ffi::PendingTransfer>> {
        let int = Self::integer_from_value(value)?;
        let stash = self.checked_to_stash(int)?;
        unsafe { stash.write_scalar_to_ptr(slot.as_ptr()) }?;
        Ok(None)
    }
}

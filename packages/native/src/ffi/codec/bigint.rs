use anyhow::bail;
use libffi::middle as libffi;

use super::prelude::*;

#[derive(Debug, Clone, Copy)]
pub enum BigIntCodec {
    I64,
    U64,
    I64Word,
    U64Word,
}

impl BigIntCodec {
    fn name(self) -> &'static str {
        match self {
            Self::I64 | Self::I64Word => "bigint64",
            Self::U64 | Self::U64Word => "biguint64",
        }
    }

    fn zero_stash(self) -> ffi::Stash {
        match self {
            Self::I64 | Self::I64Word => ffi::Stash::I64(0),
            Self::U64 | Self::U64Word => ffi::Stash::U64(0),
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

    pub(super) fn checked_to_stash(self, value: i128) -> anyhow::Result<ffi::Stash> {
        match self {
            Self::I64 | Self::I64Word => i64::try_from(value).map(ffi::Stash::I64).map_err(|_| {
                anyhow::anyhow!(
                    "Value {value} is out of range for bigint64 [{}, {}]",
                    i64::MIN,
                    i64::MAX
                )
            }),
            Self::U64 | Self::U64Word => u64::try_from(value).map(ffi::Stash::U64).map_err(|_| {
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

    pub(super) unsafe fn read_i128(self, ptr: *const u8) -> i128 {
        unsafe {
            match self {
                Self::I64 | Self::I64Word => i128::from(ptr.cast::<i64>().read_unaligned()),
                Self::U64 | Self::U64Word => i128::from(ptr.cast::<u64>().read_unaligned()),
            }
        }
    }

    /// # Safety
    ///
    /// `ptr` must point at eight initialized, readable bytes.
    pub(crate) unsafe fn read_stash(self, ptr: *const u8) -> ffi::Stash {
        unsafe {
            match self {
                Self::I64 | Self::I64Word => ffi::Stash::I64(ptr.cast::<i64>().read_unaligned()),
                Self::U64 | Self::U64Word => ffi::Stash::U64(ptr.cast::<u64>().read_unaligned()),
            }
        }
    }

    #[must_use]
    pub fn byte_size(self) -> usize {
        size_of::<u64>()
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
            Self::I64 | Self::I64Word => array
                .iter()
                .enumerate()
                .map(|(i, &v)| {
                    i64::try_from(integer_at(i, v)?).map_err(|_| {
                        anyhow::anyhow!("Array element {i}: value out of range for bigint64")
                    })
                })
                .collect::<anyhow::Result<Vec<i64>>>()
                .map(Into::into),
            Self::U64 | Self::U64Word => array
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

    #[must_use]
    pub fn is_direct_word(self) -> bool {
        matches!(self, Self::I64Word | Self::U64Word)
    }

    pub(super) fn pointer_word(self, value: i128) -> anyhow::Result<*mut c_void> {
        if matches!(self, Self::I64Word) {
            let word = isize::try_from(value)
                .map_err(|_| anyhow::anyhow!("Value {value} is not a valid signed pointer word"))?;
            Ok(word as *mut c_void)
        } else {
            let word = usize::try_from(value)
                .map_err(|_| anyhow::anyhow!("Value {value} is not a valid pointer word"))?;
            Ok(word as *mut c_void)
        }
    }

    pub(super) fn encode_pointer_word(self, value: Unknown<'_>) -> anyhow::Result<*mut c_void> {
        let integer = Self::integer_from_value(value)?;
        self.checked_to_stash(integer)?;
        self.pointer_word(integer)
    }

    pub(super) fn to_pointer_words(
        self,
        array: &[Unknown<'_>],
    ) -> anyhow::Result<Vec<*mut c_void>> {
        array
            .iter()
            .enumerate()
            .map(|(i, &v)| {
                let int = Self::integer_from_value(v)
                    .map_err(|e| anyhow::anyhow!("Array element {i}: {e}"))?;
                self.checked_to_stash(int)
                    .map_err(|e| anyhow::anyhow!("Array element {i}: {e}"))?;
                self.pointer_word(int)
                    .map_err(|e| anyhow::anyhow!("Array element {i}: {e}"))
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

    fn libffi_type(&self) -> libffi::Type {
        match self {
            Self::I64 | Self::I64Word => libffi::Type::i64(),
            Self::U64 | Self::U64Word => libffi::Type::u64(),
        }
    }

    fn call_cif(
        &self,
        cif: &libffi::Cif,
        ptr: libffi::CodePtr,
        args: &[libffi::Arg<'_>],
    ) -> anyhow::Result<ffi::Stash> {
        Ok(unsafe {
            match self {
                Self::I64 | Self::I64Word => ffi::Stash::I64(cif.call::<i64>(ptr, args)),
                Self::U64 | Self::U64Word => ffi::Stash::U64(cif.call::<u64>(ptr, args)),
            }
        })
    }
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
                Self::I64 | Self::I64Word => i128::from(ptr as i64),
                Self::U64 | Self::U64Word => i128::from(ptr as u64),
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

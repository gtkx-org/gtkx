use napi::bindgen_prelude::Unknown;
use napi::{Env, ValueType};

use crate::ffi::codec::{
    Decoder, Encoder, IntegerBacked, IntegerCodec, PtrWriter, ReadCtx, SlotInit,
    forward_ffi_encoder,
};
use crate::ffi::{self};
use crate::value;

#[allow(clippy::cast_possible_truncation)]
fn enum_member_from_f64(n: f64) -> anyhow::Result<i32> {
    IntegerCodec::I32.check_range(n)?;

    Ok(n as i32)
}

#[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
fn flags_bits_from_f64(storage: IntegerCodec, n: f64) -> anyhow::Result<u32> {
    storage.check_range(n)?;

    Ok(n as i64 as u32)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EnumFlagsKind {
    Enum,
    Flags,
}

#[derive(Debug, Clone)]
pub struct EnumFlagsCodec {
    pub kind: EnumFlagsKind,
    pub shared_library: String,
    pub get_type_fn_name: String,
    pub storage: IntegerCodec,
    pub mask: Option<u32>,
}

impl IntegerBacked for EnumFlagsCodec {
    fn ffi_codec(&self) -> IntegerCodec {
        self.storage
    }
}

impl EnumFlagsCodec {
    fn resolve_type(&self) -> anyhow::Result<glib::Type> {
        ffi::library_cache::FfiCache::with(|state| {
            state.resolve_type(&self.shared_library, &self.get_type_fn_name)
        })
    }

    fn validate_enum_value(&self, value: i32) -> anyhow::Result<()> {
        let type_ = self.resolve_type()?;
        let enum_class = glib::EnumClass::with_type(type_).ok_or_else(|| {
            anyhow::anyhow!(
                "{} (Type {type_}) is not an enumeration type",
                self.get_type_fn_name
            )
        })?;
        if enum_class.value(value).is_none() {
            anyhow::bail!(
                "Enum value {value} is not a valid member of {} (Type {type_})",
                self.get_type_fn_name
            );
        }
        Ok(())
    }

    fn flags_mask(&self) -> anyhow::Result<Option<u32>> {
        if self.get_type_fn_name.is_empty() {
            return Ok(self.mask);
        }
        let type_ = self.resolve_type()?;

        ffi::library_cache::FfiCache::with(|state| state.flags_mask(type_, &self.get_type_fn_name))
            .map(Some)
    }

    fn validate_flags_value(&self, bits: u32) -> anyhow::Result<()> {
        let Some(mask) = self.flags_mask()? else {
            return Ok(());
        };
        if bits & mask != bits {
            let name = if self.get_type_fn_name.is_empty() {
                "the flags type"
            } else {
                self.get_type_fn_name.as_str()
            };
            anyhow::bail!(
                "Flags value 0x{bits:x} contains bits that are not valid for {name} (mask 0x{mask:x})"
            );
        }
        Ok(())
    }
}

impl EnumFlagsCodec {
    fn validate(&self, value: Unknown<'_>) -> anyhow::Result<()> {
        if !matches!(value.get_type()?, ValueType::Number) {
            return Ok(());
        }
        let n = value::read_napi::<f64>(value)?;

        match self.kind {
            EnumFlagsKind::Enum => self.validate_enum_value(enum_member_from_f64(n)?),
            EnumFlagsKind::Flags => {
                self.validate_flags_value(flags_bits_from_f64(self.storage, n)?)
            }
        }
    }
}

impl Encoder for EnumFlagsCodec {
    fn encode(&self, env: &Env, value: Unknown<'_>) -> anyhow::Result<ffi::Stash> {
        self.validate(value)?;

        Encoder::encode(&self.storage, env, value)
    }

    forward_ffi_encoder!();
}

impl Decoder for EnumFlagsCodec {
    unsafe fn read<'e>(&self, env: &'e Env, ctx: ReadCtx<'_>) -> anyhow::Result<Unknown<'e>> {
        unsafe { self.storage.read(env, ctx) }
    }
}

impl PtrWriter for EnumFlagsCodec {
    fn write_return_to_ptr(&self, env: &Env, ret: ffi::Slot, value: &Result<Unknown<'_>, ()>) {
        PtrWriter::write_return_to_ptr(&self.storage, env, ret, value);
    }

    fn write_value_to_ptr(
        &self,
        env: &Env,
        slot: ffi::Slot,
        value: Unknown<'_>,
        init: SlotInit,
    ) -> anyhow::Result<Option<ffi::PendingTransfer>> {
        self.validate(value)?;

        PtrWriter::write_value_to_ptr(&self.storage, env, slot, value, init)
    }
}

use crate::ffi::{
    self,
    codec::{Decoder, Encoder, IntegerCodec, PtrWriter, ReadSource, forward_ffi_encoder},
    value,
};

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
}

impl EnumFlagsCodec {
    fn ffi_codec(&self) -> IntegerCodec {
        self.storage
    }

    fn resolve_type(&self) -> anyhow::Result<glib::Type> {
        crate::ffi::library_cache::GlibThreadState::with(|state| {
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
}

impl Encoder for EnumFlagsCodec {
    fn encode(&self, value: &value::Value) -> anyhow::Result<ffi::Stash> {
        if self.kind == EnumFlagsKind::Enum
            && let value::Value::Number(n) = value
        {
            self.validate_enum_value(*n as i32)?;
        }
        Encoder::encode(&self.storage, value)
    }

    forward_ffi_encoder!();
}

impl Decoder for EnumFlagsCodec {
    unsafe fn read(&self, src: ReadSource<'_>) -> anyhow::Result<value::Value> {
        unsafe { self.storage.read(src) }
    }
}

impl PtrWriter for EnumFlagsCodec {
    fn write_return_to_ptr(&self, ret: ffi::Slot, value: &Result<value::Value, ()>) {
        PtrWriter::write_return_to_ptr(&self.storage, ret, value);
    }

    fn write_value_to_ptr(&self, slot: ffi::Slot, value: &value::Value) -> anyhow::Result<()> {
        PtrWriter::write_value_to_ptr(&self.storage, slot, value)
    }
}

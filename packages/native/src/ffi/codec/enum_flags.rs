use std::ffi::c_void;

use crate::ffi::{
    self,
    codec::{Decoder, Encoder, IntegerCodec, PtrWriter, ReadSource},
    value,
};
use libffi::middle as libffi;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EnumFlagsKind {
    Enum,
    Flags,
}

#[derive(Debug, Clone)]
pub struct EnumFlagsCodec {
    pub kind: EnumFlagsKind,
    pub shared_library: String,
    pub get_type_fn: String,
    pub storage: IntegerCodec,
}

impl EnumFlagsCodec {
    fn wire_codec(&self) -> IntegerCodec {
        self.storage
    }

    fn resolve_gtype(&self) -> anyhow::Result<glib::Type> {
        crate::ffi::library_cache::GlibThreadState::with(|state| {
            state.resolve_gtype(&self.shared_library, &self.get_type_fn)
        })
    }

    fn validate_enum_value(&self, value: i32) {
        let Ok(gtype) = self.resolve_gtype() else {
            return;
        };
        let Some(enum_class) = glib::EnumClass::with_type(gtype) else {
            return;
        };
        if enum_class.value(value).is_none() {
            crate::messaging::error_reporter::ErrorReporter::global().report_str(&format!(
                "Enum value {value} is not a valid member of {} (GType {gtype})",
                self.get_type_fn
            ));
        }
    }
}

impl Encoder for EnumFlagsCodec {
    fn encode(&self, value: &value::Value) -> anyhow::Result<ffi::StashedValue> {
        let result = Encoder::encode(&self.storage, value)?;
        if self.kind == EnumFlagsKind::Enum
            && let value::Value::Number(n) = value
        {
            self.validate_enum_value(*n as i32);
        }
        Ok(result)
    }

    fn libffi_type(&self) -> libffi::Type {
        Encoder::libffi_type(&self.wire_codec())
    }

    fn call_cif(
        &self,
        cif: &libffi::Cif,
        ptr: libffi::CodePtr,
        args: &[libffi::Arg],
    ) -> anyhow::Result<ffi::StashedValue> {
        Encoder::call_cif(&self.wire_codec(), cif, ptr, args)
    }
}

impl Decoder for EnumFlagsCodec {
    unsafe fn read(&self, src: ReadSource<'_>) -> anyhow::Result<value::Value> {
        match src {
            ReadSource::Call(stashed_value) => Decoder::decode(&self.storage, stashed_value),
            ReadSource::Value(ptr, context) => self.storage.ptr_to_value_raw(ptr, context),
            ReadSource::Slot(ptr, _context) => Ok(value::Value::Number(unsafe {
                self.storage.read_ptr(ptr as *const u8)
            })),
        }
    }
}

impl PtrWriter for EnumFlagsCodec {
    unsafe fn write_return_to_ptr(&self, ret: *mut c_void, value: &Result<value::Value, ()>) {
        unsafe { PtrWriter::write_return_to_ptr(&self.storage, ret, value) };
    }

    unsafe fn write_value_to_ptr(
        &self,
        ptr: *mut c_void,
        value: &value::Value,
    ) -> anyhow::Result<()> {
        unsafe { PtrWriter::write_value_to_ptr(&self.storage, ptr, value) }
    }
}

use glib::translate::IntoGlib as _;
use libffi::middle as libffi;

use super::prelude::*;

#[derive(Debug, Clone, Copy)]
pub struct BooleanType;

impl FfiEncoder for BooleanType {
    fn encode(&self, value: &value::Value) -> anyhow::Result<ffi::FfiValue> {
        let boolean = match value {
            value::Value::Boolean(b) => *b,
            _ => anyhow::bail!("Expected a Boolean for boolean type, got {value:?}"),
        };
        Ok(ffi::FfiValue::I32(boolean.into_glib()))
    }

    fn libffi_type(&self) -> libffi::Type {
        libffi::Type::i32()
    }

    fn call_cif(
        &self,
        cif: &libffi::Cif,
        ptr: libffi::CodePtr,
        args: &[libffi::Arg],
    ) -> anyhow::Result<ffi::FfiValue> {
        // SAFETY: The dispatch site built `cif` and `args` for this
        // descriptor and resolved `ptr` from a loaded library symbol.
        Ok(ffi::FfiValue::I32(unsafe { cif.call::<i32>(ptr, args) }))
    }
}

impl FfiDecoder for BooleanType {
    unsafe fn read(&self, src: ReadSource<'_>) -> anyhow::Result<value::Value> {
        match src {
            ReadSource::Call(ffi_value) => {
                let b = match ffi_value {
                    ffi::FfiValue::I32(v) => *v != 0,
                    _ => anyhow::bail!("Expected a boolean ffi::FfiValue, got {ffi_value:?}"),
                };
                Ok(value::Value::Boolean(b))
            }
            ReadSource::Value(ptr, _context) => Ok(value::Value::Boolean(ptr as isize != 0)),
            ReadSource::Slot(ptr, _context) => {
                // SAFETY: The caller guarantees `ptr` is a readable `gboolean`
                // (i32) slot.
                let val = unsafe { *(ptr as *const i32) };
                Ok(value::Value::Boolean(val != 0))
            }
        }
    }
}

impl RawPtrCodec for BooleanType {
    /// Writes a `gboolean` trampoline return widened to `ffi_sarg`, per
    /// libffi's closure contract for integral results narrower than a
    /// register.
    unsafe fn write_return_to_raw_ptr(&self, ret: *mut c_void, value: &Result<value::Value, ()>) {
        let val = matches!(value, Ok(value::Value::Boolean(true)));
        // SAFETY: The caller guarantees `ret` is a writable 8-byte libffi
        // return slot; the write is unaligned-tolerant.
        unsafe { ret.cast::<i64>().write_unaligned(i64::from(val)) };
    }

    unsafe fn write_value_to_raw_ptr(
        &self,
        ptr: *mut c_void,
        value: &value::Value,
    ) -> anyhow::Result<()> {
        let value::Value::Boolean(b) = value else {
            anyhow::bail!("Expected a Boolean for boolean field write, got {value:?}");
        };
        // SAFETY: The caller guarantees `ptr` is a writable `gboolean`
        // (i32) slot.
        unsafe { *(ptr as *mut i32) = (*b).into_glib() };
        Ok(())
    }
}

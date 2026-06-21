use glib::translate::IntoGlib as _;
use libffi::middle as libffi;

use super::numeric::IntegerKind;
use super::prelude::*;

const WIRE_KIND: IntegerKind = IntegerKind::I32;

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
        FfiEncoder::libffi_type(&WIRE_KIND)
    }

    fn call_cif(
        &self,
        cif: &libffi::Cif,
        ptr: libffi::CodePtr,
        args: &[libffi::Arg],
    ) -> anyhow::Result<ffi::FfiValue> {
        FfiEncoder::call_cif(&WIRE_KIND, cif, ptr, args)
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
                // SAFETY: a `Slot` source carries a pointer to an `i32`-sized, readable, properly
                // aligned location holding the gboolean value; reading it yields that boolean.
                let val = unsafe { *(ptr as *const i32) };
                Ok(value::Value::Boolean(val != 0))
            }
        }
    }
}

impl RawPtrCodec for BooleanType {
    unsafe fn write_return_to_raw_ptr(&self, ret: *mut c_void, value: &Result<value::Value, ()>) {
        let val = f64::from(u8::from(matches!(value, Ok(value::Value::Boolean(true)))));
        // SAFETY: `ret` is a marshalling-provided return slot sized for this boolean's wire kind
        // (`i32`); `write_return_widened` writes the widened value into it for that kind.
        unsafe { WIRE_KIND.write_return_widened(ret, val) };
    }

    unsafe fn write_value_to_raw_ptr(
        &self,
        ptr: *mut c_void,
        value: &value::Value,
    ) -> anyhow::Result<()> {
        let value::Value::Boolean(b) = value else {
            anyhow::bail!("Expected a Boolean for boolean field write, got {value:?}");
        };
        // SAFETY: `ptr` is a marshalling-provided field slot for an `i32`-sized, properly aligned
        // gboolean; the store writes the encoded boolean into it.
        unsafe { *(ptr as *mut i32) = (*b).into_glib() };
        Ok(())
    }
}

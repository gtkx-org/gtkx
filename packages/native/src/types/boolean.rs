use std::ffi::c_void;

use libffi::middle as libffi;

use super::{FfiDecoder, FfiEncoder, GlibValueCodec, RawPtrCodec};
use crate::{ffi, value};

#[derive(Debug, Clone, Copy)]
pub struct BooleanType;

impl FfiEncoder for BooleanType {
    fn encode(&self, value: &value::Value, _optional: bool) -> anyhow::Result<ffi::FfiValue> {
        let boolean = match value {
            value::Value::Boolean(b) => *b,
            _ => anyhow::bail!("Expected a Boolean for boolean type, got {:?}", value),
        };
        Ok(ffi::FfiValue::I32(i32::from(boolean)))
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
        Ok(ffi::FfiValue::I32(unsafe { cif.call::<i32>(ptr, args) }))
    }
}

impl FfiDecoder for BooleanType {
    fn decode(&self, ffi_value: &ffi::FfiValue) -> anyhow::Result<value::Value> {
        let b = match ffi_value {
            ffi::FfiValue::I32(v) => *v != 0,
            _ => anyhow::bail!("Expected a boolean ffi::FfiValue, got {:?}", ffi_value),
        };
        Ok(value::Value::Boolean(b))
    }
}

impl RawPtrCodec for BooleanType {
    fn ptr_to_value(&self, ptr: *mut c_void, _context: &str) -> anyhow::Result<value::Value> {
        Ok(value::Value::Boolean(ptr as isize != 0))
    }

    fn read_from_raw_ptr(
        &self,
        ptr: *const c_void,
        _context: &str,
    ) -> anyhow::Result<value::Value> {
        let val = unsafe { *(ptr as *const i32) };
        Ok(value::Value::Boolean(val != 0))
    }

    fn write_return_to_raw_ptr(&self, ret: *mut c_void, value: &Result<value::Value, ()>) {
        let val = matches!(value, Ok(value::Value::Boolean(true)));
        unsafe { *(ret as *mut i32) = val as i32 };
    }

    fn write_value_to_raw_ptr(&self, ptr: *mut c_void, value: &value::Value) -> anyhow::Result<()> {
        let value::Value::Boolean(b) = value else {
            anyhow::bail!(
                "Expected a Boolean for boolean field write, got {:?}",
                value
            );
        };
        unsafe { *(ptr as *mut i32) = i32::from(*b) };
        Ok(())
    }
}

impl GlibValueCodec for BooleanType {
    fn to_glib_value(&self, val: &value::Value) -> anyhow::Result<Option<gtk4::glib::Value>> {
        let value::Value::Boolean(b) = val else {
            return Ok(None);
        };
        Ok(Some((*b).into()))
    }

    fn from_glib_value(&self, gvalue: &gtk4::glib::Value) -> anyhow::Result<value::Value> {
        let boolean: bool = gvalue
            .get()
            .map_err(|e| anyhow::anyhow!("Failed to get bool from GValue: {}", e))?;
        Ok(value::Value::Boolean(boolean))
    }
}

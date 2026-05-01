use std::ffi::c_void;

use libffi::middle as libffi;

use super::numeric::IntegerKind;
use super::{FfiDecoder, FfiEncoder, GlibValueCodec, RawPtrCodec};
use crate::{ffi, value};

#[derive(Debug, Clone, Copy)]
pub struct UnicharType;

impl FfiEncoder for UnicharType {
    fn encode(&self, value: &value::Value, optional: bool) -> anyhow::Result<ffi::FfiValue> {
        let cp = match value {
            value::Value::String(s) => s.chars().next().map_or(0, |c| c as u32),
            value::Value::Number(n) => *n as u32,
            value::Value::Null | value::Value::Undefined if optional => 0,
            _ => anyhow::bail!("Expected a string for unichar type, got {value:?}"),
        };
        Ok(ffi::FfiValue::U32(cp))
    }

    fn libffi_type(&self) -> libffi::Type {
        libffi::Type::u32()
    }

    fn call_cif(
        &self,
        cif: &libffi::Cif,
        ptr: libffi::CodePtr,
        args: &[libffi::Arg],
    ) -> anyhow::Result<ffi::FfiValue> {
        IntegerKind::U32.call_cif(cif, ptr, args)
    }
}

impl FfiDecoder for UnicharType {
    fn decode(&self, ffi_value: &ffi::FfiValue) -> anyhow::Result<value::Value> {
        let cp = match ffi_value {
            ffi::FfiValue::U32(v) => *v,
            _ => anyhow::bail!("Expected FfiValue::U32 for unichar, got {ffi_value:?}"),
        };
        let ch = char::from_u32(cp)
            .ok_or_else(|| anyhow::anyhow!("Invalid Unicode codepoint: 0x{cp:X}"))?;
        Ok(value::Value::String(ch.to_string()))
    }
}

impl RawPtrCodec for UnicharType {
    fn ptr_to_value(&self, ptr: *mut c_void, _context: &str) -> anyhow::Result<value::Value> {
        let cp = ptr as usize as u32;
        let ch = char::from_u32(cp).unwrap_or('\u{FFFD}');
        Ok(value::Value::String(ch.to_string()))
    }

    fn read_from_raw_ptr(
        &self,
        ptr: *const c_void,
        _context: &str,
    ) -> anyhow::Result<value::Value> {
        let val = unsafe { *(ptr as *const u32) };
        let ch = char::from_u32(val).unwrap_or('\u{FFFD}');
        Ok(value::Value::String(ch.to_string()))
    }

    fn write_return_to_raw_ptr(&self, ret: *mut c_void, value: &Result<value::Value, ()>) {
        let val = match value {
            Ok(value::Value::String(s)) => s.chars().next().map_or(0, |c| c as u32),
            Ok(value::Value::Number(n)) => *n as u32,
            _ => 0,
        };
        unsafe { *(ret as *mut u32) = val };
    }
}

impl GlibValueCodec for UnicharType {}

use libffi::middle as libffi;

use super::numeric::IntegerKind;
use super::prelude::*;

#[derive(Debug, Clone, Copy)]
pub struct UnicharType;

impl FfiEncoder for UnicharType {
    fn encode(&self, value: &value::Value) -> anyhow::Result<ffi::FfiValue> {
        let cp = match value {
            value::Value::String(s) => s.chars().next().map_or(0, |c| c as u32),
            value::Value::Number(n) => *n as u32,
            value::Value::Null | value::Value::Undefined => 0,
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
    unsafe fn read(&self, src: ReadSource<'_>) -> anyhow::Result<value::Value> {
        match src {
            ReadSource::Call(ffi_value) => {
                let cp = match ffi_value {
                    ffi::FfiValue::U32(v) => *v,
                    _ => anyhow::bail!("Expected FfiValue::U32 for unichar, got {ffi_value:?}"),
                };
                let ch = char::from_u32(cp)
                    .ok_or_else(|| anyhow::anyhow!("Invalid Unicode codepoint: 0x{cp:X}"))?;
                Ok(value::Value::String(ch.to_string()))
            }
            ReadSource::Value(ptr, _context) => {
                let cp = ptr as usize as u32;
                let ch = char::from_u32(cp).unwrap_or('\u{FFFD}');
                Ok(value::Value::String(ch.to_string()))
            }
            ReadSource::Slot(ptr, _context) => {
                // SAFETY: a `Slot` source carries a pointer to a `u32`-sized, readable, properly
                // aligned location holding the gunichar codepoint; reading it yields that codepoint.
                let val = unsafe { *(ptr as *const u32) };
                let ch = char::from_u32(val).unwrap_or('\u{FFFD}');
                Ok(value::Value::String(ch.to_string()))
            }
        }
    }
}

impl RawPtrCodec for UnicharType {
    unsafe fn write_return_to_raw_ptr(&self, ret: *mut c_void, value: &Result<value::Value, ()>) {
        let val = match value {
            Ok(value::Value::String(s)) => s.chars().next().map_or(0, |c| c as u32),
            Ok(value::Value::Number(n)) => *n as u32,
            _ => 0,
        };
        // SAFETY: `ret` is a marshalling-provided return slot sized for a gunichar's `u32` wire kind;
        // `write_return_widened` writes the widened codepoint into it for that kind.
        unsafe { IntegerKind::U32.write_return_widened(ret, f64::from(val)) };
    }
}

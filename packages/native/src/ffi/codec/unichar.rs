use libffi::middle as libffi;

use super::numeric::IntegerCodec;
use super::prelude::*;

#[derive(Debug, Clone, Copy)]
pub struct UnicharCodec;

impl Encoder for UnicharCodec {
    fn encode(&self, value: &value::Value) -> anyhow::Result<ffi::StashedValue> {
        let cp = match value {
            value::Value::String(s) => s.chars().next().map_or(0, |c| c as u32),
            value::Value::Number(n) => *n as u32,
            value::Value::Null | value::Value::Undefined => 0,
            _ => anyhow::bail!("Expected a string for unichar codec, got {value:?}"),
        };
        Ok(ffi::StashedValue::U32(cp))
    }

    fn libffi_type(&self) -> libffi::Type {
        libffi::Type::u32()
    }

    fn call_cif(
        &self,
        cif: &libffi::Cif,
        ptr: libffi::CodePtr,
        args: &[libffi::Arg],
    ) -> anyhow::Result<ffi::StashedValue> {
        IntegerCodec::U32.call_cif(cif, ptr, args)
    }
}

impl Decoder for UnicharCodec {
    unsafe fn read(&self, src: ReadSource<'_>) -> anyhow::Result<value::Value> {
        match src {
            ReadSource::Call(stashed_value) => {
                let cp = match stashed_value {
                    ffi::StashedValue::U32(v) => *v,
                    _ => anyhow::bail!(
                        "Expected StashedValue::U32 for unichar, got {stashed_value:?}"
                    ),
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
                let val = unsafe { *(ptr as *const u32) };
                let ch = char::from_u32(val).unwrap_or('\u{FFFD}');
                Ok(value::Value::String(ch.to_string()))
            }
        }
    }
}

impl PointerWriter for UnicharCodec {
    unsafe fn write_return_to_pointer(&self, ret: *mut c_void, value: &Result<value::Value, ()>) {
        let val = match value {
            Ok(value::Value::String(s)) => s.chars().next().map_or(0, |c| c as u32),
            Ok(value::Value::Number(n)) => *n as u32,
            _ => 0,
        };
        unsafe { IntegerCodec::U32.write_return_widened(ret, f64::from(val)) };
    }
}

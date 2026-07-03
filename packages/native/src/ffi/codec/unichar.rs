use super::forward_ffi_encoder;
use super::numeric::IntegerCodec;
use super::prelude::*;

#[derive(Debug, Clone, Copy)]
pub struct UnicharCodec;

impl UnicharCodec {
    fn ffi_codec(&self) -> IntegerCodec {
        IntegerCodec::U32
    }
}

impl Encoder for UnicharCodec {
    fn encode(&self, value: &value::Value) -> anyhow::Result<ffi::Stash> {
        let cp = match value {
            value::Value::String(s) => s.chars().next().map_or(0, |c| c as u32),
            value::Value::Number(n) => *n as u32,
            value::Value::Null | value::Value::Undefined => 0,
            _ => bail_expected!("a String", "unichar", value),
        };
        Ok(ffi::Stash::U32(cp))
    }

    forward_ffi_encoder!();
}

impl Decoder for UnicharCodec {
    unsafe fn read(&self, src: ReadSource<'_>) -> anyhow::Result<value::Value> {
        match src {
            ReadSource::Call(stash) => {
                let cp = match stash {
                    ffi::Stash::U32(v) => *v,
                    _ => anyhow::bail!("Expected Stash::U32 for unichar, got {stash:?}"),
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
                let cp = unsafe { *(ptr as *const u32) };
                let ch = char::from_u32(cp).unwrap_or('\u{FFFD}');
                Ok(value::Value::String(ch.to_string()))
            }
        }
    }
}

impl PtrWriter for UnicharCodec {
    fn write_return_to_ptr(&self, ret: ffi::Slot, value: &Result<value::Value, ()>) {
        let cp = match value {
            Ok(value::Value::String(s)) => s.chars().next().map_or(0, |c| c as u32),
            Ok(value::Value::Number(n)) => *n as u32,
            _ => 0,
        };
        unsafe { IntegerCodec::U32.write_return_widened(ret.as_ptr(), f64::from(cp)) };
    }
}

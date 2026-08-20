use anyhow::bail;

use super::forward_ffi_encoder;
use super::numeric::IntegerCodec;
use super::prelude::*;

#[derive(Debug, Clone, Copy)]
pub struct UnicharCodec;

impl IntegerBacked for UnicharCodec {
    fn ffi_codec(&self) -> IntegerCodec {
        IntegerCodec::U32
    }
}

#[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
fn checked_codepoint(n: f64) -> anyhow::Result<u32> {
    if n.fract() != 0.0 || !(0.0..=f64::from(char::MAX as u32)).contains(&n) {
        bail!("Invalid Unicode codepoint: {n}");
    }
    let cp = n as u32;
    if char::from_u32(cp).is_none() {
        bail!("Invalid Unicode codepoint: 0x{cp:X}");
    }
    Ok(cp)
}

#[allow(clippy::cast_possible_truncation)]
fn codepoint_from_inline_ptr(ptr: *mut c_void) -> u32 {
    ptr.addr() as u32
}

pub(super) fn codepoint_from_value(value: Unknown<'_>) -> anyhow::Result<u32> {
    match value.get_type()? {
        ValueType::String => {
            let s = value::read_napi::<String>(value)?;
            let mut chars = s.chars();
            let Some(ch) = chars.next() else {
                return Ok(0);
            };
            if chars.next().is_some() {
                bail!("Expected a single-character string for unichar codec, got {s:?}");
            }
            Ok(ch as u32)
        }
        ValueType::Number => checked_codepoint(value::read_napi::<f64>(value)?),
        ValueType::Null | ValueType::Undefined => Ok(0),
        other => bail_expected!(format!("a String, got {other:?}"), "unichar"),
    }
}

impl Encoder for UnicharCodec {
    fn encode(&self, _env: &Env, value: Unknown<'_>) -> anyhow::Result<ffi::Stash> {
        Ok(ffi::Stash::U32(codepoint_from_value(value)?))
    }

    forward_ffi_encoder!();
}

impl Decoder for UnicharCodec {
    unsafe fn read<'e>(&self, env: &'e Env, ctx: ReadCtx<'_>) -> anyhow::Result<Unknown<'e>> {
        let ch = match ctx.source {
            ReadSource::Call(stash) => {
                let cp = match stash {
                    ffi::Stash::U32(v) => *v,
                    _ => anyhow::bail!("Expected Stash::U32 for unichar, got {stash:?}"),
                };
                char::from_u32(cp)
                    .ok_or_else(|| anyhow::anyhow!("Invalid Unicode codepoint: 0x{cp:X}"))?
            }
            ReadSource::Value(ptr, _context) => {
                let cp = codepoint_from_inline_ptr(ptr);
                char::from_u32(cp).unwrap_or('\u{FFFD}')
            }
            ReadSource::Slot(ptr, _context) => {
                let cp = unsafe { ptr.cast::<u32>().read_unaligned() };
                char::from_u32(cp).unwrap_or('\u{FFFD}')
            }
        };
        Ok(ch.to_string().into_unknown(env)?)
    }
}

impl PtrWriter for UnicharCodec {
    fn write_return_to_ptr(
        &self,
        _env: &Env,
        ret: ffi::Slot,
        value: &std::result::Result<Unknown<'_>, ()>,
    ) {
        let cp = match value {
            Ok(unknown) => codepoint_from_value(*unknown).unwrap_or(0),
            Err(()) => 0,
        };
        unsafe { IntegerCodec::U32.write_return_widened(ret.as_ptr(), f64::from(cp)) };
    }
}

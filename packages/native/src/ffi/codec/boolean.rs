use glib::translate::IntoGlib as _;

use super::forward_ffi_encoder;
use super::numeric::IntegerCodec;
use super::prelude::*;

const FFI_CODEC: IntegerCodec = IntegerCodec::I32;

#[derive(Debug, Clone, Copy)]
pub struct BooleanCodec;

impl BooleanCodec {
    fn ffi_codec(&self) -> IntegerCodec {
        FFI_CODEC
    }
}

fn read_bool(env: &Env, value: Unknown<'_>) -> anyhow::Result<bool> {
    match value.get_type()? {
        ValueType::Boolean => Ok(value::read_napi::<bool>(env, value)?),
        _ => bail_expected!("a Boolean", "boolean"),
    }
}

impl Encoder for BooleanCodec {
    fn encode(&self, env: &Env, value: Unknown<'_>) -> anyhow::Result<ffi::Stash> {
        let boolean = read_bool(env, value)?;
        Ok(ffi::Stash::I32(boolean.into_glib()))
    }

    forward_ffi_encoder!();
}

impl Decoder for BooleanCodec {
    unsafe fn read<'e>(&self, env: &'e Env, src: ReadSource<'_>) -> anyhow::Result<Unknown<'e>> {
        let b = match src {
            ReadSource::Call(stash) => match stash {
                ffi::Stash::I32(value) => *value != 0,
                _ => anyhow::bail!("Expected a boolean ffi::Stash, got {stash:?}"),
            },
            ReadSource::Value(ptr, _context) => ptr as isize != 0,
            ReadSource::Slot(ptr, _context) => unsafe { *(ptr as *const i32) != 0 },
        };
        Ok(b.into_unknown(env)?)
    }
}

impl PtrWriter for BooleanCodec {
    fn write_return_to_ptr(
        &self,
        env: &Env,
        ret: ffi::Slot,
        value: &std::result::Result<Unknown<'_>, ()>,
    ) {
        let b = match value {
            Ok(unknown) => read_bool(env, *unknown).unwrap_or(false),
            Err(()) => false,
        };
        let val = f64::from(u8::from(b));
        unsafe { FFI_CODEC.write_return_widened(ret.as_ptr(), val) };
    }

    fn write_value_to_ptr(
        &self,
        env: &Env,
        slot: ffi::Slot,
        value: Unknown<'_>,
    ) -> anyhow::Result<()> {
        let b = read_bool(env, value)?;
        unsafe { *(slot.as_ptr() as *mut i32) = b.into_glib() };
        Ok(())
    }
}

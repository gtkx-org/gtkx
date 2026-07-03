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

impl Encoder for BooleanCodec {
    fn encode(&self, value: &value::Value) -> anyhow::Result<ffi::Stash> {
        let boolean = match value {
            value::Value::Boolean(b) => *b,
            _ => bail_expected!("a Boolean", "boolean", value),
        };
        Ok(ffi::Stash::I32(boolean.into_glib()))
    }

    forward_ffi_encoder!();
}

impl Decoder for BooleanCodec {
    unsafe fn read(&self, src: ReadSource<'_>) -> anyhow::Result<value::Value> {
        match src {
            ReadSource::Call(stash) => {
                let b = match stash {
                    ffi::Stash::I32(value) => *value != 0,
                    _ => {
                        anyhow::bail!("Expected a boolean ffi::Stash, got {stash:?}")
                    }
                };
                Ok(value::Value::Boolean(b))
            }
            ReadSource::Value(ptr, _context) => Ok(value::Value::Boolean(ptr as isize != 0)),
            ReadSource::Slot(ptr, _context) => {
                let val = unsafe { *(ptr as *const i32) };
                Ok(value::Value::Boolean(val != 0))
            }
        }
    }
}

impl PtrWriter for BooleanCodec {
    fn write_return_to_ptr(&self, ret: ffi::Slot, value: &Result<value::Value, ()>) {
        let val = f64::from(u8::from(matches!(value, Ok(value::Value::Boolean(true)))));
        unsafe { FFI_CODEC.write_return_widened(ret.as_ptr(), val) };
    }

    fn write_value_to_ptr(&self, slot: ffi::Slot, value: &value::Value) -> anyhow::Result<()> {
        let value::Value::Boolean(b) = value else {
            anyhow::bail!("Expected a Boolean for boolean field write, got {value:?}");
        };
        unsafe { *(slot.as_ptr() as *mut i32) = (*b).into_glib() };
        Ok(())
    }
}

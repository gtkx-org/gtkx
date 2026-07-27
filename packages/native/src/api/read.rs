use std::ffi::c_void;

use napi::Env;
use napi::bindgen_prelude::*;
use napi_derive::napi;

use crate::api::{byte_count_from_f64, native_result};
use crate::ffi::codec::{Codec, Decoder as _, ReadSource};
use crate::ffi::descriptor::Descriptor;
use crate::handle::Handle;

fn read_field<'e>(
    env: &'e Env,
    field_ptr: *const c_void,
    field_codec: &Codec,
) -> anyhow::Result<Unknown<'e>> {
    unsafe { field_codec.read(env, ReadSource::Slot(field_ptr, "field read")) }
}

/// Reads and decodes a value at `offset` bytes into the handle's memory, using `fieldDescriptor`
/// to interpret the raw bytes.
#[napi(catch_unwind)]
pub fn read<'env>(
    env: &'env Env,
    handle: &External<Handle>,
    field_descriptor: Descriptor,
    offset: f64,
) -> Result<Unknown<'env>> {
    let offset = byte_count_from_f64(offset, "field read: offset")?;

    let field_ptr = handle.as_ptr().wrapping_byte_add(offset).cast_const();
    let field_codec = field_descriptor.into_codec()?;
    native_result("field read", read_field(env, field_ptr, &field_codec))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ffi::codec::{FloatCodec, IntegerCodec};
    use test_support::napi_mock;

    #[test]
    fn reads_an_integer_field() {
        test_support::run(|| {
            let env = napi_mock::fake_env();
            let slot: i32 = 42;
            let value = read_field(
                &env,
                (&raw const slot).cast(),
                &Codec::Integer(IntegerCodec::I32),
            )
            .expect("read should succeed");
            assert_eq!(napi_mock::read_double(value.raw()), Some(42.0));
        });
    }

    #[test]
    fn reads_a_float_field() {
        test_support::run(|| {
            let env = napi_mock::fake_env();
            let slot: f64 = 2.5;
            let value = read_field(
                &env,
                (&raw const slot).cast(),
                &Codec::Float(FloatCodec::F64),
            )
            .expect("read should succeed");
            assert_eq!(napi_mock::read_double(value.raw()), Some(2.5));
        });
    }
}

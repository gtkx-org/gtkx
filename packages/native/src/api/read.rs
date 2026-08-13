use std::ffi::c_void;

use napi::Env;
use napi::bindgen_prelude::*;
use napi_derive::napi;

use crate::api::{byte_count_from_f64, handle_memory_ptr, native_result};
use crate::ffi::codec::{Codec, Decoder as _, ReadCtx};
use crate::ffi::descriptor::Descriptor;
use crate::handle::Handle;
use crate::value;

fn read_field<'e>(
    env: &'e Env,
    field_ptr: *const c_void,
    field_codec: &Codec,
) -> anyhow::Result<Unknown<'e>> {
    unsafe { field_codec.read(env, ReadCtx::slot(field_ptr, "field read")) }
}

/// Reads and decodes a value at `offset` bytes into the handle's memory, using `fieldDescriptor`
/// to interpret the raw bytes, and rejects a handle that points at nothing rather than reading at
/// the bare offset. A value the descriptor marks as stored inline decodes to a handle aliasing the
/// owner's memory, so writing one of its own fields reaches the owner.
#[napi(catch_unwind)]
pub fn read<'env>(
    env: &'env Env,
    handle: &External<Handle>,
    field_descriptor: Descriptor,
    offset: f64,
) -> Result<Unknown<'env>> {
    let offset = byte_count_from_f64(offset, "field read: offset")?;
    let base_ptr = handle_memory_ptr(handle, "field read")?;
    let field_codec = field_descriptor.into_codec()?;

    if field_codec.is_inline() {
        return value::handle_to_unknown(env, Handle::field(handle, offset));
    }

    let field_ptr = base_ptr.wrapping_byte_add(offset).cast_const();

    native_result("field read", read_field(env, field_ptr, &field_codec))
}

#[cfg(test)]
mod tests {
    use test_support::napi_mock;

    use super::*;
    use crate::ffi::codec::{FloatCodec, IntegerCodec};

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

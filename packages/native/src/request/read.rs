use std::ffi::c_void;

use napi::Env;
use napi::bindgen_prelude::*;
use napi_derive::napi;

use crate::ffi::codec::{Codec, Decoder as _, ReadSource};
use crate::ffi::descriptor::Descriptor;
use crate::handle::Handle;
use crate::request::native_result;

fn read_field<'e>(
    env: &'e Env,
    field_ptr: usize,
    field_codec: &Codec,
) -> anyhow::Result<Unknown<'e>> {
    unsafe {
        field_codec.read(
            env,
            ReadSource::Slot(field_ptr as *const c_void, "field read"),
        )
    }
}

/// Reads and decodes a value at `offset` bytes into the handle's memory, using `fieldDescriptor`
/// to interpret the raw bytes.
#[napi(catch_unwind)]
pub fn read<'env>(
    env: &'env Env,
    handle: &External<Handle>,
    field_descriptor: Descriptor,
    offset: f64,
) -> napi::Result<Unknown<'env>> {
    let field_ptr = handle.ptr_as_usize().wrapping_add(offset as usize);
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
            let raw: i32 = 42;
            let value = read_field(
                &env,
                &raw as *const i32 as usize,
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
            let raw: f64 = 2.5;
            let value = read_field(
                &env,
                &raw as *const f64 as usize,
                &Codec::Float(FloatCodec::F64),
            )
            .expect("read should succeed");
            assert_eq!(napi_mock::read_double(value.raw()), Some(2.5));
        });
    }
}

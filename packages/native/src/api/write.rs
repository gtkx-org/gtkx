use std::ffi::c_void;

use napi::Env;
use napi::bindgen_prelude::*;
use napi_derive::napi;

use crate::api::native_result;
use crate::ffi::codec::{Codec, PtrWriter as _, SlotInit};
use crate::ffi::descriptor::Descriptor;
use crate::handle::Handle;

fn write_field(
    env: &Env,
    field_ptr: *mut c_void,
    field_codec: &Codec,
    value: Unknown<'_>,
) -> anyhow::Result<()> {
    field_codec.write_value_to_ptr(
        env,
        unsafe { crate::ffi::Slot::new(field_ptr) },
        value,
        SlotInit::Initialized,
    )
}

/// Encodes `value` with `fieldDescriptor` and writes it into the handle's memory at `offset` bytes.
#[napi(catch_unwind)]
pub fn write<'env>(
    env: &'env Env,
    handle: &External<Handle>,
    field_descriptor: Descriptor,
    offset: f64,
    value: Unknown<'_>,
) -> napi::Result<Unknown<'env>> {
    let field_ptr = handle.as_ptr().wrapping_byte_add(offset as usize);
    let field_codec = field_descriptor.into_codec()?;
    native_result(
        "field write",
        write_field(env, field_ptr, &field_codec, value),
    )?;
    ().into_unknown(env)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ffi::codec::IntegerCodec;
    use test_support::napi_mock;

    #[test]
    fn writes_an_integer_field() {
        test_support::run(|| {
            let env = napi_mock::fake_env();
            let mut raw: i32 = 0;
            let value = napi_mock::to_unknown(&env, napi_mock::fake_double(99.0));
            write_field(
                &env,
                (&mut raw as *mut i32).cast(),
                &Codec::Integer(IntegerCodec::I32),
                value,
            )
            .expect("write should succeed");
            assert_eq!(raw, 99);
        });
    }

    #[test]
    fn rejects_a_non_number_value() {
        test_support::run(|| {
            let env = napi_mock::fake_env();
            let mut raw: i32 = 0;
            let value = napi_mock::to_unknown(&env, napi_mock::fake_bool(true));
            assert!(
                write_field(
                    &env,
                    (&mut raw as *mut i32).cast(),
                    &Codec::Integer(IntegerCodec::I32),
                    value,
                )
                .is_err()
            );
        });
    }
}

use std::ffi::c_void;

use napi::Env;
use napi::bindgen_prelude::*;
use napi_derive::napi;

use crate::api::{byte_count_from_f64, native_result};
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
) -> Result<Unknown<'env>> {
    let offset = byte_count_from_f64(offset, "field write: offset")?;

    let field_ptr = handle.as_ptr().wrapping_byte_add(offset);
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
            let mut slot: i32 = 0;
            let value = napi_mock::to_unknown(&env, napi_mock::fake_double(99.0));
            write_field(
                &env,
                (&raw mut slot).cast(),
                &Codec::Integer(IntegerCodec::I32),
                value,
            )
            .expect("write should succeed");
            assert_eq!(slot, 99);
        });
    }

    #[test]
    fn rejects_a_non_number_value() {
        test_support::run(|| {
            let env = napi_mock::fake_env();
            let mut slot: i32 = 0;
            let value = napi_mock::to_unknown(&env, napi_mock::fake_bool(true));
            assert!(
                write_field(
                    &env,
                    (&raw mut slot).cast(),
                    &Codec::Integer(IntegerCodec::I32),
                    value,
                )
                .is_err()
            );
        });
    }
}

use std::ffi::c_void;

use napi::Env;
use napi::bindgen_prelude::*;
use napi_derive::napi;

use crate::api::{byte_count_from_f64, handle_memory_ptr, native_result};
use crate::ffi::codec::{Codec, PtrWriter as _, SlotInit};
use crate::ffi::descriptor::Descriptor;
use crate::handle::Handle;

fn write_field(
    env: &Env,
    field_ptr: *mut c_void,
    field_codec: &Codec,
    value: Unknown<'_>,
) -> anyhow::Result<Option<crate::ffi::PendingTransfer>> {
    field_codec.write_value_to_ptr(
        env,
        unsafe { crate::ffi::Slot::new(field_ptr) },
        value,
        SlotInit::Initialized,
    )
}

/// Encodes `value` with `fieldDescriptor` and writes it into the handle's memory at `offset` bytes,
/// rejecting a handle that points at nothing rather than writing at the bare offset.
#[napi(catch_unwind)]
pub fn write<'env>(
    env: &'env Env,
    handle: &External<Handle>,
    field_descriptor: Descriptor,
    offset: f64,
    value: Unknown<'_>,
) -> Result<Unknown<'env>> {
    let offset = byte_count_from_f64(offset, "field write: offset")?;
    let field_ptr = handle_memory_ptr(handle, "field write")?.wrapping_byte_add(offset);
    let field_codec = field_descriptor.into_codec()?;
    let transfer = native_result(
        "field write",
        write_field(env, field_ptr, &field_codec, value),
    )?;
    if let (Some(transfer), Some((fields, base))) = (transfer, handle.field_store()) {
        fields.adopt(base + offset, transfer);
    }
    ().into_unknown(env)
}

#[cfg(test)]
mod tests {
    use test_support::napi_mock;

    use super::*;
    use crate::ffi::codec::IntegerCodec;

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

use std::ffi::c_void;

use napi::Env;
use napi::bindgen_prelude::*;
use napi_derive::napi;

use crate::api::{byte_count_from_f64, handle_memory_ptr, native_result};
use crate::ffi::codec::{Codec, PtrWriter as _, SlotInit};
use crate::ffi::descriptor::Descriptor;
use crate::handle::Handle;

struct DisplacedField<'a> {
    fields: &'a crate::handle::FieldStore,
    offset: usize,
    transfer: Option<crate::ffi::PendingTransfer>,
}

impl DisplacedField<'_> {
    fn release(mut self) {
        if let Some(transfer) = self.transfer.take() {
            transfer.release_now();
        }
    }
}

impl Drop for DisplacedField<'_> {
    fn drop(&mut self) {
        if let Some(transfer) = self.transfer.take() {
            self.fields.adopt(self.offset, transfer);
        }
    }
}

fn encode_field(
    env: &Env,
    field_ptr: *mut c_void,
    field_codec: &Codec,
    value: Unknown<'_>,
    init: SlotInit,
) -> anyhow::Result<Option<crate::ffi::PendingTransfer>> {
    field_codec.write_value_to_ptr(
        env,
        unsafe { crate::ffi::Slot::new(field_ptr) },
        value,
        init,
    )
}

pub(crate) fn write_field_at<'e>(
    env: &'e Env,
    handle: &Handle,
    field_codec: &Codec,
    offset: usize,
    value: Unknown<'_>,
) -> Result<Unknown<'e>> {
    let field_ptr = handle_memory_ptr(handle, "field write")?.wrapping_byte_add(offset);
    let store = handle.field_store();
    let displaced = store.and_then(|(fields, base)| {
        let offset = base + offset;
        fields.take(offset).map(|transfer| DisplacedField {
            fields,
            offset,
            transfer: Some(transfer),
        })
    });
    let init = if displaced.is_some() {
        SlotInit::Uninitialized
    } else {
        SlotInit::Initialized
    };
    let transfer = native_result(
        "field write",
        encode_field(env, field_ptr, field_codec, value, init),
    )?;

    if let Some(displaced) = displaced {
        displaced.release();
    }

    if let (Some(transfer), Some((fields, base))) = (transfer, store) {
        fields.adopt(base + offset, transfer);
    }

    ().into_unknown(env)
}

/// Encodes `value` with `fieldDescriptor` and writes it into the handle's memory at `offset` bytes,
/// rejecting a handle that points at nothing rather than writing at the bare offset.
///
/// The descriptor is compiled on every call. A field written repeatedly through the same descriptor
/// and offset is cheaper through `bindField`, which compiles both once.
#[napi(catch_unwind)]
pub fn write<'env>(
    env: &'env Env,
    handle: &External<Handle>,
    field_descriptor: Descriptor,
    offset: f64,
    value: Unknown<'_>,
) -> Result<Unknown<'env>> {
    let offset = byte_count_from_f64(offset, "field write: offset")?;
    let field_codec = field_descriptor.into_codec()?;

    write_field_at(env, handle, &field_codec, offset, value)
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
            encode_field(
                &env,
                (&raw mut slot).cast(),
                &Codec::Integer(IntegerCodec::I32),
                value,
                SlotInit::Initialized,
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
                encode_field(
                    &env,
                    (&raw mut slot).cast(),
                    &Codec::Integer(IntegerCodec::I32),
                    value,
                    SlotInit::Initialized,
                )
                .is_err()
            );
        });
    }
}

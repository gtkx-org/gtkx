use std::ffi::c_void;

use napi::Env;
use napi::bindgen_prelude::*;
use napi_derive::napi;

use crate::api::{byte_count_from_f64, handle_memory_range, native_result};
use crate::ffi::codec::{Codec, Decoder as _, ReadCtx};
use crate::ffi::descriptor::Descriptor;
use crate::handle::Handle;
use crate::value;

fn decode_field<'e>(
    env: &'e Env,
    field_ptr: *const c_void,
    field_codec: &Codec,
) -> anyhow::Result<Unknown<'e>> {
    unsafe { field_codec.read(env, ReadCtx::slot(field_ptr, "field read")) }
}

pub(crate) fn read_field_at<'e>(
    env: &'e Env,
    handle: &Handle,
    field_codec: &Codec,
    offset: usize,
) -> Result<Unknown<'e>> {
    let _leases = crate::handle::LeaseScope::open();
    let size = field_codec.field_size();
    let field_ptr = handle_memory_range(handle, offset, size.unwrap_or(0), "field read")?;

    if field_codec.is_inline() {
        return value::handle_to_unknown(env, Handle::field(handle, offset, size));
    }

    native_result(
        "field read",
        decode_field(env, field_ptr.cast_const(), field_codec),
    )
}

/// Reads and decodes a value at `offset` bytes into the handle's memory, using `fieldDescriptor`
/// to interpret the raw bytes, and rejects a handle that points at nothing rather than reading at
/// the bare offset. A value the descriptor marks as stored inline decodes to a handle aliasing the
/// owner's memory, so writing one of its own fields reaches the owner.
///
/// The descriptor is compiled on every call. For repeated access, `bindField` compiles it once;
/// `readField` and `writeField` still receive the byte offset on each call.
#[napi(catch_unwind)]
pub fn read<'env>(
    env: &'env Env,
    handle: &External<Handle>,
    field_descriptor: Descriptor,
    offset: f64,
) -> Result<Unknown<'env>> {
    let offset = byte_count_from_f64(offset, "field read: offset")?;
    let field_codec = field_descriptor.into_codec()?;

    read_field_at(env, handle, &field_codec, offset)
}

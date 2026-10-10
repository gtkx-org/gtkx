use napi::Env;
use napi::bindgen_prelude::*;
use napi_derive::napi;

use crate::api::byte_count_from_f64;
use crate::api::read::read_field_at;
use crate::api::write::write_field_at;
use crate::ffi::codec::Codec;
use crate::ffi::descriptor::Descriptor;
use crate::handle::Handle;

pub struct FieldDescriptor {
    codec: Codec,
}

/// Compiles `fieldDescriptor` for reuse with `readField` and `writeField` at any byte offset.
/// Hoist the binding into reusable storage to avoid compiling the descriptor on every access.
#[napi(catch_unwind)]
pub fn bind_field(field_descriptor: Descriptor) -> Result<External<FieldDescriptor>> {
    let codec = field_descriptor.into_codec()?;

    Ok(External::new(FieldDescriptor { codec }))
}

/// Reads and decodes the field a previously bound `descriptor` marshals, sitting `offset` bytes
/// into the handle's memory, and rejects a handle that points at nothing rather than reading at
/// the bare offset. A field the descriptor marks as stored inline decodes to a handle aliasing the
/// owner's memory, so writing one of its own fields reaches the owner.
#[napi(catch_unwind)]
pub fn read_field<'env>(
    env: &'env Env,
    descriptor: &External<FieldDescriptor>,
    handle: &External<Handle>,
    offset: f64,
) -> Result<Unknown<'env>> {
    let offset = byte_count_from_f64(offset, "field read: offset")?;

    read_field_at(env, handle, &descriptor.codec, offset)
}

/// Encodes `value` with a previously bound `descriptor` and writes it `offset` bytes into the
/// handle's memory, rejecting a handle that points at nothing rather than writing at the bare
/// offset.
#[napi(catch_unwind)]
pub fn write_field<'env>(
    env: &'env Env,
    descriptor: &External<FieldDescriptor>,
    handle: &External<Handle>,
    offset: f64,
    value: Unknown<'_>,
) -> Result<Unknown<'env>> {
    let offset = byte_count_from_f64(offset, "field write: offset")?;

    write_field_at(env, handle, &descriptor.codec, offset, value)
}

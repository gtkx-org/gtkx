use napi::Env;
use napi::bindgen_prelude::*;
use napi_derive::napi;

use crate::api::byte_count_from_f64;
use crate::api::descriptor::CompiledDescriptor;
use crate::api::read::read_field_at;
use crate::api::write::write_field_at;
use crate::handle::Handle;

/// Reads and decodes the field described by `descriptor`, sitting `offset` bytes
/// into the handle's memory, and rejects a handle that points at nothing rather than reading at
/// the bare offset. A field the descriptor marks as stored inline decodes to a handle aliasing the
/// owner's memory, so writing one of its own fields reaches the owner.
#[napi(catch_unwind)]
pub fn read_field<'env>(
    env: &'env Env,
    descriptor: &External<CompiledDescriptor>,
    handle: &External<Handle>,
    offset: f64,
) -> Result<Unknown<'env>> {
    let offset = byte_count_from_f64(offset, "field read: offset")?;

    read_field_at(env, handle, descriptor, offset)
}

/// Encodes `value` with `descriptor` and writes it `offset` bytes into the
/// handle's memory, rejecting a handle that points at nothing rather than writing at the bare
/// offset.
#[napi(catch_unwind)]
pub fn write_field<'env>(
    env: &'env Env,
    descriptor: &External<CompiledDescriptor>,
    handle: &External<Handle>,
    offset: f64,
    value: Unknown<'_>,
) -> Result<Unknown<'env>> {
    let offset = byte_count_from_f64(offset, "field write: offset")?;

    write_field_at(env, handle, descriptor, offset, value)
}

use std::ffi::c_void;

use napi::Env;
use napi::bindgen_prelude::*;

use crate::api::{handle_memory_range, native_result};
use crate::ffi::codec::{Codec, Decoder as _, ReadCtx};
use crate::handle::Handle;
use crate::host::callback_error::CallbackErrorScope;
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
    let _errors = CallbackErrorScope::open(*env);
    let _leases = crate::handle::LeaseScope::open();
    let size = field_codec.field_size();
    let field_ptr = handle_memory_range(handle, offset, size.unwrap_or(0), "field read")?;

    if field_codec.is_inline() {
        return value::handle_to_unknown(env, Handle::field(handle, offset, size));
    }

    if let Codec::Callback(callback) = field_codec {
        let ptr = unsafe { field_ptr.cast::<*mut c_void>().read_unaligned() };
        return native_result(
            "field read",
            callback.decode_pointer(env, ptr, Some(handle.clone())),
        );
    }

    native_result(
        "field read",
        decode_field(env, field_ptr.cast_const(), field_codec),
    )
}

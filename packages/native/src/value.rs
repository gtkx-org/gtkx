use std::ffi::c_void;

use napi::bindgen_prelude::*;
use napi::{Env, ValueType};

use crate::handle::{Handle, INVALIDATED_HANDLE};

mod closure;
mod view;

pub mod pending_wrapper;
pub mod wrapper;

pub use closure::ClosureHandle;
pub use view::{TypedView, ViewKind};

const MAX_JS_ARRAY_LENGTH: u32 = 134_217_728;

pub fn read_napi<T: FromNapiValue>(value: Unknown<'_>) -> Result<T> {
    T::from_unknown(value)
}

pub fn handle_ptr(value: Unknown<'_>, type_name: &str) -> anyhow::Result<*mut c_void> {
    match value.get_type()? {
        ValueType::External => {
            let external: &External<Handle> = read_napi(value)?;
            anyhow::ensure!(
                !external.is_invalidated(),
                "The {type_name} handle refers to nothing: {INVALIDATED_HANDLE}"
            );
            Ok(external.as_ptr())
        }
        ValueType::Null | ValueType::Undefined => Ok(std::ptr::null_mut()),
        other => anyhow::bail!("Expected an Object for {type_name} type, got {other:?}"),
    }
}

pub fn handle_to_unknown(env: &Env, handle: Handle) -> Result<Unknown<'_>> {
    let size_hint = handle.size_hint();
    External::new_with_size_hint(handle, size_hint).into_unknown(env)
}

pub fn js_null(env: &Env) -> Result<Unknown<'_>> {
    Null.into_unknown(env)
}

pub fn js_undefined(env: &Env) -> Result<Unknown<'_>> {
    ().into_unknown(env)
}

pub fn checked_array_length(length: usize) -> Result<u32> {
    u32::try_from(length)
        .ok()
        .filter(|&length| length <= MAX_JS_ARRAY_LENGTH)
        .ok_or_else(|| {
            Error::new(
                Status::InvalidArg,
                format!(
                    "An array of {length} elements exceeds the maximum JavaScript array length of {MAX_JS_ARRAY_LENGTH}"
                ),
            )
        })
}

/// Copies `len` bytes out of `data` into a fresh `Uint8Array`, the representation a byte array
/// reaches JavaScript as. The bytes are copied rather than viewed, so the result outlives whatever
/// owned the source memory.
///
/// # Safety
///
/// `data` must point at `len` readable bytes, or be null when `len` is zero.
pub unsafe fn js_byte_array(env: &Env, data: *const u8, len: usize) -> Result<Unknown<'_>> {
    checked_array_length(len)?;

    let bytes = if len == 0 || data.is_null() {
        Vec::new()
    } else {
        unsafe { std::slice::from_raw_parts(data, len) }.to_vec()
    };

    Uint8Array::new(bytes).into_unknown(env)
}

pub fn js_array<'e>(env: &'e Env, items: Vec<Unknown<'e>>) -> Result<Unknown<'e>> {
    let length = checked_array_length(items.len())?;
    let mut js_array = env.create_array(length)?;
    for (index, item) in (0..length).zip(items) {
        js_array.set(index, item)?;
    }
    js_array.into_unknown(env)
}

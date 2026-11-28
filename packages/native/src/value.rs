use std::ffi::c_void;

use napi::bindgen_prelude::*;
use napi::{Env, ValueType};

use crate::handle::{Handle, HandleClass};

mod closure;
pub(crate) mod roots;
mod view;

pub mod pending_wrapper;
pub mod wrapper;

pub use closure::ClosureHandle;
pub use view::{TypedView, ViewKind};

const MAX_JS_ARRAY_LENGTH: u32 = 134_217_728;

pub fn read_napi<T: FromNapiValue>(value: Unknown<'_>) -> Result<T> {
    T::from_unknown(value)
}

/// Borrows the payload of an `External<T>` without registering it with napi's borrow tracking,
/// which rejects reference conversions outside generated argument conversion. Payloads are only
/// ever shared, so no exclusive reference can alias the result.
pub fn read_external<T: 'static>(value: Unknown<'_>) -> Result<&T> {
    let mut payload = std::ptr::null_mut();
    check_status!(
        unsafe { sys::napi_get_value_external(value.value().env, value.raw(), &raw mut payload) },
        "Failed to get external value"
    )?;
    // SAFETY: napi validates that the payload is a live `External<T>`, and this crate never
    // creates a mutable reference to one.
    unsafe { External::<T>::inner_from_raw(payload) }.ok_or_else(|| {
        Error::new(
            Status::InvalidArg,
            format!("Expected an External<{}>", std::any::type_name::<T>()),
        )
    })
}

pub fn read_handle(value: Unknown<'_>) -> Result<&Handle> {
    read_external(value)
}

pub fn handle_ptr(value: Unknown<'_>, type_name: &str) -> anyhow::Result<*mut c_void> {
    handle_ptr_checked(value, type_name, |_| Ok(()))
}

/// Same as [`handle_ptr`], but runs `check` against the handle before yielding its pointer, so a
/// codec can reject an instance of the wrong type instead of handing it to C.
pub fn handle_ptr_checked(
    value: Unknown<'_>,
    type_name: &str,
    check: impl FnOnce(&Handle) -> anyhow::Result<()>,
) -> anyhow::Result<*mut c_void> {
    extract_handle_ptr(value, type_name, |handle| {
        anyhow::ensure!(
            handle.class() != HandleClass::Function,
            "The {type_name} handle references a function instead of data memory"
        );
        check(handle)
    })
}

pub fn opaque_ptr(value: Unknown<'_>, type_name: &str) -> anyhow::Result<*mut c_void> {
    extract_handle_ptr(value, type_name, |_| Ok(()))
}

fn extract_handle_ptr(
    value: Unknown<'_>,
    type_name: &str,
    check: impl FnOnce(&Handle) -> anyhow::Result<()>,
) -> anyhow::Result<*mut c_void> {
    match value.get_type()? {
        ValueType::External => {
            let external = read_handle(value)?;
            external.retain_lease()?;
            anyhow::ensure!(
                !external.is_invalidated(),
                "The {type_name} handle refers to nothing: {}",
                external.ended_reason()
            );
            check(external)?;
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
        &[]
    } else {
        unsafe { std::slice::from_raw_parts(data, len) }
    };
    Uint8ArraySlice::copy_from(env, bytes)?.into_unknown(env)
}

pub fn js_array<'e>(env: &'e Env, items: Vec<Unknown<'e>>) -> Result<Unknown<'e>> {
    let length = checked_array_length(items.len())?;
    let mut js_array = env.create_array(length)?;
    for (index, item) in (0..length).zip(items) {
        js_array.set(index, item)?;
    }
    js_array.into_unknown(env)
}

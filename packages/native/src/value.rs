use std::ffi::c_void;

use napi::bindgen_prelude::*;
use napi::{Env, ValueType};

use crate::handle::Handle;

mod closure;
mod view;

pub mod wrapper;

pub use closure::ClosureHandle;
pub use view::{TypedView, ViewKind};

pub fn read_napi<T: FromNapiValue>(value: Unknown<'_>) -> Result<T> {
    T::from_unknown(value)
}

pub fn handle_ptr(value: Unknown<'_>, type_name: &str) -> anyhow::Result<*mut c_void> {
    match value.get_type()? {
        ValueType::External => {
            let external: &External<Handle> = read_napi(value)?;
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

pub fn js_array<'e>(env: &'e Env, items: Vec<Unknown<'e>>) -> Result<Unknown<'e>> {
    let length = u32::try_from(items.len()).map_err(|_| {
        Error::new(
            Status::InvalidArg,
            format!(
                "Array of {} items exceeds the JavaScript array index range",
                items.len()
            ),
        )
    })?;
    let mut js_array = env.create_array(length)?;
    for (index, item) in (0..length).zip(items) {
        js_array.set(index, item)?;
    }
    js_array.into_unknown(env)
}

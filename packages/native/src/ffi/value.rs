use std::ffi::c_void;

use napi::bindgen_prelude::*;
use napi::{Env, ValueType, sys};

use crate::handle::Handle;

mod js_ref;
mod view;

pub use js_ref::JsHandle;
pub use view::{TypedView, ViewKind};

fn from_napi<T: FromNapiValue>(env: &Env, raw: sys::napi_value) -> napi::Result<T> {
    unsafe { T::from_napi_value(env.raw(), raw) }
}

pub fn read_napi<T: FromNapiValue>(env: &Env, value: Unknown<'_>) -> napi::Result<T> {
    from_napi(env, value.raw())
}

pub fn handle_ptr(env: &Env, value: Unknown<'_>, type_name: &str) -> anyhow::Result<*mut c_void> {
    match value.get_type()? {
        ValueType::External => {
            let external: &External<Handle> = from_napi(env, value.raw())?;
            Ok(external.as_ptr())
        }
        ValueType::Null | ValueType::Undefined => Ok(std::ptr::null_mut()),
        other => anyhow::bail!("Expected an Object for {type_name} type, got {other:?}"),
    }
}

pub fn handle_to_unknown<'e>(env: &'e Env, handle: Handle) -> napi::Result<Unknown<'e>> {
    let size_hint = handle.size_hint();
    External::new_with_size_hint(handle, size_hint).into_unknown(env)
}

pub fn js_null<'e>(env: &'e Env) -> napi::Result<Unknown<'e>> {
    Null.into_unknown(env)
}

pub fn js_undefined<'e>(env: &'e Env) -> napi::Result<Unknown<'e>> {
    ().into_unknown(env)
}

pub fn js_array<'e>(env: &'e Env, items: Vec<Unknown<'e>>) -> napi::Result<Unknown<'e>> {
    let mut js_array = env.create_array(items.len() as u32)?;
    for (i, item) in items.into_iter().enumerate() {
        js_array.set(i as u32, item)?;
    }
    js_array.into_unknown(env)
}

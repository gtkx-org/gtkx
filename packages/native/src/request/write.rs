use std::ffi::c_void;
use std::sync::Arc;

use napi::Env;
use napi::bindgen_prelude::*;
use napi_derive::napi;

use super::Request;
use crate::ffi::codec::{Codec, PtrWriter as _};
use crate::ffi::value::Value;
use crate::handle::Handle;

struct WriteRequest {
    field_ptr: usize,
    field_codec: Arc<Codec>,
    value: Value,
}

impl Request for WriteRequest {
    type Output = ();

    fn execute(self) -> anyhow::Result<()> {
        let field_ptr = self.field_ptr as *mut c_void;
        unsafe { self.field_codec.write_value_to_ptr(field_ptr, &self.value) }
    }

    fn error_context() -> &'static str {
        "field write"
    }
}

pub mod napi_export {
    use super::*;

    #[napi(catch_unwind)]
    pub fn write<'env>(
        env: &'env Env,
        handle: &External<Handle>,
        field_codec: &External<Arc<Codec>>,
        offset: f64,
        value: Unknown<'_>,
    ) -> napi::Result<Unknown<'env>> {
        let parsed_value = Value::from_js_value(env, value)?;
        let request = WriteRequest {
            field_ptr: handle.ptr_as_usize().wrapping_add(offset as usize),
            field_codec: Arc::clone(field_codec),
            value: parsed_value,
        };
        request.dispatch(env)
    }
}

use napi::Env;
use napi::bindgen_prelude::*;
use napi_derive::napi;

use super::Request;
use super::read::FieldLocation;
use crate::ffi::codec::{Codec, PtrWriter as _};
use crate::ffi::descriptor::Descriptor;
use crate::ffi::value::Value;
use crate::handle::Handle;

struct WriteRequest {
    location: FieldLocation,
    field_codec: Codec,
    value: Value,
}

impl Request for WriteRequest {
    type Output = ();

    fn execute(self) -> anyhow::Result<()> {
        let field_ptr = unsafe { self.location.resolve()? };
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
        field_descriptor: Descriptor,
        offset: f64,
        value: Unknown<'_>,
    ) -> napi::Result<Unknown<'env>> {
        let field_codec = field_descriptor.into_codec()?;
        let parsed_value = Value::from_js_value(env, value)?;
        let request = WriteRequest {
            location: FieldLocation {
                base_ptr: handle.ptr_as_usize(),
                offset: offset as usize,
            },
            field_codec,
            value: parsed_value,
        };
        request.dispatch(env)
    }
}

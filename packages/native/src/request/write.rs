use napi::Env;
use napi::bindgen_prelude::*;
use napi_derive::napi;

use super::Request;
use super::read::FieldLocation;
use crate::ffi::codec::{Codec, PointerWriter as _};
use crate::ffi::descriptor::Descriptor;
use crate::ffi::value::Value;
use crate::handle::Handle;

struct WriteRequest {
    location: FieldLocation,
    field_type: Codec,
    value: Value,
}

impl Request for WriteRequest {
    type Output = ();

    fn execute(self) -> anyhow::Result<()> {
        let field_ptr = unsafe { self.location.resolve()? };
        unsafe {
            self.field_type
                .write_value_to_pointer(field_ptr, &self.value)
        }
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
        js_type: Descriptor,
        offset: f64,
        value: Unknown<'_>,
    ) -> napi::Result<Unknown<'env>> {
        let field_type = js_type.into_codec()?;
        let parsed_value = Value::from_js_value(env, value)?;
        let request = WriteRequest {
            location: FieldLocation {
                base_addr: handle.ptr_as_usize(),
                offset: offset as usize,
            },
            field_type,
            value: parsed_value,
        };
        request.dispatch(env)
    }
}

use std::ffi::c_void;

use napi::Env;
use napi::bindgen_prelude::*;
use napi_derive::napi;

use super::Request;
use crate::ffi::codec::{Codec, PtrWriter as _};
use crate::ffi::descriptor::Descriptor;
use crate::ffi::value::Value;
use crate::handle::Handle;

struct WriteRequest {
    field_ptr: usize,
    field_codec: Codec,
    value: Value,
}

impl Request for WriteRequest {
    type Output = ();

    fn execute(self) -> anyhow::Result<()> {
        let field_ptr = self.field_ptr as *mut c_void;
        self.field_codec
            .write_value_to_ptr(unsafe { crate::ffi::Slot::new(field_ptr) }, &self.value)
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
        let parsed_value = Value::from_js_value(env, value)?;
        let request = WriteRequest {
            field_ptr: handle.ptr_as_usize().wrapping_add(offset as usize),
            field_codec: field_descriptor.into_codec()?,
            value: parsed_value,
        };
        request.dispatch(env)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ffi::codec::IntegerCodec;
    use crate::request::Request;

    #[test]
    fn execute_writes_an_integer_field() {
        let mut raw: i32 = 0;
        let request = WriteRequest {
            field_ptr: &mut raw as *mut i32 as usize,
            field_codec: Codec::Integer(IntegerCodec::I32),
            value: Value::Number(99.0),
        };
        request.execute().expect("write should succeed");
        assert_eq!(raw, 99);
    }

    #[test]
    fn execute_rejects_a_non_number_value() {
        let mut raw: i32 = 0;
        let request = WriteRequest {
            field_ptr: &mut raw as *mut i32 as usize,
            field_codec: Codec::Integer(IntegerCodec::I32),
            value: Value::Boolean(true),
        };
        assert!(request.execute().is_err());
    }
}

use std::ffi::c_void;

use napi::Env;
use napi::bindgen_prelude::*;
use napi_derive::napi;

use super::Request;
use crate::ffi::codec::{Codec, Decoder as _, ReadSource};
use crate::ffi::descriptor::Descriptor;
use crate::ffi::value::Value;
use crate::handle::Handle;

pub struct ReadRequest {
    pub field_ptr: usize,
    pub field_codec: Codec,
}

impl Request for ReadRequest {
    type Output = Value;

    fn execute(self) -> anyhow::Result<Value> {
        let field_ptr = self.field_ptr as *const c_void;
        unsafe {
            self.field_codec
                .read(ReadSource::Slot(field_ptr, "field read"))
        }
    }

    fn error_context() -> &'static str {
        "field read"
    }
}

pub mod napi_export {
    use super::*;

    #[napi(catch_unwind)]
    pub fn read<'env>(
        env: &'env Env,
        handle: &External<Handle>,
        field_descriptor: Descriptor,
        offset: f64,
    ) -> napi::Result<Unknown<'env>> {
        let request = ReadRequest {
            field_ptr: handle.ptr_as_usize().wrapping_add(offset as usize),
            field_codec: field_descriptor.into_codec()?,
        };
        request.dispatch(env)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ffi::codec::{FloatCodec, IntegerCodec};
    use crate::request::Request;

    #[test]
    fn execute_reads_an_integer_field() {
        let raw: i32 = 42;
        let request = ReadRequest {
            field_ptr: &raw as *const i32 as usize,
            field_codec: Codec::Integer(IntegerCodec::I32),
        };
        let value = request.execute().expect("read should succeed");
        assert!(matches!(value, Value::Number(n) if n == 42.0));
    }

    #[test]
    fn execute_reads_a_float_field() {
        let raw: f64 = 2.5;
        let request = ReadRequest {
            field_ptr: &raw as *const f64 as usize,
            field_codec: Codec::Float(FloatCodec::F64),
        };
        let value = request.execute().expect("read should succeed");
        assert!(matches!(value, Value::Number(n) if n == 2.5));
    }
}

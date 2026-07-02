use std::ffi::c_void;
use std::sync::Arc;

use napi::Env;
use napi::bindgen_prelude::*;
use napi_derive::napi;

use super::Request;
use crate::ffi::codec::{Codec, Decoder as _, ReadSource};
use crate::ffi::value::Value;
use crate::handle::Handle;

pub struct ReadRequest {
    pub field_ptr: usize,
    pub field_codec: Arc<Codec>,
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
        field_codec: &External<Arc<Codec>>,
        offset: f64,
    ) -> napi::Result<Unknown<'env>> {
        let request = ReadRequest {
            field_ptr: handle.ptr_as_usize().wrapping_add(offset as usize),
            field_codec: Arc::clone(field_codec),
        };
        request.dispatch(env)
    }
}

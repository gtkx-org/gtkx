use std::ffi::c_void;

use napi::Env;
use napi::bindgen_prelude::*;
use napi_derive::napi;

use super::Request;
use crate::ffi::codec::{Codec, Decoder as _, ReadSource};
use crate::ffi::descriptor::Descriptor;
use crate::ffi::value::Value;
use crate::handle::Handle;

pub struct FieldLocation {
    pub base_ptr: usize,
    pub offset: usize,
}

impl FieldLocation {
    pub unsafe fn resolve(&self) -> anyhow::Result<*mut c_void> {
        if self.base_ptr == 0 {
            anyhow::bail!("Handle has a null pointer");
        }
        Ok(unsafe { (self.base_ptr as *mut u8).add(self.offset) as *mut c_void })
    }
}

pub struct ReadRequest {
    pub location: FieldLocation,
    pub field_codec: Codec,
}

impl Request for ReadRequest {
    type Output = Value;

    fn execute(self) -> anyhow::Result<Value> {
        let field_ptr = unsafe { self.location.resolve()? }.cast_const();
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
        let field_codec = field_descriptor.into_codec()?;
        let request = ReadRequest {
            location: FieldLocation {
                base_ptr: handle.ptr_as_usize(),
                offset: offset as usize,
            },
            field_codec,
        };
        request.dispatch(env)
    }
}

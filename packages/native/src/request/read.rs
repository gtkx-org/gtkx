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
    pub base_addr: usize,
    pub offset: usize,
}

impl FieldLocation {
    pub unsafe fn resolve(&self) -> anyhow::Result<*mut c_void> {
        if self.base_addr == 0 {
            anyhow::bail!("Handle has a null pointer");
        }
        Ok(unsafe { (self.base_addr as *mut u8).add(self.offset) as *mut c_void })
    }
}

pub struct ReadRequest {
    pub location: FieldLocation,
    pub field_type: Codec,
}

impl Request for ReadRequest {
    type Output = Value;

    fn execute(self) -> anyhow::Result<Value> {
        let field_ptr = unsafe { self.location.resolve()? }.cast_const();
        unsafe {
            self.field_type
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
        js_type: Descriptor,
        offset: f64,
    ) -> napi::Result<Unknown<'env>> {
        let field_type = js_type.into_codec()?;
        let request = ReadRequest {
            location: FieldLocation {
                base_addr: handle.ptr_as_usize(),
                offset: offset as usize,
            },
            field_type,
        };
        request.dispatch(env)
    }
}

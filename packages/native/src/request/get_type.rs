use glib::gobject_ffi;
use napi::Env;
use napi::bindgen_prelude::*;
use napi_derive::napi;

use super::Request;
use crate::handle::Handle;

struct GetTypeRequest {
    gobject_ptr: usize,
}

impl Request for GetTypeRequest {
    type Output = u64;

    fn execute(self) -> anyhow::Result<u64> {
        if self.gobject_ptr == 0 {
            return Ok(0);
        }
        let instance = self.gobject_ptr as *mut gobject_ffi::GTypeInstance;
        let g_class = unsafe { (*instance).g_class };
        let type_ = unsafe { (*g_class).g_type };
        Ok(type_ as u64)
    }

    fn error_context() -> &'static str {
        "get_type"
    }
}

pub mod napi_export {
    use super::*;

    #[napi(catch_unwind)]
    pub fn get_type(env: Env, handle: &External<Handle>) -> napi::Result<BigInt> {
        let type_ = GetTypeRequest {
            gobject_ptr: handle.ptr_as_usize(),
        }
        .dispatch_output(env)?;
        Ok(BigInt::from(type_))
    }
}

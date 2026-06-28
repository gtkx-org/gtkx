use glib::gobject_ffi;
use napi::Env;
use napi::bindgen_prelude::*;
use napi_derive::napi;

use super::Request;
use crate::handle::Handle;

struct GetTypeRequest {
    instance_addr: usize,
}

impl Request for GetTypeRequest {
    type Output = u64;

    fn execute(self) -> anyhow::Result<u64> {
        if self.instance_addr == 0 {
            return Ok(0);
        }
        let instance = self.instance_addr as *mut gobject_ffi::GTypeInstance;
        let g_class = unsafe { (*instance).g_class };
        if g_class.is_null() {
            return Ok(0);
        }
        let gtype = unsafe { (*g_class).g_type };
        Ok(gtype as u64)
    }

    fn error_context() -> &'static str {
        "get_type"
    }
}

pub mod napi_export {
    use super::*;

    #[napi(catch_unwind)]
    pub fn get_type(env: Env, handle: &External<Handle>) -> napi::Result<BigInt> {
        let gtype = GetTypeRequest {
            instance_addr: handle.ptr_as_usize(),
        }
        .dispatch_output(env)?;
        Ok(BigInt::from(gtype))
    }
}

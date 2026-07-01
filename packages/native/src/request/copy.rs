use napi::Env;
use napi::bindgen_prelude::*;
use napi_derive::napi;

use super::Request;
use crate::handle::Handle;

struct CopyRequest {
    dest_ptr: usize,
    src_ptr: usize,
    size: usize,
}

impl Request for CopyRequest {
    type Output = ();

    fn execute(self) -> anyhow::Result<()> {
        if self.size == 0
            || self.dest_ptr == 0
            || self.src_ptr == 0
            || self.dest_ptr == self.src_ptr
        {
            return Ok(());
        }
        unsafe {
            std::ptr::copy_nonoverlapping(
                self.src_ptr as *const u8,
                self.dest_ptr as *mut u8,
                self.size,
            );
        }
        Ok(())
    }

    fn error_context() -> &'static str {
        "handle bytes copy"
    }
}

pub mod napi_export {
    use super::*;

    #[napi(catch_unwind)]
    pub fn copy<'env>(
        env: &'env Env,
        dest: &External<Handle>,
        src: &External<Handle>,
        size: f64,
    ) -> napi::Result<Unknown<'env>> {
        let request = CopyRequest {
            dest_ptr: dest.ptr_as_usize(),
            src_ptr: src.ptr_as_usize(),
            size: size as usize,
        };
        request.dispatch(env)
    }
}

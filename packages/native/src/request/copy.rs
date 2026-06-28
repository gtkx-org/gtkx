use napi::Env;
use napi::bindgen_prelude::*;
use napi_derive::napi;

use super::Request;
use crate::handle::Handle;

struct CopyRequest {
    dest_addr: usize,
    src_addr: usize,
    size: usize,
}

impl Request for CopyRequest {
    type Output = ();

    fn execute(self) -> anyhow::Result<()> {
        if self.size == 0
            || self.dest_addr == 0
            || self.src_addr == 0
            || self.dest_addr == self.src_addr
        {
            return Ok(());
        }
        unsafe {
            std::ptr::copy_nonoverlapping(
                self.src_addr as *const u8,
                self.dest_addr as *mut u8,
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
            dest_addr: dest.ptr_as_usize(),
            src_addr: src.ptr_as_usize(),
            size: size as usize,
        };
        request.dispatch(env)
    }
}

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
        if self.size == 0 || self.dest_ptr == self.src_ptr {
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::request::Request;

    #[test]
    fn execute_copies_bytes_between_regions() {
        let source: [u8; 4] = [1, 2, 3, 4];
        let mut dest: [u8; 4] = [0; 4];
        let request = CopyRequest {
            dest_ptr: dest.as_mut_ptr() as usize,
            src_ptr: source.as_ptr() as usize,
            size: source.len(),
        };
        request.execute().expect("copy should succeed");
        assert_eq!(dest, [1, 2, 3, 4]);
    }

    #[test]
    fn execute_is_a_noop_for_zero_size() {
        let source: [u8; 4] = [1, 2, 3, 4];
        let mut dest: [u8; 4] = [9; 4];
        let request = CopyRequest {
            dest_ptr: dest.as_mut_ptr() as usize,
            src_ptr: source.as_ptr() as usize,
            size: 0,
        };
        request.execute().expect("copy should succeed");
        assert_eq!(dest, [9; 4]);
    }

    #[test]
    fn execute_is_a_noop_when_source_and_dest_match() {
        let mut region: [u8; 4] = [5, 6, 7, 8];
        let ptr = region.as_mut_ptr() as usize;
        let request = CopyRequest {
            dest_ptr: ptr,
            src_ptr: ptr,
            size: region.len(),
        };
        request.execute().expect("copy should succeed");
        assert_eq!(region, [5, 6, 7, 8]);
    }
}

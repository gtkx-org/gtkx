use napi::Env;
use napi::bindgen_prelude::*;
use napi_derive::napi;

use crate::handle::Handle;
use crate::request::native_result;

fn copy_bytes(dest_ptr: usize, src_ptr: usize, size: usize) -> anyhow::Result<()> {
    if size == 0 || dest_ptr == src_ptr {
        return Ok(());
    }
    unsafe {
        std::ptr::copy_nonoverlapping(src_ptr as *const u8, dest_ptr as *mut u8, size);
    }
    Ok(())
}

/// Copies `size` bytes from the `src` handle's memory into the `dest` handle's memory.
#[napi(catch_unwind)]
pub fn copy<'env>(
    env: &'env Env,
    dest: &External<Handle>,
    src: &External<Handle>,
    size: f64,
) -> napi::Result<Unknown<'env>> {
    native_result(
        "handle bytes copy",
        copy_bytes(dest.ptr_as_usize(), src.ptr_as_usize(), size as usize),
    )?;
    ().into_unknown(env)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn copies_bytes_between_regions() {
        let source: [u8; 4] = [1, 2, 3, 4];
        let mut dest: [u8; 4] = [0; 4];
        copy_bytes(
            dest.as_mut_ptr() as usize,
            source.as_ptr() as usize,
            source.len(),
        )
        .expect("copy should succeed");
        assert_eq!(dest, [1, 2, 3, 4]);
    }

    #[test]
    fn is_a_noop_for_zero_size() {
        let source: [u8; 4] = [1, 2, 3, 4];
        let mut dest: [u8; 4] = [9; 4];
        copy_bytes(dest.as_mut_ptr() as usize, source.as_ptr() as usize, 0)
            .expect("copy should succeed");
        assert_eq!(dest, [9; 4]);
    }

    #[test]
    fn is_a_noop_when_source_and_dest_match() {
        let mut region: [u8; 4] = [5, 6, 7, 8];
        let ptr = region.as_mut_ptr() as usize;
        copy_bytes(ptr, ptr, region.len()).expect("copy should succeed");
        assert_eq!(region, [5, 6, 7, 8]);
    }
}

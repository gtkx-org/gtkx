use napi::Env;
use napi::bindgen_prelude::*;
use napi_derive::napi;

use crate::api::byte_count_from_f64;
use crate::handle::Handle;

fn copy_bytes(dest: *mut u8, src: *const u8, size: usize) {
    if size == 0 {
        return;
    }

    unsafe {
        std::ptr::copy(src, dest, size);
    }
}

/// Copies `size` bytes from the `src` handle's memory into the `dest` handle's memory.
#[napi(catch_unwind)]
pub fn copy<'env>(
    env: &'env Env,
    dest: &External<Handle>,
    src: &External<Handle>,
    size: f64,
) -> Result<Unknown<'env>> {
    let size = byte_count_from_f64(size, "copy: size")?;

    copy_bytes(dest.as_ptr().cast::<u8>(), src.as_ptr().cast::<u8>(), size);
    ().into_unknown(env)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn copies_bytes_between_regions() {
        let source: [u8; 4] = [1, 2, 3, 4];
        let mut dest: [u8; 4] = [0; 4];
        copy_bytes(dest.as_mut_ptr(), source.as_ptr(), source.len());
        assert_eq!(dest, [1, 2, 3, 4]);
    }

    #[test]
    fn is_a_noop_for_zero_size() {
        let source: [u8; 4] = [1, 2, 3, 4];
        let mut dest: [u8; 4] = [9; 4];
        copy_bytes(dest.as_mut_ptr(), source.as_ptr(), 0);
        assert_eq!(dest, [9; 4]);
    }

    #[test]
    fn is_a_noop_when_source_and_dest_match() {
        let mut region: [u8; 4] = [5, 6, 7, 8];
        let ptr = region.as_mut_ptr();
        copy_bytes(ptr, ptr, region.len());
        assert_eq!(region, [5, 6, 7, 8]);
    }

    #[test]
    fn copies_bytes_between_partially_overlapping_regions() {
        let mut region: [u8; 4] = [1, 2, 3, 4];
        let base = region.as_mut_ptr();
        let shifted = unsafe { base.add(1) };
        copy_bytes(shifted, base, 3);
        assert_eq!(region, [1, 1, 2, 3]);
    }
}

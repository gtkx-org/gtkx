use napi::Env;
use napi::bindgen_prelude::*;
use napi_derive::napi;

use crate::api::{byte_count_from_f64, handle_memory_ptr};
use crate::handle::Handle;

fn copy_bytes(dest: *mut u8, src: *const u8, size: usize) {
    if size == 0 {
        return;
    }

    unsafe {
        std::ptr::copy(src, dest, size);
    }
}

/// Copies `size` bytes from the `src` handle's memory into the `dest` handle's memory, rejecting
/// either handle when it points at nothing rather than reading or writing at address zero.
#[napi(catch_unwind)]
pub fn copy<'env>(
    env: &'env Env,
    dest: &External<Handle>,
    src: &External<Handle>,
    size: f64,
) -> Result<Unknown<'env>> {
    let size = byte_count_from_f64(size, "copy: size")?;
    let dest_ptr = handle_memory_ptr(dest, "copy: destination")?;
    let src_ptr = handle_memory_ptr(src, "copy: source")?;

    copy_bytes(dest_ptr.cast::<u8>(), src_ptr.cast::<u8>(), size);
    ().into_unknown(env)
}

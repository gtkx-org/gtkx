use napi::Env;
use napi::bindgen_prelude::*;
use napi_derive::napi;

use crate::api::{byte_count_from_f64, handle_memory_range};
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
/// either handle when it points at nothing rather than reading or writing at address zero. A
/// handle that records how many bytes it allocated also rejects a size reaching past them; one
/// over memory C returned records no count, so its bounds are the caller's to respect.
#[napi(catch_unwind)]
pub fn copy<'env>(
    env: &'env Env,
    dest: &External<Handle>,
    src: &External<Handle>,
    size: f64,
) -> Result<Unknown<'env>> {
    let _leases = crate::handle::LeaseScope::open();
    let size = byte_count_from_f64(size, "copy: size")?;
    let dest_ptr = handle_memory_range(dest, 0, size, "copy: destination")?;
    let src_ptr = handle_memory_range(src, 0, size, "copy: source")?;

    copy_bytes(dest_ptr.cast::<u8>(), src_ptr.cast::<u8>(), size);
    ().into_unknown(env)
}

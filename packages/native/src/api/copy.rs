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

fn check_fits(handle: &Handle, size: usize, label: &str) -> Result<()> {
    let Some(allocated) = handle.allocated_bytes() else {
        return Ok(());
    };

    if size > allocated {
        return Err(Error::new(
            Status::InvalidArg,
            format!("{label} holds {allocated} bytes, so {size} of them cannot be copied"),
        ));
    }

    Ok(())
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
    let size = byte_count_from_f64(size, "copy: size")?;
    check_fits(dest, size, "copy: destination")?;
    check_fits(src, size, "copy: source")?;
    let dest_ptr = handle_memory_ptr(dest, "copy: destination")?;
    let src_ptr = handle_memory_ptr(src, "copy: source")?;

    copy_bytes(dest_ptr.cast::<u8>(), src_ptr.cast::<u8>(), size);
    ().into_unknown(env)
}

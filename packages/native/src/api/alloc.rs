use glib::ffi::g_malloc0;
use napi::bindgen_prelude::*;
use napi_derive::napi;

use crate::api::{byte_count_from_f64, type_from_bigint};
use crate::handle::{Boxed, Handle};

fn boxed_type_from_bigint(gtype: Option<BigInt>) -> Result<Option<glib::Type>> {
    let Some(gtype) = gtype else {
        return Ok(None);
    };
    let type_ = type_from_bigint(&gtype, "alloc: boxed")?;
    Ok(type_.is_a(glib::Type::BOXED).then_some(type_))
}

fn alloc_handle(size: usize, type_: Option<glib::Type>) -> Handle {
    let ptr = unsafe { g_malloc0(size) };
    let handle = match type_ {
        Some(type_) => Handle::from(Boxed::from_glib_full(type_, ptr)),
        None => Handle::owned_struct(ptr),
    };

    handle.with_allocated_bytes(size)
}

/// Allocates a zero-filled native memory block of `size` bytes and returns an opaque handle to it.
/// A `gtype` naming a registered boxed type selects `g_boxed_free` as the handle's destructor, so a
/// type whose free function has to run is torn down properly. A `gtype` that is registered but not
/// boxed, such as one from `g_pointer_type_register_static`, has no boxed free function to select,
/// so the handle owns the block as a plain struct and releases it with `g_free`.
#[napi(catch_unwind)]
pub fn alloc(size: f64, gtype: Option<BigInt>) -> Result<External<Handle>> {
    let type_ = boxed_type_from_bigint(gtype)?;
    let handle = alloc_handle(byte_count_from_f64(size, "alloc: size")?, type_);
    let size_hint = handle.size_hint();
    Ok(External::new_with_size_hint(handle, size_hint))
}

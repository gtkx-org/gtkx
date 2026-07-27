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
    if !type_.is_a(glib::Type::BOXED) {
        return Err(Error::new(
            Status::InvalidArg,
            format!("alloc: type '{}' is not a boxed type", type_.name()),
        ));
    }
    Ok(Some(type_))
}

fn alloc_handle(size: usize, type_: Option<glib::Type>) -> Handle {
    let ptr = unsafe { g_malloc0(size) };
    match type_ {
        Some(type_) => Handle::Boxed(Boxed::from_glib_full(type_, ptr)),
        None => Handle::owned_struct(ptr),
    }
}

/// Allocates a zero-filled native memory block of `size` bytes and returns an opaque handle to it.
/// The optional `gtype` must be a registered boxed `GType` and selects `g_boxed_free` as the
/// handle's destructor instead of `g_free`.
#[napi(catch_unwind)]
pub fn alloc(size: f64, gtype: Option<BigInt>) -> Result<External<Handle>> {
    let type_ = boxed_type_from_bigint(gtype)?;
    let handle = alloc_handle(byte_count_from_f64(size, "alloc: size")?, type_);
    let size_hint = handle.size_hint();
    Ok(External::new_with_size_hint(handle, size_hint))
}

#[cfg(test)]
mod tests {
    use glib::prelude::StaticType as _;
    use glib::translate::IntoGlib as _;

    use super::*;

    #[test]
    fn allocates_untyped_boxed_handle() {
        test_support::run(|| {
            let handle = alloc_handle(32, None);
            assert!(!handle.as_ptr().is_null());
        });
    }

    #[test]
    fn allocates_typed_boxed_handle() {
        test_support::run(|| {
            let type_ = glib::Bytes::static_type();
            let value = BigInt::from(type_.into_glib() as u64);
            let resolved =
                boxed_type_from_bigint(Some(value)).expect("boxed gtype should be accepted");
            assert_eq!(resolved, Some(type_));
        });
    }

    #[test]
    fn rejects_zero_gtype() {
        test_support::run(|| {
            assert!(boxed_type_from_bigint(Some(BigInt::from(0u64))).is_err());
        });
    }

    #[test]
    fn rejects_non_boxed_gtype() {
        test_support::run(|| {
            let value = BigInt::from(glib::Type::STRING.into_glib() as u64);
            assert!(boxed_type_from_bigint(Some(value)).is_err());
        });
    }
}

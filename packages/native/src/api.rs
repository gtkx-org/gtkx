use std::ffi::c_void;

use crate::handle::{Handle, INVALIDATED_HANDLE, NULL_HANDLE};

pub mod alloc;
pub mod bind;
pub mod bind_field;
pub mod call;
pub mod copy;
pub mod get_fundamental_wrapper;
pub mod get_type;
pub mod get_wrapper;
pub mod init;
pub mod keep_alive;
pub mod new_object;
pub mod quit;
pub mod read;
pub mod register_class;
pub mod resolve_type;
pub mod set_fundamental_wrapper;
pub mod set_wrapper;
pub mod type_class;
pub mod vtable;
pub mod write;

macro_rules! handle_newtype {
    ($name:ident, $ptr:ty) => {
        pub struct $name($ptr);

        impl ::napi::bindgen_prelude::FromNapiValue for $name {
            unsafe fn from_napi_value(
                env: ::napi::sys::napi_env,
                napi_val: ::napi::sys::napi_value,
            ) -> ::napi::Result<Self> {
                let external = unsafe {
                    <&::napi::bindgen_prelude::External<$crate::handle::Handle>>::from_napi_value(
                        env, napi_val,
                    )?
                };
                Ok(Self(external.as_ptr().cast()))
            }
        }
    };
}
pub(crate) use handle_newtype;

pub(crate) fn native_result<T>(context: &str, result: anyhow::Result<T>) -> napi::Result<T> {
    result.map_err(|error| {
        napi::Error::new(
            napi::Status::GenericFailure,
            format!("Error during {context}: {error:#}"),
        )
    })
}

/// The address of the memory a handle stands for, rejecting both a handle whose borrow has ended
/// and one that points at nothing, so that neither is turned into an address to read or write.
pub(crate) fn handle_memory_ptr(handle: &Handle, label: &str) -> napi::Result<*mut c_void> {
    if handle.is_invalidated() {
        return Err(napi::Error::new(
            napi::Status::InvalidArg,
            format!("{label}: the handle refers to nothing, {INVALIDATED_HANDLE}"),
        ));
    }

    let ptr = handle.as_ptr();

    if ptr.is_null() {
        return Err(napi::Error::new(
            napi::Status::InvalidArg,
            format!("{label}: {NULL_HANDLE}"),
        ));
    }

    Ok(ptr)
}

#[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
pub(crate) fn byte_count_from_f64(value: f64, label: &str) -> napi::Result<usize> {
    const MAX_EXACT_INTEGER: f64 = 9_007_199_254_740_992.0;

    if value.fract() != 0.0 || !(0.0..=MAX_EXACT_INTEGER).contains(&value) {
        return Err(napi::Error::new(
            napi::Status::InvalidArg,
            format!("{label} must be a whole byte count in 0..=2^53, got {value}"),
        ));
    }

    Ok(value as usize)
}

pub(crate) fn type_from_bigint(
    value: &napi::bindgen_prelude::BigInt,
    label: &str,
) -> napi::Result<glib::Type> {
    use glib::translate::FromGlib as _;

    let (_, type_value, lossless) = value.get_u64();
    if !lossless {
        return Err(napi::Error::new(
            napi::Status::InvalidArg,
            format!("{label} type exceeds the 64-bit type range"),
        ));
    }
    let Ok(gtype) = glib::ffi::GType::try_from(type_value) else {
        return Err(napi::Error::new(
            napi::Status::InvalidArg,
            format!("{label} type exceeds the platform type range"),
        ));
    };
    let type_ = unsafe { glib::Type::from_glib(gtype) };
    if !type_.is_valid() {
        return Err(napi::Error::new(
            napi::Status::InvalidArg,
            format!("{label} type must be non-zero"),
        ));
    }
    Ok(type_)
}

#[cfg(test)]
mod tests {
    use glib::prelude::StaticType as _;
    use glib::translate::IntoGlib as _;
    use napi::bindgen_prelude::BigInt;

    use super::{Handle, handle_memory_ptr, type_from_bigint};

    #[test]
    fn handle_memory_ptr_rejects_a_handle_whose_borrow_has_ended() {
        test_support::run(|| {
            let (obj, obj_ptr, _) = test_support::fresh_gobject();
            let handle = Handle::borrowed_gobject(obj_ptr);
            assert!(handle_memory_ptr(&handle, "field read").is_ok());

            handle.invalidate();
            let error = handle_memory_ptr(&handle, "field read")
                .expect_err("a handle whose borrow has ended should be rejected");

            assert!(
                error
                    .reason
                    .contains("only valid until the override returns")
            );

            drop(obj);
        });
    }

    #[test]
    fn handle_memory_ptr_rejects_a_handle_that_points_at_nothing() {
        test_support::run(|| {
            let handle = Handle::owned_struct(std::ptr::null_mut());
            let error = handle_memory_ptr(&handle, "field read")
                .expect_err("a handle that points at nothing should be rejected");

            assert!(error.reason.contains("no memory to reach through it"));
        });
    }

    #[test]
    fn type_from_bigint_accepts_a_valid_type() {
        let value = BigInt::from(glib::Object::static_type().into_glib() as u64);
        assert!(type_from_bigint(&value, "test:").is_ok());
    }

    #[test]
    fn type_from_bigint_rejects_zero() {
        assert!(type_from_bigint(&BigInt::from(0u64), "test:").is_err());
    }
}

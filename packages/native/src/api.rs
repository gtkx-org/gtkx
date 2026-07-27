pub mod alloc;
pub mod bind;
pub mod call;
pub mod copy;
pub mod get_type;
pub mod get_wrapper;
pub mod init;
pub mod keep_alive;
pub mod quit;
pub mod read;
pub mod register_class;
pub mod resolve_type;
pub mod set_wrapper;
pub mod write;

pub(crate) fn native_result<T>(context: &str, result: anyhow::Result<T>) -> napi::Result<T> {
    result.map_err(|error| {
        napi::Error::new(
            napi::Status::GenericFailure,
            format!("Error during {context}: {error:#}"),
        )
    })
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

    use super::type_from_bigint;

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

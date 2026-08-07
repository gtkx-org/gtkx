use anyhow::Context as _;
use libffi::middle as libffi;
use napi::Env;
use napi::bindgen_prelude::*;
use napi_derive::napi;

use super::bind::CallDescriptor;
use super::native_result;
use crate::ffi::codec::{Codec, Decoder as _, Encoder as _};
use crate::ffi::{self};

fn execute_call<'e>(
    env: &'e Env,
    descriptor: &CallDescriptor,
    values: &[Unknown<'e>],
) -> anyhow::Result<Unknown<'e>> {
    let label = &descriptor.label;
    let return_codec = &descriptor.return_codec;
    let arg_codecs = &descriptor.arg_codecs;

    let stashes = arg_codecs
        .iter()
        .zip(values)
        .enumerate()
        .map(|(i, (codec, &value))| {
            codec
                .encode(env, value)
                .with_context(|| format!("encoding arg {i} of {label}"))
        })
        .collect::<anyhow::Result<Vec<ffi::Stash>>>()?;

    let mut ffi_args: Vec<libffi::Arg<'_>> = Vec::with_capacity(stashes.len() + 1);
    for stash in &stashes {
        stash.append_libffi_args(&mut ffi_args);
    }

    anyhow::ensure!(
        descriptor.native_arg_count == ffi_args.len(),
        "{label}: the call interface declares {} native arguments but {} were marshalled",
        descriptor.native_arg_count,
        ffi_args.len()
    );

    let result = return_codec
        .call_cif(&descriptor.cif, descriptor.symbol()?, &ffi_args)
        .with_context(|| format!("calling {label}"))?;

    for stash in &stashes {
        stash.disarm_pending_transfer();
    }

    let ref_updates = write_ref_updates(env, arg_codecs, values, &stashes);

    let return_value = return_codec
        .decode_with_context(env, &result, &stashes, arg_codecs)
        .with_context(|| format!("decoding return value of {label}"));

    release_sized_array_return(return_codec, &result);

    ref_updates?;
    return_value
}

fn release_sized_array_return(return_codec: &Codec, result: &ffi::Stash) {
    let Codec::Array(array_codec) = return_codec else {
        return;
    };
    if !array_codec.ownership.is_full() || !array_codec.is_length_bounded() {
        return;
    }
    if let ffi::Stash::Ptr(ptr) = result
        && !ptr.is_null()
    {
        unsafe { glib::ffi::g_free(*ptr) };
    }
}

fn write_ref_updates(
    env: &Env,
    arg_codecs: &[Codec],
    values: &[Unknown<'_>],
    stashes: &[ffi::Stash],
) -> anyhow::Result<()> {
    for (i, (codec, &value)) in arg_codecs.iter().zip(values).enumerate() {
        if matches!(codec, Codec::Ref(_))
            && !matches!(value.get_type()?, ValueType::Null | ValueType::Undefined)
        {
            let new_value = codec.decode_with_context(env, &stashes[i], stashes, arg_codecs)?;
            let mut js_obj = Object::from_raw(env.raw(), value.raw());
            js_obj.set_named_property("value", new_value)?;
        }
    }
    Ok(())
}

/// Invokes a previously bound native function, encoding `values` and decoding the return value
/// according to the call descriptor. Out and inout ('ref') arguments are written back in place.
#[napi(catch_unwind)]
pub fn call<'env>(
    env: &'env Env,
    descriptor: &External<CallDescriptor>,
    values: Array<'_>,
) -> Result<Unknown<'env>> {
    let mut parsed_values: Vec<Unknown<'env>> = Vec::with_capacity(values.len() as usize);
    for i in 0..values.len() {
        let item: Unknown<'env> = values
            .get(i)?
            .ok_or_else(|| Error::new(Status::GenericFailure, "missing argument"))?;
        parsed_values.push(item);
    }
    if parsed_values.len() != descriptor.arg_codecs.len() {
        return Err(Error::new(
            Status::InvalidArg,
            format!(
                "{}: expected {} arguments, received {}",
                descriptor.label,
                descriptor.arg_codecs.len(),
                parsed_values.len()
            ),
        ));
    }
    native_result("FFI call", execute_call(env, descriptor, &parsed_values))
}

#[cfg(test)]
mod tests {
    use test_support::napi_mock;

    use super::*;
    use crate::ffi::codec::IntegerCodec;

    fn descriptor(symbol: &str, arg_codecs: Vec<Codec>, return_codec: Codec) -> CallDescriptor {
        crate::api::bind::prepare(
            crate::api::bind::CallTarget::Symbol {
                library_name: "libgtk-4.so.1".to_owned(),
            },
            symbol.to_owned(),
            arg_codecs,
            return_codec,
            None,
        )
    }

    #[test]
    fn invokes_a_zero_argument_function() {
        test_support::run(|| {
            let env = napi_mock::fake_env();
            let descriptor = descriptor(
                "gtk_get_major_version",
                Vec::new(),
                Codec::Integer(IntegerCodec::U32),
            );
            let value = execute_call(&env, &descriptor, &[]).expect("call should succeed");
            assert_eq!(napi_mock::read_double(value.raw()), Some(4.0));
        });
    }

    #[test]
    fn encodes_arguments_and_decodes_the_return_value() {
        test_support::run(|| {
            let env = napi_mock::fake_env();
            let descriptor = descriptor(
                "g_bit_storage",
                vec![Codec::Integer(IntegerCodec::U64)],
                Codec::Integer(IntegerCodec::U32),
            );
            let arg = napi_mock::to_unknown(&env, napi_mock::fake_double(255.0));
            let value = execute_call(&env, &descriptor, &[arg]).expect("call should succeed");
            assert_eq!(napi_mock::read_double(value.raw()), Some(8.0));
        });
    }

    #[test]
    fn reports_a_missing_symbol() {
        test_support::run(|| {
            let env = napi_mock::fake_env();
            let descriptor = descriptor(
                "gtkx_no_such_symbol",
                Vec::new(),
                Codec::Integer(IntegerCodec::U32),
            );
            assert!(execute_call(&env, &descriptor, &[]).is_err());
        });
    }

    #[test]
    fn reports_a_marshalling_arity_mismatch() {
        test_support::run(|| {
            let env = napi_mock::fake_env();
            let mut descriptor = descriptor(
                "gtk_get_major_version",
                Vec::new(),
                Codec::Integer(IntegerCodec::U32),
            );
            descriptor.native_arg_count = 1;
            assert!(execute_call(&env, &descriptor, &[]).is_err());
        });
    }
}

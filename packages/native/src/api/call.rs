use std::ptr::NonNull;

use anyhow::Context as _;
use libffi::middle as libffi;
use napi::Env;
use napi::bindgen_prelude::*;
use napi_derive::napi;

use super::bind::CallDescriptor;
use super::native_result;
use crate::ffi::closure::ClosureData;
use crate::ffi::codec::{CallbackScope, Codec, Decoder as _, Encoder as _};
use crate::ffi::{self};
use crate::host::log_writer::CriticalTrap;

#[napi(object, object_from_js = false)]
pub struct CallOutput<'env> {
    pub index: u32,
    pub value: Unknown<'env>,
}

#[napi(object, object_from_js = false)]
pub struct CallResult<'env> {
    pub value: Unknown<'env>,
    pub outputs: Vec<CallOutput<'env>>,
}

fn execute_call<'e>(
    env: &'e Env,
    descriptor: &CallDescriptor,
    values: &[Unknown<'e>],
    completion_index: Option<usize>,
) -> anyhow::Result<CallResult<'e>> {
    let _leases = crate::handle::LeaseScope::open();
    let label = &descriptor.label;
    let return_codec = &descriptor.return_codec;
    let arg_codecs = &descriptor.arg_codecs;

    let stashes = arg_codecs
        .iter()
        .zip(values)
        .enumerate()
        .map(|(i, (codec, &value))| {
            let encoded = if completion_index.is_some() {
                codec.encode_owned(env, value)
            } else {
                codec.encode(env, value)
            };

            encoded.with_context(|| format!("encoding arg {i} of {label}"))
        })
        .collect::<anyhow::Result<Vec<ffi::Stash>>>()?;

    let completion = AsyncCompletion::resolve(completion_index, arg_codecs, &stashes)
        .with_context(|| format!("calling {label}"))?;

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

    let symbol = descriptor.symbol()?;
    let trap = CriticalTrap::arm();
    let called = return_codec.call_cif(&descriptor.cif, symbol, &ffi_args);
    let critical = trap.disarm();

    let result = called.with_context(|| format!("calling {label}"))?;

    commit_pending_transfers(completion.as_ref(), arg_codecs, &stashes);

    let outputs = decode_outputs(env, arg_codecs, values, &stashes);

    let return_value = return_codec
        .decode_with_context(env, &result, &stashes, arg_codecs)
        .with_context(|| format!("decoding return value of {label}"));

    release_sized_array_return(return_codec, &result);

    if let Some(completion) = completion {
        completion.retain(stashes);
    }

    let outputs = outputs?;

    if let Some(message) = critical {
        anyhow::bail!("{label}: {message}");
    }

    Ok(CallResult {
        value: return_value?,
        outputs,
    })
}

fn commit_pending_transfers(
    completion: Option<&AsyncCompletion>,
    arg_codecs: &[Codec],
    stashes: &[ffi::Stash],
) {
    for (index, (codec, stash)) in arg_codecs.iter().zip(stashes).enumerate() {
        let releases_with_completion = matches!(
            codec,
            Codec::Callback(callback) if callback.can_release_with_async_completion()
        );

        if releases_with_completion && completion.is_some_and(|value| value.index != index) {
            continue;
        }

        if releases_with_completion {
            stash.retain_forever();
        }

        stash.disarm_pending_transfer();
    }
}

fn completion_callback(stash: &ffi::Stash) -> anyhow::Result<&ffi::CallbackValue> {
    match stash {
        ffi::Stash::Callback(callback) => Ok(callback),
        _ => anyhow::bail!("the completion callback was marshalled as {stash:?}"),
    }
}

fn lends_element_buffer(codec: &Codec, stash: &ffi::Stash) -> bool {
    let borrows_a_buffer = match codec {
        Codec::Array(array) => array.ownership.is_borrowed(),
        Codec::Ref(reference) => reference.inner_codec().is_scalar(),
        Codec::Buffer(_) => true,
        _ => false,
    };

    borrows_a_buffer && stash.owns_element_buffer()
}

struct AsyncCompletion {
    index: usize,
    data: NonNull<ClosureData>,
}

impl AsyncCompletion {
    fn resolve(
        completion_index: Option<usize>,
        arg_codecs: &[Codec],
        stashes: &[ffi::Stash],
    ) -> anyhow::Result<Option<Self>> {
        let Some(index) = completion_index else {
            return Ok(None);
        };
        anyhow::ensure!(
            matches!(arg_codecs.get(index), Some(Codec::Callback(callback)) if callback.scope == CallbackScope::Async),
            "arg {index} must hold a one-shot callback to retain the call's memory"
        );
        let stash = stashes
            .get(index)
            .with_context(|| format!("arg {index} takes the completion callback of the call"))?;

        if let Some(data) = completion_callback(stash)?.closure_data() {
            return Ok(Some(Self {
                index,
                data: NonNull::from(data),
            }));
        }

        for (i, (codec, stash)) in arg_codecs.iter().zip(stashes).enumerate() {
            anyhow::ensure!(
                i == index || !lends_element_buffer(codec, stash),
                "arg {i} lends the callee a buffer that is freed when the call returns, and the \
                 completion callback in arg {index} is null, so nothing reports the moment the \
                 callee is done reading it; pass a completion callback"
            );
        }

        Ok(None)
    }

    fn retain(self, mut stashes: Vec<ffi::Stash>) {
        let completion = stashes.remove(self.index);
        let data = unsafe { self.data.as_ref() };

        for stash in stashes {
            data.retain_container(stash);
        }

        drop(completion);
    }
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

fn decode_outputs<'env>(
    env: &'env Env,
    arg_codecs: &[Codec],
    values: &[Unknown<'env>],
    stashes: &[ffi::Stash],
) -> anyhow::Result<Vec<CallOutput<'env>>> {
    let mut outputs = Vec::new();

    for (i, (codec, &value)) in arg_codecs.iter().zip(values).enumerate() {
        if matches!(codec, Codec::Ref(reference) if !reference.inner_codec().is_scalar())
            && !matches!(value.get_type()?, ValueType::Null | ValueType::Undefined)
        {
            outputs.push(CallOutput {
                index: u32::try_from(i)?,
                value: codec.decode_with_context(env, &stashes[i], stashes, arg_codecs)?,
            });
        }
    }

    Ok(outputs)
}

#[napi(catch_unwind)]
pub fn call<'env>(
    env: &'env Env,
    descriptor: &External<CallDescriptor>,
    values: Array<'_>,
    completion_index: Option<u32>,
) -> Result<CallResult<'env>> {
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
    native_result(
        "FFI call",
        execute_call(
            env,
            descriptor,
            &parsed_values,
            completion_index.map(|index| index as usize),
        ),
    )
}

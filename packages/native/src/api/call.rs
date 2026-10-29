use std::ptr::NonNull;

use anyhow::Context as _;
use libffi::middle as libffi;
use napi::Env;
use napi::bindgen_prelude::*;
use napi_derive::napi;
use smallvec::SmallVec;

use super::bind::FunctionSignature;
use super::native_result;
use super::reference::ReferenceRequest;
use crate::ffi::closure::ClosureData;
use crate::ffi::codec::{CallbackScope, Codec, Decoder as _, Encoder as _};
use crate::ffi::{self};
use crate::handle::Handle;
use crate::host::callback_error::CallbackErrorScope;

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
    signature: &FunctionSignature,
    target: &Handle,
    values: Either<Array<'e>, Function<'e, u32, Unknown<'e>>>,
    completion_index: Option<usize>,
) -> anyhow::Result<CallResult<'e>> {
    let _errors = CallbackErrorScope::open(*env);
    let result = execute_call_inner(env, signature, target, values, completion_index);
    anyhow::ensure!(
        !CallbackErrorScope::has_error(),
        "A native callback threw an exception"
    );
    result
}

fn encode_arguments(
    env: Env,
    signature: &FunctionSignature,
    values: &[Unknown<'_>],
    references: &[Option<ReferenceRequest<'_, '_>>],
    retained: bool,
) -> anyhow::Result<Vec<ffi::Stash>> {
    signature
        .arg_codecs
        .iter()
        .zip(values)
        .zip(references)
        .enumerate()
        .map(|(i, ((codec, &value), reference))| {
            let encoded = if let Some(reference) = reference {
                reference.prepare(&env, retained)
            } else if retained {
                codec.encode_owned(&env, value)
            } else {
                codec.encode(&env, value)
            };
            encoded.with_context(|| format!("encoding arg {i} of {}", signature.label))
        })
        .collect()
}

fn execute_call_inner<'e>(
    env: &'e Env,
    signature: &FunctionSignature,
    target: &Handle,
    values: Either<Array<'e>, Function<'e, u32, Unknown<'e>>>,
    completion_index: Option<usize>,
) -> anyhow::Result<CallResult<'e>> {
    let _leases = crate::handle::LeaseScope::open();
    let label = &signature.label;
    let return_codec = &signature.return_codec;
    let arg_codecs = &signature.arg_codecs;
    let subjects = signature
        .match_info
        .as_ref()
        .map(ffi::match_info::SubjectScope::open);

    if let Either::A(array) = &values {
        anyhow::ensure!(
            array.len() as usize == arg_codecs.len(),
            "{label}: expected {} arguments, received {}",
            arg_codecs.len(),
            array.len()
        );
    }
    let mut parsed_values: SmallVec<[Unknown<'e>; 8]> = SmallVec::with_capacity(arg_codecs.len());
    let mut references = Vec::with_capacity(arg_codecs.len());
    for (index, codec) in arg_codecs.iter().enumerate() {
        let index = u32::try_from(index)?;
        let value = match &values {
            Either::A(array) => array
                .get(index)?
                .ok_or_else(|| anyhow::anyhow!("missing argument"))?,
            Either::B(produce) => produce.call(index).map_err(|error| {
                CallbackErrorScope::deliver(*env, error);
                anyhow::anyhow!("Argument production failed")
            })?,
        };
        if let Some(subjects) = &subjects {
            subjects.capture(index as usize, value)?;
        }
        let reference = match codec {
            Codec::Ref(reference)
                if !reference.inner_codec().is_scalar()
                    && !matches!(value.get_type()?, ValueType::Null | ValueType::Undefined) =>
            {
                Some(
                    ReferenceRequest::capture(reference, value)
                        .with_context(|| format!("preparing arg {index} of {label}"))?,
                )
            }
            _ => None,
        };
        parsed_values.push(value);
        references.push(reference);
    }
    let stashes = encode_arguments(
        *env,
        signature,
        &parsed_values,
        &references,
        completion_index.is_some(),
    )?;
    if let Some(subjects) = &subjects {
        subjects.validate()?;
    }

    let completion = AsyncCompletion::resolve(completion_index, arg_codecs, &stashes)
        .with_context(|| format!("calling {label}"))?;

    let mut ffi_args: SmallVec<[libffi::Arg<'_>; 8]> =
        SmallVec::with_capacity(signature.native_arg_count);
    for stash in &stashes {
        stash.append_libffi_args(&mut ffi_args);
    }

    anyhow::ensure!(
        signature.native_arg_count == ffi_args.len(),
        "{label}: the call interface declares {} native arguments but {} were marshalled",
        signature.native_arg_count,
        ffi_args.len()
    );

    let ordered_args: SmallVec<[libffi::Arg<'_>; 8]> = signature
        .arg_order
        .iter()
        .map(|&index| ffi_args[index].clone())
        .collect();
    drop(ffi_args);

    let symbol = libffi::CodePtr(target.begin_function_call()?);
    let called = return_codec.call_cif(&signature.cif, symbol, &ordered_args);
    drop(ordered_args);

    let result = called.with_context(|| format!("calling {label}"))?;

    commit_pending_transfers(completion.as_ref(), arg_codecs, &stashes);

    let outputs = decode_outputs(env, arg_codecs, &parsed_values, &stashes);

    let return_value = return_codec
        .decode_with_context(env, &result, &stashes, arg_codecs)
        .with_context(|| format!("decoding return value of {label}"));

    release_sized_array_return(return_codec, &result);

    if let Some(completion) = completion {
        completion.retain(stashes);
    }

    Ok(CallResult {
        value: return_value?,
        outputs: outputs?,
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
        Codec::Ref(_) | Codec::Buffer(_) => true,
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
    let mut first_error = None;

    for (i, (codec, &value)) in arg_codecs.iter().zip(values).enumerate() {
        if matches!(codec, Codec::Ref(reference) if !reference.inner_codec().is_scalar())
            && !matches!(value.get_type()?, ValueType::Null | ValueType::Undefined)
        {
            match codec.decode_with_context(env, &stashes[i], stashes, arg_codecs) {
                Ok(value) => outputs.push(CallOutput {
                    index: u32::try_from(i)?,
                    value,
                }),
                Err(error) if first_error.is_none() => first_error = Some(error),
                Err(_) => {}
            }
        }
    }

    match first_error {
        Some(error) => Err(error),
        None => Ok(outputs),
    }
}

/// Calls a compiled signature through an executable handle, checking its lifetime on every call.
/// An argument producer normalizes arguments in order; each reference seed is retained before
/// requesting the next argument. Native buffers are prepared after all arguments are normalized.
#[napi(catch_unwind)]
pub fn call<'env>(
    env: &'env Env,
    signature: &External<FunctionSignature>,
    target: &External<Handle>,
    values: Either<Array<'env>, Function<'env, u32, Unknown<'env>>>,
    completion_index: Option<u32>,
) -> Result<CallResult<'env>> {
    signature.ensure_callable()?;
    native_result(
        "FFI call",
        execute_call(
            env,
            signature,
            target,
            values,
            completion_index.map(|index| index as usize),
        ),
    )
}

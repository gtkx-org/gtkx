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
    let completion_index = completion_callback_index(arg_codecs);

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

    let retained = completion
        .map(|completion| completion.retain(stashes))
        .transpose()
        .with_context(|| format!("retaining the arguments of {label}"));

    ref_updates?;
    retained?;
    return_value
}

fn completion_callback_index(arg_codecs: &[Codec]) -> Option<usize> {
    arg_codecs.iter().position(
        |codec| matches!(codec, Codec::Callback(callback) if callback.is_async_completion()),
    )
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
        Codec::Buffer(_) => true,
        _ => false,
    };

    borrows_a_buffer && stash.owns_element_buffer()
}

struct AsyncCompletion {
    index: usize,
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
        let stash = stashes
            .get(index)
            .with_context(|| format!("arg {index} takes the completion callback of the call"))?;

        if completion_callback(stash)?.closure_data().is_some() {
            return Ok(Some(Self { index }));
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

    fn retain(self, mut stashes: Vec<ffi::Stash>) -> anyhow::Result<()> {
        let completion = stashes.remove(self.index);
        let data = completion_callback(&completion)?
            .closure_data()
            .context("the completion callback lost the closure it was marshalled with")?;

        for stash in stashes {
            data.retain_container(stash);
        }

        Ok(())
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
    use crate::ffi::codec::{
        ArrayBounds, ArrayCodec, ArrayKind, CallbackCodec, CallbackScope, DestroyNotifyKind,
        IntegerCodec, ObjectCodec, Ownership, RefCodec, StringCodec, VoidCodec,
    };

    fn borrowed_object_codec() -> Codec {
        Codec::Object(ObjectCodec {
            ownership: Ownership::Borrowed,
            is_call_scoped: false,
        })
    }

    fn async_callback_codec(
        arg_codecs: Vec<Codec>,
        return_codec: Codec,
        has_user_data: bool,
        user_data_index: Option<usize>,
    ) -> Codec {
        Codec::Callback(CallbackCodec {
            arg_codecs,
            return_codec: Box::new(return_codec),
            has_destroy: false,
            destroy_kind: DestroyNotifyKind::DestroyNotify,
            has_user_data,
            user_data_index,
            scope: CallbackScope::Async,
        })
    }

    fn async_ready_callback_codec() -> Codec {
        async_callback_codec(
            vec![
                borrowed_object_codec(),
                borrowed_object_codec(),
                Codec::Integer(IntegerCodec::U64),
            ],
            Codec::Void(VoidCodec),
            true,
            Some(2),
        )
    }

    fn child_setup_callback_codec() -> Codec {
        async_callback_codec(
            vec![Codec::Integer(IntegerCodec::U64)],
            Codec::Void(VoidCodec),
            true,
            Some(0),
        )
    }

    fn null_completion_stash() -> ffi::Stash {
        ffi::Stash::Callback(ffi::CallbackValue::new(
            std::ptr::null_mut(),
            std::ptr::null_mut(),
            true,
            None,
            None,
        ))
    }

    fn borrowed_string_codec() -> Codec {
        Codec::String(StringCodec {
            ownership: Ownership::Borrowed,
            length: None,
        })
    }

    fn borrowed_bytes_codec() -> Codec {
        Codec::Array(
            ArrayCodec::new(
                Box::new(Codec::Integer(IntegerCodec::U8)),
                ArrayKind::Sized,
                Ownership::Borrowed,
                ArrayBounds::sized(1),
                None,
            )
            .expect("a sized byte array codec"),
        )
    }

    fn lending_async_descriptor() -> CallDescriptor {
        descriptor(
            "gtkx_no_such_symbol",
            vec![
                borrowed_bytes_codec(),
                Codec::Integer(IntegerCodec::U64),
                async_ready_callback_codec(),
            ],
            Codec::Void(VoidCodec),
        )
    }

    fn lending_async_values(env: &Env, callback: sys::napi_value) -> Vec<Unknown<'_>> {
        let bytes =
            napi_mock::fake_array(&[napi_mock::fake_double(1.0), napi_mock::fake_double(2.0)]);

        vec![
            napi_mock::to_unknown(env, bytes),
            napi_mock::to_unknown(env, napi_mock::fake_double(2.0)),
            napi_mock::to_unknown(env, callback),
        ]
    }

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
    fn takes_the_async_ready_callback_as_the_completion_of_the_call() {
        assert_eq!(
            completion_callback_index(&[
                borrowed_object_codec(),
                Codec::Integer(IntegerCodec::U64),
                async_ready_callback_codec(),
            ]),
            Some(2)
        );
    }

    #[test]
    fn takes_no_completion_from_a_child_setup_the_callee_runs_on_its_own() {
        assert_eq!(
            completion_callback_index(&[
                Codec::Integer(IntegerCodec::U32),
                child_setup_callback_codec(),
            ]),
            None
        );
    }

    #[test]
    fn takes_no_completion_from_a_destroy_notify_that_carries_no_user_data() {
        assert_eq!(
            completion_callback_index(&[async_callback_codec(
                vec![Codec::Integer(IntegerCodec::U64)],
                Codec::Void(VoidCodec),
                false,
                Some(0),
            )]),
            None
        );
    }

    #[test]
    fn takes_no_completion_from_a_thread_function_that_returns_a_value() {
        assert_eq!(
            completion_callback_index(&[async_callback_codec(
                vec![Codec::Integer(IntegerCodec::U64)],
                Codec::Integer(IntegerCodec::U64),
                true,
                Some(0),
            )]),
            None
        );
    }

    #[test]
    fn takes_no_completion_from_a_task_thread_function_that_carries_no_user_data() {
        assert_eq!(
            completion_callback_index(&[async_callback_codec(
                vec![
                    borrowed_object_codec(),
                    borrowed_object_codec(),
                    Codec::Integer(IntegerCodec::U64),
                    borrowed_object_codec(),
                ],
                Codec::Void(VoidCodec),
                false,
                None,
            )]),
            None
        );
    }

    #[test]
    fn skips_a_leading_async_callback_that_does_not_complete_the_call() {
        assert_eq!(
            completion_callback_index(&[
                child_setup_callback_codec(),
                borrowed_object_codec(),
                async_ready_callback_codec(),
            ]),
            Some(2)
        );
    }

    #[test]
    fn refuses_an_async_call_that_lends_a_buffer_with_no_completion_callback() {
        test_support::run(|| {
            let env = napi_mock::fake_env();
            let descriptor = lending_async_descriptor();
            let values = lending_async_values(&env, napi_mock::fake_null());
            let Err(error) = execute_call(&env, &descriptor, &values) else {
                panic!("the call should be refused");
            };
            let report = format!("{error:#}");

            assert!(
                report.contains("arg 0 lends the callee a buffer"),
                "{report}"
            );
            assert!(report.contains("pass a completion callback"), "{report}");
            assert!(!report.contains("Failed to find symbol"), "{report}");
        });
    }

    #[test]
    fn makes_the_same_async_call_once_it_is_given_a_completion_callback() {
        test_support::run(|| {
            let env = napi_mock::fake_env();
            let descriptor = lending_async_descriptor();
            let callback = napi_mock::fake_function(|_| napi_mock::fake_undefined());
            let values = lending_async_values(&env, callback);
            let Err(error) = execute_call(&env, &descriptor, &values) else {
                panic!("the missing symbol should be what stops the call");
            };

            assert!(format!("{error:#}").contains("Failed to find symbol"));
        });
    }

    #[test]
    fn takes_an_async_call_with_no_completion_callback_that_lends_a_borrowed_string() {
        test_support::run(|| {
            let env = napi_mock::fake_env();
            let descriptor = descriptor(
                "gtkx_no_such_symbol",
                vec![borrowed_string_codec(), async_ready_callback_codec()],
                Codec::Void(VoidCodec),
            );
            let values = vec![
                napi_mock::to_unknown(&env, napi_mock::fake_string("some-etag")),
                napi_mock::to_unknown(&env, napi_mock::fake_null()),
            ];
            let Err(error) = execute_call(&env, &descriptor, &values) else {
                panic!("the missing symbol should be what stops the call");
            };
            let report = format!("{error:#}");

            assert!(report.contains("Failed to find symbol"), "{report}");
            assert!(!report.contains("pass a completion callback"), "{report}");
        });
    }

    #[test]
    fn takes_an_async_call_whose_only_owned_buffer_is_an_out_parameter() {
        let codecs = vec![
            Codec::Ref(
                RefCodec::new(Codec::Integer(IntegerCodec::U64), false).expect("a Ref codec"),
            ),
            async_ready_callback_codec(),
        ];
        let stashes = vec![
            ffi::Stash::Storage(vec![0u64].into()),
            null_completion_stash(),
        ];

        assert!(
            AsyncCompletion::resolve(Some(1), &codecs, &stashes)
                .expect("an out parameter is written, not lent")
                .is_none()
        );
    }

    #[test]
    fn refuses_a_completion_argument_that_was_not_marshalled_as_a_callback() {
        let codecs = vec![borrowed_bytes_codec(), async_ready_callback_codec()];
        let stashes = vec![
            ffi::Stash::Storage(vec![1u8, 2, 3].into()),
            ffi::Stash::Void,
        ];

        assert!(AsyncCompletion::resolve(Some(1), &codecs, &stashes).is_err());
    }

    #[test]
    fn refuses_a_completion_argument_that_was_never_marshalled() {
        let codecs = vec![borrowed_bytes_codec(), async_ready_callback_codec()];

        assert!(AsyncCompletion::resolve(Some(1), &codecs, &[ffi::Stash::Void]).is_err());
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

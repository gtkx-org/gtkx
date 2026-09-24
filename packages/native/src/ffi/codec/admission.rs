use super::{CallbackScope, Codec, Ownership};

#[derive(Clone, Copy, PartialEq, Eq)]
enum InlineRecordCapability {
    ValueSafe,
    Ownable,
    Lent,
    Unsupported,
}

#[derive(Clone, Copy)]
enum Flow {
    ToNative { retained: bool },
    FromNative { lent: bool, caller_owned: bool },
}

fn inline_record_capability(codec: &Codec) -> InlineRecordCapability {
    match codec {
        Codec::Boxed(boxed) if boxed.value_safe => InlineRecordCapability::ValueSafe,
        Codec::Boxed(boxed)
            if boxed.shared_library.is_some() && boxed.get_type_fn_name.is_some() =>
        {
            InlineRecordCapability::Ownable
        }
        Codec::Struct(struct_) if struct_.value_safe => InlineRecordCapability::ValueSafe,
        Codec::Struct(struct_)
            if struct_.shared_library.is_some()
                && struct_.copy_fn_name.is_some()
                && struct_.free_fn_name.is_some() =>
        {
            InlineRecordCapability::Ownable
        }
        Codec::Boxed(_) | Codec::Struct(_) => InlineRecordCapability::Lent,
        Codec::Fundamental(fundamental) if fundamental.value_safe => {
            InlineRecordCapability::ValueSafe
        }
        Codec::Fundamental(_) => InlineRecordCapability::Ownable,
        Codec::Object(_)
        | Codec::Integer(_)
        | Codec::BigInt(_)
        | Codec::Float(_)
        | Codec::Bytes(_)
        | Codec::Void(_)
        | Codec::Array(_)
        | Codec::Buffer(_)
        | Codec::HashTable(_)
        | Codec::Callback(_)
        | Codec::Ref(_) => InlineRecordCapability::Unsupported,
    }
}

fn validate_inline_array(array: &super::ArrayCodec, flow: Flow) -> anyhow::Result<()> {
    if !array.has_inline_record_items() {
        return Ok(());
    }

    anyhow::ensure!(
        array.is_flat_inline_container() || array.is_garray_container(),
        "Inline record items require a flat C array or GArray container"
    );

    let capability = inline_record_capability(&array.item_codec);
    anyhow::ensure!(
        capability != InlineRecordCapability::Unsupported,
        "The array item codec has no inline record storage contract"
    );

    if capability == InlineRecordCapability::ValueSafe {
        return Ok(());
    }

    match flow {
        Flow::ToNative { retained } if !retained && array.ownership == Ownership::Borrowed => {
            Ok(())
        }
        Flow::FromNative {
            lent: true,
            caller_owned: false,
        } if array.ownership == Ownership::Borrowed => Ok(()),
        Flow::FromNative {
            caller_owned: false,
            ..
        } if capability == InlineRecordCapability::Ownable
            && (array.item_codec.transfer().is_borrowed()
                || (array.ownership == Ownership::Full && array.is_garray_container())) =>
        {
            Ok(())
        }
        Flow::ToNative { retained: true } => {
            anyhow::bail!("Inline resource items cannot outlive their source values")
        }
        Flow::ToNative { retained: false } => {
            anyhow::bail!("Inline resource items cannot be transferred to native code")
        }
        Flow::FromNative {
            caller_owned: true, ..
        } => anyhow::bail!("Caller-owned inline resource items cannot be decoded safely"),
        Flow::FromNative { .. } => {
            anyhow::bail!("Inline resource items cannot be owned independently in this position")
        }
    }
}

fn validate_flow(codec: &Codec, flow: Flow) -> anyhow::Result<()> {
    match codec {
        Codec::Array(array) => validate_inline_array(array, flow),
        Codec::Callback(callback) => {
            validate_inline_callback_signature(&callback.arg_codecs, &callback.return_codec)
        }
        Codec::Ref(reference) => validate_flow(reference.inner_codec(), flow),
        _ => Ok(()),
    }
}

fn validate_call_argument(codec: &Codec, retained: bool) -> anyhow::Result<()> {
    match codec {
        Codec::Ref(reference) => {
            if reference.is_inout() {
                validate_flow(reference.inner_codec(), Flow::ToNative { retained })?;
                validate_flow(
                    reference.inner_codec(),
                    Flow::FromNative {
                        lent: false,
                        caller_owned: true,
                    },
                )
            } else {
                validate_flow(
                    reference.inner_codec(),
                    Flow::FromNative {
                        lent: false,
                        caller_owned: false,
                    },
                )
            }
        }
        Codec::Array(array) if array.caller_allocated => validate_flow(
            codec,
            Flow::FromNative {
                lent: false,
                caller_owned: true,
            },
        ),
        _ => validate_flow(codec, Flow::ToNative { retained }),
    }
}

fn validate_callback_argument(codec: &Codec) -> anyhow::Result<()> {
    match codec {
        Codec::Ref(reference) => {
            if reference.is_inout() {
                validate_flow(
                    reference.inner_codec(),
                    Flow::FromNative {
                        lent: true,
                        caller_owned: false,
                    },
                )?;
            }
            validate_flow(reference.inner_codec(), Flow::ToNative { retained: true })
        }
        _ => validate_flow(
            codec,
            Flow::FromNative {
                lent: true,
                caller_owned: false,
            },
        ),
    }
}

pub(crate) fn validate_call_signature(
    arg_codecs: &[Codec],
    return_codec: &Codec,
) -> anyhow::Result<()> {
    let retained = arg_codecs.iter().any(
        |codec| matches!(codec, Codec::Callback(callback) if callback.scope == CallbackScope::Async),
    );

    for codec in arg_codecs {
        validate_call_argument(codec, retained)?;
    }

    validate_flow(
        return_codec,
        Flow::FromNative {
            lent: false,
            caller_owned: false,
        },
    )
}

fn validate_inline_callback_signature(
    arg_codecs: &[Codec],
    return_codec: &Codec,
) -> anyhow::Result<()> {
    for codec in arg_codecs {
        validate_callback_argument(codec)?;
    }

    validate_flow(return_codec, Flow::ToNative { retained: true })
}

pub(crate) fn validate_callback_signature(
    arg_codecs: &[Codec],
    return_codec: &Codec,
) -> anyhow::Result<()> {
    super::validate_callback_outputs(arg_codecs, return_codec)?;
    validate_inline_callback_signature(arg_codecs, return_codec)
}

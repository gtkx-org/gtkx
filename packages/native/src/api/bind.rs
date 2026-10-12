use libffi::middle::{Builder, Cif, Type};
use napi::bindgen_prelude::*;
use napi_derive::napi;

use crate::ffi::codec::{Codec, Encoder as _, validate_call_signature};
use crate::ffi::descriptor::Descriptor;

pub struct CallSignature {
    pub(crate) label: String,
    pub(crate) arg_codecs: Vec<Codec>,
    pub(crate) return_codec: Codec,
    pub(crate) cif: Cif,
    pub(crate) native_arg_count: usize,
    pub(crate) arg_order: Vec<usize>,
}

/// The native argument positions of the values encoded by the descriptors, including callback
/// data and destroy arguments. A variadic fixed count is expressed after this expansion.
#[napi(object, object_to_js = false)]
pub struct CallLayout {
    pub arg_order: Vec<u32>,
    pub fixed_arg_count: Option<u32>,
}

fn build_arg_types(arg_codecs: &[Codec]) -> Vec<Type> {
    let mut arg_types = Vec::with_capacity(arg_codecs.len());
    for codec in arg_codecs {
        codec.append_ffi_arg_types(&mut arg_types);
    }
    arg_types
}

fn validate_argument_order(layout: CallLayout, count: usize) -> Result<Vec<usize>> {
    if layout.arg_order.len() != count {
        return Err(Error::from_reason(
            "Argument order must contain every native argument",
        ));
    }
    let mut seen = vec![false; count];
    let mut order = Vec::with_capacity(count);
    for index in layout.arg_order {
        let index = index as usize;
        let slot = seen.get_mut(index).ok_or_else(|| {
            Error::from_reason("Argument order index exceeds the native signature")
        })?;
        if std::mem::replace(slot, true) {
            return Err(Error::from_reason("Argument order indices must be unique"));
        }
        order.push(index);
    }
    if layout
        .fixed_arg_count
        .is_some_and(|fixed| fixed as usize > count)
    {
        return Err(Error::from_reason(
            "fixedArgCount exceeds the number of native arguments",
        ));
    }
    Ok(order)
}

fn prepare(
    label: String,
    arg_codecs: Vec<Codec>,
    return_codec: Codec,
    layout: CallLayout,
) -> Result<CallSignature> {
    let arg_types = build_arg_types(&arg_codecs);
    let native_arg_count = arg_types.len();
    let fixed_arg_count = layout.fixed_arg_count;
    let arg_order = validate_argument_order(layout, native_arg_count)?;
    let arg_types: Vec<Type> = arg_order
        .iter()
        .map(|&index| arg_types[index].clone())
        .collect();
    let return_type = return_codec.libffi_type();
    let cif = match fixed_arg_count {
        Some(fixed) => Cif::new_variadic(arg_types, fixed as usize, return_type),
        None => Builder::new().res(return_type).args(arg_types).into_cif(),
    };

    Ok(CallSignature {
        label,
        arg_codecs,
        return_codec,
        cif,
        native_arg_count,
        arg_order,
    })
}

fn into_codecs(
    arg_descriptors: Vec<Descriptor>,
    return_descriptor: Descriptor,
) -> Result<(Vec<Codec>, Codec)> {
    let arg_codecs = arg_descriptors
        .into_iter()
        .map(Descriptor::into_codec)
        .collect::<Result<Vec<_>>>()?;
    let return_codec = return_descriptor.into_codec()?;
    validate_call_signature(&arg_codecs, &return_codec)
        .map_err(|error| Error::from_reason(error.to_string()))?;

    Ok((arg_codecs, return_codec))
}

/// Validates and compiles argument and return marshalling without resolving a call target.
/// `layout` supplies the runtime-planned argument ordering and expanded variadic fixed count.
#[napi(catch_unwind)]
pub fn compile_call(
    arg_descriptors: Vec<Descriptor>,
    return_descriptor: Descriptor,
    label: String,
    layout: CallLayout,
) -> Result<External<CallSignature>> {
    let (arg_codecs, return_codec) = into_codecs(arg_descriptors, return_descriptor)?;
    let signature = prepare(label, arg_codecs, return_codec, layout)?;
    Ok(External::new(signature))
}

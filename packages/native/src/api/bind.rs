use std::ops::Deref;
use std::rc::Rc;

use libffi::middle::{Builder, Cif, Type};
use napi::bindgen_prelude::*;
use napi_derive::napi;

use crate::ffi::codec::{
    Codec, Encoder as _, validate_call_signature, validate_callback_signature,
};
use crate::ffi::descriptor::Descriptor;

#[derive(Clone)]
pub struct FunctionSignature(Rc<FunctionPlan>);

impl FromNapiValue for FunctionSignature {
    unsafe fn from_napi_value(env: sys::napi_env, value: sys::napi_value) -> Result<Self> {
        let signature = unsafe { <&External<Self>>::from_napi_value(env, value)? };
        Ok((**signature).clone())
    }
}

pub struct FunctionPlan {
    pub(crate) label: String,
    pub(crate) arg_codecs: Vec<Codec>,
    pub(crate) return_codec: Codec,
    pub(crate) cif: Cif,
    pub(crate) native_arg_count: usize,
    pub(crate) arg_order: Vec<usize>,
    pub(crate) user_data_index: Option<usize>,
    pub(crate) can_throw: bool,
    call_error: Option<String>,
    callback_error: Option<String>,
}

impl FunctionSignature {
    pub(crate) fn ensure_callable(&self) -> Result<()> {
        if self.can_throw {
            return Err(Error::from_reason(
                "A callback signature with an implicit error argument cannot be called",
            ));
        }
        match &self.call_error {
            Some(error) => Err(Error::from_reason(error.clone())),
            None => Ok(()),
        }
    }

    pub(crate) fn ensure_callback(&self) -> Result<()> {
        match &self.callback_error {
            Some(error) => Err(Error::from_reason(error.clone())),
            None => Ok(()),
        }
    }
}

impl Deref for FunctionSignature {
    type Target = FunctionPlan;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl std::fmt::Debug for FunctionSignature {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter
            .debug_struct("FunctionSignature")
            .field("label", &self.label)
            .finish_non_exhaustive()
    }
}

/// Callback-specific interpretation of a signature's arguments and error result.
#[napi(object, object_to_js = false)]
#[derive(Clone, Copy)]
pub struct CallbackOptions {
    pub user_data_index: Option<u32>,
    pub can_throw: Option<bool>,
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

pub(crate) fn prepare(
    label: String,
    arg_codecs: Vec<Codec>,
    return_codec: Codec,
    mut layout: CallLayout,
    callback: Option<CallbackOptions>,
) -> Result<FunctionSignature> {
    let can_throw = callback
        .as_ref()
        .and_then(|options| options.can_throw)
        .unwrap_or(false);
    let user_data_index = callback
        .as_ref()
        .and_then(|options| options.user_data_index)
        .map(|index| index as usize);
    if user_data_index.is_some_and(|index| index >= arg_codecs.len()) {
        return Err(Error::from_reason(
            "Callback user data index exceeds its argument descriptors",
        ));
    }
    if callback.is_some() && layout.fixed_arg_count.is_some() {
        return Err(Error::from_reason(
            "A callback cannot have a variadic signature",
        ));
    }
    let call_error = validate_call_signature(&arg_codecs, &return_codec)
        .err()
        .map(|error| error.to_string());
    let callback_error = if layout.fixed_arg_count.is_some() {
        Some("A callback cannot have a variadic signature".to_owned())
    } else {
        validate_callback_signature(&arg_codecs, &return_codec)
            .err()
            .map(|error| error.to_string())
    };
    if let Some(error) = if callback.is_some() {
        &callback_error
    } else {
        &call_error
    } {
        return Err(Error::from_reason(error.clone()));
    }
    let mut arg_types = build_arg_types(&arg_codecs);
    if can_throw {
        let error_index = u32::try_from(arg_types.len())
            .map_err(|_| Error::from_reason("The signature has too many native arguments"))?;
        layout.arg_order.push(error_index);
        arg_types.push(Type::pointer());
    }
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

    Ok(FunctionSignature(Rc::new(FunctionPlan {
        label,
        arg_codecs,
        return_codec,
        cif,
        native_arg_count,
        arg_order,
        user_data_index,
        can_throw,
        call_error,
        callback_error,
    })))
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
    Ok((arg_codecs, return_codec))
}

/// Validates and compiles argument and return marshalling without resolving a call target.
/// `layout` supplies the runtime-planned argument ordering and expanded variadic fixed count.
#[napi(catch_unwind)]
pub fn bind_function(
    arg_descriptors: Vec<Descriptor>,
    return_descriptor: Descriptor,
    label: String,
    layout: CallLayout,
    callback: Option<CallbackOptions>,
) -> Result<External<FunctionSignature>> {
    let (arg_codecs, return_codec) = into_codecs(arg_descriptors, return_descriptor)?;
    let signature = prepare(label, arg_codecs, return_codec, layout, callback)?;
    Ok(External::new(signature))
}

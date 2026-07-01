use std::{ffi::c_void, sync::Arc};

use anyhow::Context as _;
use libffi::middle as libffi;
use napi::Env;
use napi::bindgen_prelude::*;
use napi_derive::napi;

use super::bind::CallDescriptor;
use super::{RefUpdate, Request};
use crate::ffi::{
    self, Arg,
    codec::{ArrayKind, Codec, Decoder as _, Encoder as _},
    library_cache::GlibThreadState,
    value::Value,
};

pub struct CallRequest {
    pub descriptor: Arc<CallDescriptor>,
    pub values: Vec<Value>,
}

impl Request for CallRequest {
    type Output = (Value, Vec<RefUpdate>);

    fn execute(self) -> anyhow::Result<(Value, Vec<RefUpdate>)> {
        let args: Vec<Arg> = self
            .descriptor
            .arg_codecs
            .iter()
            .cloned()
            .zip(self.values)
            .map(|(codec, value)| Arg::new(codec, value))
            .collect();
        let symbol_name = &self.descriptor.symbol_name;
        let return_codec = &self.descriptor.return_codec;

        let stashed_values = args
            .iter()
            .enumerate()
            .map(|(i, arg)| {
                arg.codec
                    .encode(&arg.value)
                    .with_context(|| format!("encoding arg {i} of {symbol_name}"))
            })
            .collect::<anyhow::Result<Vec<ffi::StashedValue>>>()?;

        let mut ffi_args: Vec<libffi::Arg> = Vec::with_capacity(stashed_values.len() + 1);
        for stashed_value in &stashed_values {
            stashed_value.append_libffi_args(&mut ffi_args);
        }

        let (cif, symbol_ptr) = GlibThreadState::with::<_, anyhow::Result<_>>(|state| {
            let cif = state.cached_cif(self.descriptor.id, || {
                let mut arg_types: Vec<libffi::Type> =
                    Vec::with_capacity(self.descriptor.arg_codecs.len());
                for codec in &self.descriptor.arg_codecs {
                    codec.append_ffi_arg_types(&mut arg_types);
                }
                libffi::Builder::new()
                    .res(return_codec.libffi_type())
                    .args(arg_types)
                    .into_cif()
            });

            let library = state.library(&self.descriptor.library_name)?;
            let symbol =
                unsafe { library.get::<unsafe extern "C" fn() -> ()>(symbol_name.as_bytes())? };
            let ptr = *symbol as *mut c_void;
            Ok((cif, libffi::CodePtr(ptr)))
        })?;

        let result = return_codec
            .call_cif(&cif, symbol_ptr, &ffi_args)
            .with_context(|| format!("calling {symbol_name}"))?;

        for stashed_value in &stashed_values {
            stashed_value.disarm_pending_transfer();
        }

        let ref_updates = Self::collect_ref_updates(&args, &stashed_values);

        let return_value = return_codec
            .decode_with_context(&result, &stashed_values, &args)
            .with_context(|| format!("decoding return value of {symbol_name}"));

        Self::release_sized_array_return(return_codec, &result);

        let ref_updates = ref_updates?;
        let return_value = return_value?;
        Ok((return_value, ref_updates))
    }

    fn error_context() -> &'static str {
        "FFI call"
    }
}

impl CallRequest {
    fn release_sized_array_return(result_codec: &Codec, result: &ffi::StashedValue) {
        let Codec::Array(array_codec) = result_codec else {
            return;
        };
        if !array_codec.ownership.is_full()
            || !matches!(array_codec.kind, ArrayKind::Sized | ArrayKind::Fixed)
        {
            return;
        }
        if let ffi::StashedValue::Ptr(ptr) = result
            && !ptr.is_null()
        {
            unsafe { glib::ffi::g_free(*ptr) };
        }
    }

    fn collect_ref_updates(
        args: &[Arg],
        stashed_values: &[ffi::StashedValue],
    ) -> anyhow::Result<Vec<RefUpdate>> {
        let mut ref_updates = Vec::new();
        for (i, arg) in args.iter().enumerate() {
            if let Value::Ref(ref_val) = &arg.value {
                let new_value =
                    arg.codec
                        .decode_with_context(&stashed_values[i], stashed_values, args)?;
                ref_updates.push((Arc::clone(&ref_val.js_obj), new_value));
            }
        }
        Ok(ref_updates)
    }
}

pub mod napi_export {
    use super::*;

    #[napi(catch_unwind)]
    pub fn call<'env>(
        env: &'env Env,
        descriptor: &External<Arc<CallDescriptor>>,
        values: Array,
    ) -> napi::Result<Unknown<'env>> {
        let descriptor: Arc<CallDescriptor> = Arc::clone(descriptor);
        let parsed_values = crate::ffi::value::map_js_array(env, &values, Value::from_js_value)?;
        if parsed_values.len() != descriptor.arg_codecs.len() {
            return Err(napi::Error::new(
                napi::Status::InvalidArg,
                format!(
                    "{}: expected {} arguments, received {}",
                    descriptor.symbol_name,
                    descriptor.arg_codecs.len(),
                    parsed_values.len()
                ),
            ));
        }
        let request = CallRequest {
            descriptor,
            values: parsed_values,
        };
        request.dispatch(env)
    }
}

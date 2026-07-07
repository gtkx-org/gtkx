use std::{ffi::c_void, sync::Arc};

use anyhow::Context as _;
use libffi::middle as libffi;
use napi::Env;
use napi::bindgen_prelude::*;
use napi_derive::napi;

use super::bind::CallDescriptor;
use super::{RefUpdate, Request};
use crate::ffi::{
    self,
    codec::{Codec, Decoder as _, Encoder as _},
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
        let symbol_name = &self.descriptor.symbol_name;
        let return_codec = &self.descriptor.return_codec;
        let arg_codecs = &self.descriptor.arg_codecs;
        let values = &self.values;

        let stashes = arg_codecs
            .iter()
            .zip(values)
            .enumerate()
            .map(|(i, (codec, value))| {
                codec
                    .encode(value)
                    .with_context(|| format!("encoding arg {i} of {symbol_name}"))
            })
            .collect::<anyhow::Result<Vec<ffi::Stash>>>()?;

        let mut ffi_args: Vec<libffi::Arg> = Vec::with_capacity(stashes.len() + 1);
        for stash in &stashes {
            stash.append_libffi_args(&mut ffi_args);
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

            let symbol = state.resolve_symbol::<unsafe extern "C" fn() -> ()>(
                &self.descriptor.library_name,
                symbol_name,
            )?;
            let ptr = symbol as *mut c_void;
            Ok((cif, libffi::CodePtr(ptr)))
        })?;

        let result = return_codec
            .call_cif(&cif, symbol_ptr, &ffi_args)
            .with_context(|| format!("calling {symbol_name}"))?;

        for stash in &stashes {
            stash.disarm_pending_transfer();
        }

        let ref_updates = Self::collect_ref_updates(arg_codecs, values, &stashes);

        let return_value = return_codec
            .decode_with_context(&result, &stashes, arg_codecs)
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

    fn collect_ref_updates(
        arg_codecs: &[Codec],
        values: &[Value],
        stashes: &[ffi::Stash],
    ) -> anyhow::Result<Vec<RefUpdate>> {
        let mut ref_updates = Vec::new();
        for (i, (codec, value)) in arg_codecs.iter().zip(values).enumerate() {
            if let Value::Ref(ref_val) = value {
                let new_value = codec.decode_with_context(&stashes[i], stashes, arg_codecs)?;
                ref_updates.push((ref_val.js_obj.clone(), new_value));
            }
        }
        Ok(ref_updates)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ffi::codec::IntegerCodec;
    use crate::request::bind::CallDescriptor;

    fn descriptor(
        id: u64,
        symbol: &str,
        arg_codecs: Vec<Codec>,
        return_codec: Codec,
    ) -> Arc<CallDescriptor> {
        Arc::new(CallDescriptor {
            id,
            library_name: "libgtk-4.so.1".to_owned(),
            symbol_name: symbol.to_owned(),
            arg_codecs,
            return_codec,
        })
    }

    #[test]
    fn execute_invokes_a_zero_argument_function() {
        test_support::run(|| {
            let request = CallRequest {
                descriptor: descriptor(
                    1,
                    "gtk_get_major_version",
                    Vec::new(),
                    Codec::Integer(IntegerCodec::U32),
                ),
                values: Vec::new(),
            };
            let (value, ref_updates) = request.execute().expect("call should succeed");
            assert!(ref_updates.is_empty());
            assert!(matches!(value, Value::Number(major) if major == 4.0));
        });
    }

    #[test]
    fn execute_encodes_arguments_and_decodes_the_return_value() {
        test_support::run(|| {
            let request = CallRequest {
                descriptor: descriptor(
                    2,
                    "g_bit_storage",
                    vec![Codec::Integer(IntegerCodec::U64)],
                    Codec::Integer(IntegerCodec::U32),
                ),
                values: vec![Value::Number(255.0)],
            };
            let (value, _) = request.execute().expect("call should succeed");
            assert!(matches!(value, Value::Number(bits) if bits == 8.0));
        });
    }

    #[test]
    fn execute_reports_a_missing_symbol() {
        test_support::run(|| {
            let request = CallRequest {
                descriptor: descriptor(
                    3,
                    "gtkx_no_such_symbol",
                    Vec::new(),
                    Codec::Integer(IntegerCodec::U32),
                ),
                values: Vec::new(),
            };
            assert!(request.execute().is_err());
        });
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

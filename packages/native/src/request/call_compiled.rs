use napi::Env;
use napi::bindgen_prelude::*;
use napi_derive::napi;

use super::NativeRequest;
use super::call::CallRequest;
use super::compile_signature::CompiledSignature;
use crate::ffi::arg::Arg;
use crate::ffi::value::Value;

#[cfg_attr(coverage_nightly, coverage(off))]
#[allow(clippy::wildcard_imports)]
mod napi_export {
    use super::*;

    #[napi(catch_unwind)]
    #[cfg_attr(test, allow(dead_code))]
    pub fn call_compiled<'env>(
        env: &'env Env,
        library: String,
        symbol: String,
        compiled: &External<CompiledSignature>,
        values: Array,
    ) -> napi::Result<Unknown<'env>> {
        let signature: &CompiledSignature = compiled;
        let parsed_values = crate::ffi::value::map_js_array(env, &values, Value::from_js_value)?;
        if parsed_values.len() != signature.arg_types.len() {
            return Err(napi::Error::new(
                napi::Status::InvalidArg,
                format!(
                    "{symbol}: expected {} arguments, received {}",
                    signature.arg_types.len(),
                    parsed_values.len()
                ),
            ));
        }
        let args = signature
            .arg_types
            .iter()
            .cloned()
            .zip(parsed_values)
            .map(|(ty, value)| Arg::new(ty, value))
            .collect();
        let request = CallRequest {
            library_name: library,
            symbol_name: symbol,
            args,
            result_type: signature.result_type.clone(),
        };
        request.dispatch(env)
    }
}

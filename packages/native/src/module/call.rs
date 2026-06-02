//! FFI function call execution.
//!
//! This module implements [`call`], which executes native function calls via
//! libffi. This is the core mechanism for invoking GTK and `GLib` functions from
//! JavaScript.
//!
//! ## Call Flow
//!
//! 1. Parse library name, symbol name, arguments, and return type from JS
//! 2. Convert arguments to [`ffi::FfiValue`] representations
//! 3. Build a libffi CIF (Call Interface) with proper type signatures
//! 4. Load the library and resolve the symbol on the `GLib` thread
//! 5. Execute the FFI call with proper type dispatching
//! 6. Convert the result back to a [`Value`] for JavaScript
//! 7. Update any `Ref` type out-parameters with modified values
//!
//! ## Callbacks
//!
//! Special handling is required for callback arguments (`AsyncReady`, Destroy,
//! `DrawFunc`). These expand to multiple FFI arguments: the callback function
//! pointer, user data, and optionally a destroy notify.

use std::{ffi::c_void, sync::Arc};

use anyhow::Context as _;
use libffi::middle as libffi;
use napi::Env;
use napi::bindgen_prelude::*;
use napi_derive::napi;

use super::handler::{ModuleRequest, RefUpdate};
use crate::{
    arg::Arg,
    ffi,
    state::GlibThreadState,
    types::{FfiEncoder as _, Type},
    value::Value,
};

#[cfg_attr(test, allow(dead_code))]
struct CallRequest {
    library_name: String,
    symbol_name: String,
    args: Vec<Arg>,
    result_type: Type,
}

impl ModuleRequest for CallRequest {
    type Output = (Value, Vec<RefUpdate>);

    fn execute(self) -> anyhow::Result<(Value, Vec<RefUpdate>)> {
        let mut arg_types: Vec<libffi::Type> = Vec::with_capacity(self.args.len() + 1);
        for arg in &self.args {
            arg.ty.append_ffi_arg_types(&mut arg_types);
        }

        let cif = libffi::Builder::new()
            .res(self.result_type.libffi_type())
            .args(arg_types)
            .into_cif();

        let ffi_values = self
            .args
            .iter()
            .enumerate()
            .map(|(i, arg)| {
                arg.ty
                    .encode(&arg.value, arg.optional)
                    .with_context(|| format!("encoding arg {} of {}", i, self.symbol_name))
            })
            .collect::<anyhow::Result<Vec<ffi::FfiValue>>>()?;

        let mut ffi_args: Vec<libffi::Arg> = Vec::with_capacity(ffi_values.len() + 1);
        for ffi_value in &ffi_values {
            ffi_value.append_libffi_args(&mut ffi_args);
        }

        let symbol_ptr = unsafe {
            GlibThreadState::with::<_, anyhow::Result<libffi::CodePtr>>(|state| {
                let library = state.library(&self.library_name)?;
                let symbol =
                    library.get::<unsafe extern "C" fn() -> ()>(self.symbol_name.as_bytes())?;

                let ptr = *symbol as *mut c_void;
                Ok(libffi::CodePtr(ptr))
            })?
        };

        let result = self
            .result_type
            .call_cif(&cif, symbol_ptr, &ffi_args)
            .with_context(|| format!("calling {}", self.symbol_name))?;

        let ref_updates = self.collect_ref_updates(&ffi_values)?;

        let return_value =
            Value::from_ffi_value_with_args(&result, &self.result_type, &ffi_values, &self.args)
                .with_context(|| format!("decoding return value of {}", self.symbol_name))?;
        Ok((return_value, ref_updates))
    }

    fn error_context() -> &'static str {
        "FFI call"
    }
}

impl CallRequest {
    /// Collects the out-parameter write-backs for `Ref`-typed arguments.
    ///
    /// Excluded from coverage instrumentation: a `Value::Ref` carries an
    /// `Arc<JsRef<JsObject>>`, which only exists when a live JavaScript runtime
    /// produced it, so this path cannot run under `cargo test`.
    #[cfg_attr(coverage_nightly, coverage(off))]
    fn collect_ref_updates(&self, ffi_values: &[ffi::FfiValue]) -> anyhow::Result<Vec<RefUpdate>> {
        let mut ref_updates = Vec::new();
        for (i, arg) in self.args.iter().enumerate() {
            if let Value::Ref(ref_val) = &arg.value {
                let new_value = Value::from_ffi_value_with_args(
                    &ffi_values[i],
                    &arg.ty,
                    ffi_values,
                    &self.args,
                )?;
                ref_updates.push((Arc::clone(&ref_val.js_obj), new_value));
            }
        }
        Ok(ref_updates)
    }
}

/// napi export shim. Excluded from coverage instrumentation: it parses JS
/// arguments through a live [`napi::Env`]. The [`CallRequest::execute`] logic
/// it dispatches is exercised directly by tests.
#[cfg_attr(coverage_nightly, coverage(off))]
#[allow(clippy::wildcard_imports)]
mod napi_export {
    use super::*;

    #[napi(catch_unwind)]
    #[cfg_attr(test, allow(dead_code))]
    pub fn call<'env>(
        env: &'env Env,
        library: String,
        symbol: String,
        args: Array,
        return_type: Unknown<'_>,
    ) -> napi::Result<Unknown<'env>> {
        let parsed_args = Arg::from_js_array(env, &args)?;
        let result_type = Type::from_js_value(env, return_type)?;
        if !result_type.can_be_return_type() {
            return Err(napi::Error::new(
                napi::Status::InvalidArg,
                format!("'{result_type}' cannot be used as a function return type"),
            ));
        }
        let request = CallRequest {
            library_name: library,
            symbol_name: symbol,
            args: parsed_args,
            result_type,
        };
        request.dispatch(env)
    }
}

#[cfg(test)]
mod tests {
    use crate::types::{ArrayKind, ArrayType, IntegerKind, Ownership, RefType, StringType};

    use super::*;

    fn int_arg(value: f64) -> Arg {
        Arg::new(Type::Integer(IntegerKind::I32), Value::Number(value))
    }

    #[test]
    fn execute_runs_a_real_ffi_call() {
        let request = CallRequest {
            library_name: "libglib-2.0.so.0".into(),
            symbol_name: "g_random_int_range".into(),
            args: vec![int_arg(10.0), int_arg(20.0)],
            result_type: Type::Integer(IntegerKind::I32),
        };
        let (value, ref_updates) = request.execute().expect("FFI call should succeed");
        assert!(ref_updates.is_empty());
        let n = value.as_number().expect("result should be a number");
        assert!((10.0..20.0).contains(&n));
    }

    #[test]
    fn execute_fails_for_unknown_symbol() {
        let request = CallRequest {
            library_name: "libglib-2.0.so.0".into(),
            symbol_name: "g_no_such_symbol_12345".into(),
            args: vec![],
            result_type: Type::Integer(IntegerKind::I32),
        };
        assert!(request.execute().is_err());
    }

    #[test]
    fn execute_fails_when_an_argument_cannot_be_encoded() {
        let request = CallRequest {
            library_name: "libglib-2.0.so.0".into(),
            symbol_name: "g_random_int_range".into(),
            args: vec![Arg::new(
                Type::Integer(IntegerKind::I32),
                Value::String("not a number".into()),
            )],
            result_type: Type::Integer(IntegerKind::I32),
        };
        let err = request
            .execute()
            .expect_err("encoding a string as an integer should fail");
        assert!(err.to_string().contains("encoding arg 0"));
    }

    #[test]
    fn execute_fails_when_result_type_cannot_occupy_return_slot() {
        let request = CallRequest {
            library_name: "libglib-2.0.so.0".into(),
            symbol_name: "g_random_int".into(),
            args: vec![],
            result_type: Type::Ref(RefType::new(Type::Integer(IntegerKind::I32))),
        };
        let err = request
            .execute()
            .expect_err("a ref return type should fail the call");
        assert!(err.to_string().contains("calling g_random_int"));
    }

    #[test]
    fn execute_fails_when_return_value_cannot_be_decoded() {
        let request = CallRequest {
            library_name: "libglib-2.0.so.0".into(),
            symbol_name: "g_strdup".into(),
            args: vec![Arg::new(
                Type::String(StringType {
                    ownership: Ownership::Borrowed,
                    length: None,
                }),
                Value::Null,
            )],
            result_type: Type::Array(ArrayType {
                item_type: Box::new(Type::Integer(IntegerKind::U8)),
                kind: ArrayKind::Sized { size_index: 9 },
                ownership: Ownership::Borrowed,
                element_size: None,
            }),
        };
        let err = request
            .execute()
            .expect_err("decoding with an out-of-bounds size index should fail");
        assert!(
            err.to_string()
                .contains("decoding return value of g_strdup")
        );
    }

    #[test]
    fn error_context_is_ffi_call() {
        assert_eq!(CallRequest::error_context(), "FFI call");
    }
}

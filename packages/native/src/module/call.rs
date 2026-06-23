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
    types::{ArrayKind, FfiEncoder as _, Type},
    value::Value,
};

#[cfg_attr(test, allow(dead_code))]
struct CallRequest {
    library_name: String,
    symbol_name: String,
    args: Vec<Arg>,
    result_type: Type,
}

/// A function signature whose argument and return type descriptors are parsed once.
///
/// `bind` compiles a signature a single time and reuses the resulting handle for every call, so
/// the per-call path marshals only argument values and never re-walks the type descriptor objects.
pub struct CompiledSignature {
    arg_types: Vec<Type>,
    result_type: Type,
}

impl ModuleRequest for CallRequest {
    type Output = (Value, Vec<RefUpdate>);

    fn execute(self) -> anyhow::Result<(Value, Vec<RefUpdate>)> {
        let mut arg_types: Vec<libffi::Type> = Vec::with_capacity(self.args.len() + 1);
        for (i, arg) in self.args.iter().enumerate() {
            anyhow::ensure!(
                arg.ty.can_be_argument_type(),
                "arg {i} of {}: '{}' cannot be used as a function argument type",
                self.symbol_name,
                arg.ty
            );
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
                    .encode(&arg.value)
                    .with_context(|| format!("encoding arg {} of {}", i, self.symbol_name))
            })
            .collect::<anyhow::Result<Vec<ffi::FfiValue>>>()?;

        let mut ffi_args: Vec<libffi::Arg> = Vec::with_capacity(ffi_values.len() + 1);
        for ffi_value in &ffi_values {
            ffi_value.append_libffi_args(&mut ffi_args);
        }

        // SAFETY: runs on the gtkx-glib thread; `state.library` returns a loaded library and
        // `get` resolves the named symbol within it. The code pointer is only invoked through the
        // `cif` built from `result_type`/`arg_types` below, which describes the symbol's real ABI.
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

        for ffi_value in &ffi_values {
            ffi_value.disarm_pending_transfer();
        }

        let ref_updates = self.collect_ref_updates(&ffi_values);

        let return_value =
            Value::from_ffi_value_with_args(&result, &self.result_type, &ffi_values, &self.args)
                .with_context(|| format!("decoding return value of {}", self.symbol_name));

        self.release_sized_array_return(&result);

        let ref_updates = ref_updates?;
        let return_value = return_value?;
        Ok((return_value, ref_updates))
    }

    fn error_context() -> &'static str {
        "FFI call"
    }
}

impl CallRequest {
    fn release_sized_array_return(&self, result: &ffi::FfiValue) {
        let Type::Array(array_type) = &self.result_type else {
            return;
        };
        if !array_type.ownership.is_full()
            || !matches!(
                array_type.kind,
                ArrayKind::Sized { .. } | ArrayKind::Fixed { .. }
            )
        {
            return;
        }
        if let ffi::FfiValue::Ptr(ptr) = result
            && !ptr.is_null()
        {
            // SAFETY: the result is a transfer-full sized/fixed array whose backing buffer the
            // callee allocated with the GLib allocator; after decoding it above, freeing `*ptr`
            // with `g_free` on the gtkx-glib thread releases that buffer exactly once.
            unsafe { glib::ffi::g_free(*ptr) };
        }
    }

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

    #[napi(catch_unwind)]
    #[cfg_attr(test, allow(dead_code))]
    pub fn compile_signature(
        env: Env,
        arg_types: Array,
        return_type: Unknown<'_>,
    ) -> napi::Result<External<CompiledSignature>> {
        let parsed_arg_types = crate::value::map_js_array(&env, &arg_types, |env, value| {
            let ty = Type::from_js_value(env, value)?;
            if !ty.can_be_argument_type() {
                return Err(napi::Error::new(
                    napi::Status::InvalidArg,
                    format!("'{ty}' cannot be used as a function argument type"),
                ));
            }
            Ok(ty)
        })?;
        let result_type = Type::from_js_value(&env, return_type)?;
        if !result_type.can_be_return_type() {
            return Err(napi::Error::new(
                napi::Status::InvalidArg,
                format!("'{result_type}' cannot be used as a function return type"),
            ));
        }
        Ok(External::new(CompiledSignature {
            arg_types: parsed_arg_types,
            result_type,
        }))
    }

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
        let parsed_values = crate::value::map_js_array(env, &values, Value::from_js_value)?;
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

#[cfg(test)]
mod tests {
    use crate::types::{ArrayType, BlobType, IntegerKind, Ownership, StringType};
    use crate::value::{BufferView, BufferViewKind};

    use super::*;

    fn int_arg(value: f64) -> Arg {
        Arg::new(Type::Integer(IntegerKind::I32), Value::Number(value))
    }

    fn u8_array(kind: ArrayKind, ownership: Ownership) -> Type {
        Type::Array(ArrayType {
            item_type: Box::new(Type::Integer(IntegerKind::U8)),
            kind,
            ownership,
            element_size: None,
        })
    }

    fn string_type(ownership: Ownership) -> StringType {
        StringType {
            ownership,
            length: None,
        }
    }

    fn borrowed_string_arg(value: &str) -> Arg {
        Arg::new(
            Type::String(string_type(Ownership::Borrowed)),
            Value::String(value.into()),
        )
    }

    fn g_memdup2_request(data: Value) -> CallRequest {
        CallRequest {
            library_name: "libglib-2.0.so.0".into(),
            symbol_name: "g_memdup2".into(),
            args: vec![
                Arg::new(u8_array(ArrayKind::Array, Ownership::Borrowed), data),
                Arg::new(Type::Integer(IntegerKind::U64), Value::Number(3.0)),
            ],
            result_type: u8_array(ArrayKind::Sized { size_index: 1 }, Ownership::Full),
        }
    }

    #[test]
    fn execute_decodes_transfer_full_null_terminated_array_return() {
        let request = CallRequest {
            library_name: "libglib-2.0.so.0".into(),
            symbol_name: "g_strsplit".into(),
            args: vec![
                borrowed_string_arg("a,b"),
                borrowed_string_arg(","),
                Arg::new(Type::Integer(IntegerKind::I32), Value::Number(-1.0)),
            ],
            result_type: Type::Array(ArrayType {
                item_type: Box::new(Type::String(string_type(Ownership::Full))),
                kind: ArrayKind::Array,
                ownership: Ownership::Full,
                element_size: None,
            }),
        };
        let (value, ref_updates) = request.execute().expect("g_strsplit call should succeed");
        assert!(ref_updates.is_empty());
        let items = value.as_array().expect("expected array result");
        let parts: Vec<&str> = items.iter().filter_map(Value::as_string).collect();
        assert_eq!(parts, vec!["a", "b"]);
    }

    #[test]
    fn execute_decodes_and_releases_transfer_full_sized_array_return() {
        let request = g_memdup2_request(Value::Array(vec![
            Value::Number(1.0),
            Value::Number(2.0),
            Value::Number(3.0),
        ]));
        let (value, ref_updates) = request.execute().expect("g_memdup2 call should succeed");
        assert!(ref_updates.is_empty());
        let items = value.as_array().expect("expected array result");
        assert_eq!(items.len(), 3);
        assert!(matches!(items[0], Value::Number(n) if n == 1.0));
        assert!(matches!(items[2], Value::Number(n) if n == 3.0));
    }

    #[test]
    fn execute_passes_buffer_view_data_to_the_callee() {
        let mut data: Vec<u8> = vec![7, 8, 9];
        let view = BufferView::new(
            data.as_mut_ptr().cast(),
            data.len(),
            data.len(),
            BufferViewKind::Uint8,
            false,
        );
        let request = g_memdup2_request(Value::BufferView(view));
        let (value, ref_updates) = request.execute().expect("g_memdup2 call should succeed");
        assert!(ref_updates.is_empty());
        let items = value.as_array().expect("expected array result");
        let copied: Vec<f64> = items.iter().filter_map(Value::as_number).collect();
        assert_eq!(copied, vec![7.0, 8.0, 9.0]);
    }

    #[test]
    fn execute_writes_callee_output_into_a_blob_view() {
        let mut out = vec![0u8; 6];
        let view = BufferView::new(
            out.as_mut_ptr().cast(),
            out.len(),
            out.len(),
            BufferViewKind::Uint8,
            false,
        );
        let request = CallRequest {
            library_name: "libglib-2.0.so.0".into(),
            symbol_name: "g_unichar_to_utf8".into(),
            args: vec![
                Arg::new(
                    Type::Integer(IntegerKind::U32),
                    Value::Number(0x00E9 as f64),
                ),
                Arg::new(Type::Blob(BlobType), Value::BufferView(view)),
            ],
            result_type: Type::Integer(IntegerKind::I32),
        };
        let (value, ref_updates) = request
            .execute()
            .expect("g_unichar_to_utf8 call should succeed");
        assert!(ref_updates.is_empty());
        assert_eq!(value.as_number(), Some(2.0));
        assert_eq!(&out[..2], &[0xC3, 0xA9]);
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
    fn error_context_is_ffi_call() {
        assert_eq!(CallRequest::error_context(), "FFI call");
    }
}

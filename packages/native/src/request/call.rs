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
    arg::Arg,
    descriptor::{ArrayKind, Codec, FfiDecoder as _, FfiEncoder as _},
    library_cache::GlibThreadState,
    value::Value,
};

#[cfg_attr(test, allow(dead_code))]
pub struct CallRequest {
    pub descriptor: Arc<CallDescriptor>,
    pub values: Vec<Value>,
}

impl Request for CallRequest {
    type Output = (Value, Vec<RefUpdate>);

    fn execute(self) -> anyhow::Result<(Value, Vec<RefUpdate>)> {
        let args: Vec<Arg> = self
            .descriptor
            .arg_descriptors
            .iter()
            .cloned()
            .zip(self.values)
            .map(|(descriptor, value)| Arg::new(descriptor, value))
            .collect();
        let symbol_name = &self.descriptor.symbol_name;
        let return_descriptor = &self.descriptor.return_descriptor;

        let mut arg_types: Vec<libffi::Type> = Vec::with_capacity(args.len() + 1);
        for (i, arg) in args.iter().enumerate() {
            anyhow::ensure!(
                arg.descriptor.can_be_argument(),
                "arg {i} of {symbol_name}: '{}' cannot be used as a function argument type",
                arg.descriptor
            );
            arg.descriptor.append_ffi_arg_types(&mut arg_types);
        }

        let cif = libffi::Builder::new()
            .res(return_descriptor.libffi_type())
            .args(arg_types)
            .into_cif();

        let stashed_values = args
            .iter()
            .enumerate()
            .map(|(i, arg)| {
                arg.descriptor
                    .encode(&arg.value)
                    .with_context(|| format!("encoding arg {i} of {symbol_name}"))
            })
            .collect::<anyhow::Result<Vec<ffi::StashedValue>>>()?;

        let mut ffi_args: Vec<libffi::Arg> = Vec::with_capacity(stashed_values.len() + 1);
        for stashed_value in &stashed_values {
            stashed_value.append_libffi_args(&mut ffi_args);
        }

        let symbol_ptr = unsafe {
            GlibThreadState::with::<_, anyhow::Result<libffi::CodePtr>>(|state| {
                let library = state.library(&self.descriptor.library_name)?;
                let symbol = library.get::<unsafe extern "C" fn() -> ()>(symbol_name.as_bytes())?;

                let ptr = *symbol as *mut c_void;
                Ok(libffi::CodePtr(ptr))
            })?
        };

        let result = return_descriptor
            .call_cif(&cif, symbol_ptr, &ffi_args)
            .with_context(|| format!("calling {symbol_name}"))?;

        for stashed_value in &stashed_values {
            stashed_value.disarm_pending_transfer();
        }

        let ref_updates = Self::collect_ref_updates(&args, &stashed_values);

        let return_value = return_descriptor
            .decode_with_context(&result, &stashed_values, &args)
            .with_context(|| format!("decoding return value of {symbol_name}"));

        Self::release_sized_array_return(return_descriptor, &result);

        let ref_updates = ref_updates?;
        let return_value = return_value?;
        Ok((return_value, ref_updates))
    }

    fn error_context() -> &'static str {
        "FFI call"
    }
}

impl CallRequest {
    fn release_sized_array_return(result_type: &Codec, result: &ffi::StashedValue) {
        let Codec::Array(array_type) = result_type else {
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
        if let ffi::StashedValue::Ptr(ptr) = result
            && !ptr.is_null()
        {
            unsafe { glib::ffi::g_free(*ptr) };
        }
    }

    #[cfg_attr(coverage_nightly, coverage(off))]
    fn collect_ref_updates(
        args: &[Arg],
        stashed_values: &[ffi::StashedValue],
    ) -> anyhow::Result<Vec<RefUpdate>> {
        let mut ref_updates = Vec::new();
        for (i, arg) in args.iter().enumerate() {
            if let Value::Ref(ref_val) = &arg.value {
                let new_value =
                    arg.descriptor
                        .decode_with_context(&stashed_values[i], stashed_values, args)?;
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
        descriptor: &External<Arc<CallDescriptor>>,
        values: Array,
    ) -> napi::Result<Unknown<'env>> {
        let descriptor: Arc<CallDescriptor> = Arc::clone(descriptor);
        let parsed_values = crate::ffi::value::map_js_array(env, &values, Value::from_js_value)?;
        if parsed_values.len() != descriptor.arg_descriptors.len() {
            return Err(napi::Error::new(
                napi::Status::InvalidArg,
                format!(
                    "{}: expected {} arguments, received {}",
                    descriptor.symbol_name,
                    descriptor.arg_descriptors.len(),
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

#[cfg(test)]
mod tests {
    use crate::ffi::descriptor::{
        ArrayDescriptor, BufferDescriptor, IntegerKind, Ownership, StringDescriptor,
    };
    use crate::ffi::value::{BufferView, BufferViewKind};

    use super::*;

    fn int_arg(value: f64) -> Arg {
        Arg::new(Codec::Integer(IntegerKind::I32), Value::Number(value))
    }

    fn u8_array(kind: ArrayKind, ownership: Ownership) -> Codec {
        Codec::Array(ArrayDescriptor {
            item_descriptor: Box::new(Codec::Integer(IntegerKind::U8)),
            kind,
            ownership,
            element_size: None,
        })
    }

    fn string_type(ownership: Ownership) -> StringDescriptor {
        StringDescriptor {
            ownership,
            length: None,
        }
    }

    fn borrowed_string_arg(value: &str) -> Arg {
        Arg::new(
            Codec::String(string_type(Ownership::Borrowed)),
            Value::String(value.into()),
        )
    }

    fn build_request(
        library_name: &str,
        symbol_name: &str,
        args: Vec<Arg>,
        return_descriptor: Codec,
    ) -> CallRequest {
        let arg_descriptors = args.iter().map(|arg| arg.descriptor.clone()).collect();
        let values = args.into_iter().map(|arg| arg.value).collect();
        CallRequest {
            descriptor: Arc::new(CallDescriptor {
                library_name: library_name.into(),
                symbol_name: symbol_name.into(),
                arg_descriptors,
                return_descriptor,
            }),
            values,
        }
    }

    fn g_memdup2_request(data: Value) -> CallRequest {
        build_request(
            "libglib-2.0.so.0",
            "g_memdup2",
            vec![
                Arg::new(u8_array(ArrayKind::Array, Ownership::Borrowed), data),
                Arg::new(Codec::Integer(IntegerKind::U64), Value::Number(3.0)),
            ],
            u8_array(ArrayKind::Sized { size_index: 1 }, Ownership::Full),
        )
    }

    #[test]
    fn execute_decodes_transfer_full_null_terminated_array_return() {
        let request = build_request(
            "libglib-2.0.so.0",
            "g_strsplit",
            vec![
                borrowed_string_arg("a,b"),
                borrowed_string_arg(","),
                Arg::new(Codec::Integer(IntegerKind::I32), Value::Number(-1.0)),
            ],
            Codec::Array(ArrayDescriptor {
                item_descriptor: Box::new(Codec::String(string_type(Ownership::Full))),
                kind: ArrayKind::Array,
                ownership: Ownership::Full,
                element_size: None,
            }),
        );
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
    fn execute_writes_callee_output_into_a_buffer_view() {
        let mut out = vec![0u8; 6];
        let view = BufferView::new(
            out.as_mut_ptr().cast(),
            out.len(),
            out.len(),
            BufferViewKind::Uint8,
            false,
        );
        let request = build_request(
            "libglib-2.0.so.0",
            "g_unichar_to_utf8",
            vec![
                Arg::new(
                    Codec::Integer(IntegerKind::U32),
                    Value::Number(0x00E9 as f64),
                ),
                Arg::new(Codec::Buffer(BufferDescriptor), Value::BufferView(view)),
            ],
            Codec::Integer(IntegerKind::I32),
        );
        let (value, ref_updates) = request
            .execute()
            .expect("g_unichar_to_utf8 call should succeed");
        assert!(ref_updates.is_empty());
        assert_eq!(value.as_number(), Some(2.0));
        assert_eq!(&out[..2], &[0xC3, 0xA9]);
    }

    #[test]
    fn execute_runs_a_real_ffi_call() {
        let request = build_request(
            "libglib-2.0.so.0",
            "g_random_int_range",
            vec![int_arg(10.0), int_arg(20.0)],
            Codec::Integer(IntegerKind::I32),
        );
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

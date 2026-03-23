//! FFI function call execution.
//!
//! This module implements [`call`], which executes native function calls via
//! libffi. This is the core mechanism for invoking GTK and GLib functions from
//! JavaScript.
//!
//! ## Call Flow
//!
//! 1. Parse library name, symbol name, arguments, and return type from JS
//! 2. Convert arguments to [`ffi::FfiValue`] representations
//! 3. Build a libffi CIF (Call Interface) with proper type signatures
//! 4. Load the library and resolve the symbol on the GTK thread
//! 5. Execute the FFI call with proper type dispatching
//! 6. Convert the result back to a [`Value`] for JavaScript
//! 7. Update any `Ref` type out-parameters with modified values
//!
//! ## Callbacks
//!
//! Special handling is required for callback arguments (AsyncReady, Destroy,
//! DrawFunc). These expand to multiple FFI arguments: the callback function
//! pointer, user data, and optionally a destroy notify.

use std::{ffi::c_void, ops::Deref, sync::Arc};

use anyhow::Context as _;
use libffi::middle as libffi;
use neon::prelude::*;

use super::handler::{ModuleRequest, dispatch_request};
use crate::{
    arg::Arg,
    ffi, gtk_dispatch,
    state::GtkThreadState,
    types::{FfiEncoder as _, Type},
    value::Value,
};

type RefUpdate = (Arc<Root<JsObject>>, Value);

struct CallRequest {
    library_name: String,
    symbol_name: String,
    args: Vec<Arg>,
    result_type: Type,
}

impl ModuleRequest for CallRequest {
    type Output = (Value, Vec<RefUpdate>);

    fn from_js(cx: &mut FunctionContext) -> NeonResult<Self> {
        let library_name = cx.argument::<JsString>(0)?.value(cx);
        let symbol_name = cx.argument::<JsString>(1)?.value(cx);
        let js_args = cx.argument::<JsArray>(2)?;
        let js_result_type = cx.argument::<JsObject>(3)?;
        let args = Arg::from_js_array(cx, js_args)?;
        let result_type = Type::from_js_value(cx, js_result_type.upcast())?;

        Ok(Self {
            library_name,
            symbol_name,
            args,
            result_type,
        })
    }

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

        // SAFETY: We're loading a symbol from a dynamic library and calling it via libffi.
        // The library/symbol names come from the FFI binding definitions which are trusted.
        let symbol_ptr = unsafe {
            GtkThreadState::with::<_, anyhow::Result<libffi::CodePtr>>(|state| {
                let library = state.library(&self.library_name)?;
                let symbol =
                    library.get::<unsafe extern "C" fn() -> ()>(self.symbol_name.as_bytes())?;

                let ptr = *symbol.deref() as *mut c_void;
                Ok(libffi::CodePtr(ptr))
            })?
        };

        let result = self
            .result_type
            .call_cif(&cif, symbol_ptr, &ffi_args)
            .with_context(|| format!("calling {}", self.symbol_name))?;

        let mut ref_updates = Vec::new();

        for (i, arg) in self.args.iter().enumerate() {
            if let Value::Ref(ref_val) = &arg.value {
                let new_value = Value::from_ffi_value_with_args(
                    &ffi_values[i],
                    &arg.ty,
                    &ffi_values,
                    &self.args,
                )?;
                ref_updates.push((ref_val.js_obj.clone(), new_value));
            }
        }

        let return_value =
            Value::from_ffi_value_with_args(&result, &self.result_type, &ffi_values, &self.args)
                .with_context(|| format!("decoding return value of {}", self.symbol_name))?;
        Ok((return_value, ref_updates))
    }

    fn error_context() -> &'static str {
        "FFI call"
    }
}

pub fn call(mut cx: FunctionContext) -> JsResult<JsValue> {
    if !gtk_dispatch::GtkDispatcher::global().is_started() {
        return cx.throw_error("GTK application has not been started. Call start() first.");
    }

    dispatch_request::<CallRequest>(&mut cx)
}

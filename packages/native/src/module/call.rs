//! FFI function call execution.
//!
//! This module implements [`call`] and [`batch_call`], which execute native
//! function calls via libffi. This is the core mechanism for invoking GTK
//! and GLib functions from JavaScript.
//!
//! ## Call Flow
//!
//! 1. Parse library name, symbol name, arguments, and return type from JS
//! 2. Convert arguments to [`cif::Value`] representations
//! 3. Build a libffi CIF (Call Interface) with proper type signatures
//! 4. Load the library and resolve the symbol on the GTK thread
//! 5. Execute the FFI call with proper type dispatching
//! 6. Convert the result back to a [`Value`] for JavaScript
//! 7. Update any `Ref` type out-parameters with modified values
//!
//! ## Callback Trampolines
//!
//! Special handling is required for callback arguments with trampolines
//! (AsyncReady, Destroy, DrawFunc). These expand to multiple FFI arguments:
//! the trampoline function pointer, user data, and optionally a destroy notify.

use std::{
    ffi::{c_char, c_void},
    ops::Deref,
    sync::{Arc, mpsc},
};

use anyhow::bail;
use libffi::middle as libffi;
use neon::prelude::*;

use crate::{
    arg::Arg,
    cif, gtk_dispatch, js_dispatch,
    state::GtkThreadState,
    types::{CallbackTrampoline, FloatSize, IntegerSign, IntegerSize, Type},
    value::Value,
};

type RefUpdate = (Arc<Root<JsObject>>, Value);

struct BatchCallDescriptor {
    library_name: String,
    symbol_name: String,
    args: Vec<Arg>,
}

fn wait_for_result<'a, R, C: Context<'a>>(
    cx: &mut C,
    rx: &mpsc::Receiver<anyhow::Result<R>>,
) -> anyhow::Result<R> {
    let result = loop {
        js_dispatch::process_pending(cx);

        match rx.try_recv() {
            Ok(result) => break result,
            Err(mpsc::TryRecvError::Empty) => {
                std::thread::yield_now();
            }
            Err(mpsc::TryRecvError::Disconnected) => {
                gtk_dispatch::exit_js_wait();
                return Err(anyhow::anyhow!("GTK thread disconnected"));
            }
        }
    };

    gtk_dispatch::exit_js_wait();
    result
}

pub fn call(mut cx: FunctionContext) -> JsResult<JsValue> {
    let library_name = cx.argument::<JsString>(0)?.value(&mut cx);
    let symbol_name = cx.argument::<JsString>(1)?.value(&mut cx);
    let js_args = cx.argument::<JsArray>(2)?;
    let js_result_type = cx.argument::<JsObject>(3)?;
    let args = Arg::from_js_array(&mut cx, js_args)?;
    let result_type = Type::from_js_value(&mut cx, js_result_type.upcast())?;

    let (tx, rx) = mpsc::channel::<anyhow::Result<(Value, Vec<RefUpdate>)>>();

    gtk_dispatch::enter_js_wait();
    gtk_dispatch::schedule(move || {
        let _ = tx.send(handle_call(library_name, symbol_name, args, result_type));
    });

    let (value, ref_updates) = wait_for_result(&mut cx, &rx)
        .or_else(|err| cx.throw_error(format!("Error during FFI call: {err}")))?;

    for (js_obj, new_value) in ref_updates {
        let js_obj = js_obj.to_inner(&mut cx);
        let new_js_value = new_value.to_js_value(&mut cx)?;
        let mut prop = js_obj.prop(&mut cx, "value");

        prop.set(new_js_value)?;
    }

    value.to_js_value(&mut cx)
}

fn handle_call(
    library_name: String,
    symbol_name: String,
    args: Vec<Arg>,
    result_type: Type,
) -> anyhow::Result<(Value, Vec<RefUpdate>)> {
    let mut arg_types: Vec<libffi::Type> = Vec::with_capacity(args.len() + 1);
    for arg in &args {
        match &arg.type_ {
            Type::Callback(cb) if cb.trampoline != CallbackTrampoline::Closure => {
                arg_types.push(libffi::Type::pointer());
                arg_types.push(libffi::Type::pointer());

                if cb.trampoline == CallbackTrampoline::DrawFunc
                    || cb.trampoline == CallbackTrampoline::ShortcutFunc
                    || cb.trampoline == CallbackTrampoline::TreeListModelCreateFunc
                {
                    arg_types.push(libffi::Type::pointer());
                }
            }
            _ => {
                arg_types.push((&arg.type_).into());
            }
        }
    }

    let cif = libffi::Builder::new()
        .res((&result_type).into())
        .args(arg_types)
        .into_cif();

    let cif_args = args
        .clone()
        .into_iter()
        .map(TryInto::<cif::Value>::try_into)
        .collect::<anyhow::Result<Vec<cif::Value>>>()?;

    let mut ffi_args: Vec<libffi::Arg> = Vec::with_capacity(cif_args.len() + 1);
    for cif_arg in &cif_args {
        match cif_arg {
            cif::Value::TrampolineCallback(trampoline_cb) => {
                if trampoline_cb.data_first {
                    ffi_args.push(libffi::arg(&trampoline_cb.closure.ptr));
                    ffi_args.push(libffi::arg(&trampoline_cb.trampoline_ptr));
                } else {
                    ffi_args.push(libffi::arg(&trampoline_cb.trampoline_ptr));
                    ffi_args.push(libffi::arg(&trampoline_cb.closure.ptr));
                }
                if let Some(destroy_ptr) = &trampoline_cb.destroy_ptr {
                    ffi_args.push(libffi::arg(destroy_ptr));
                }
            }
            other => {
                ffi_args.push(other.into());
            }
        }
    }

    let symbol_ptr = unsafe {
        GtkThreadState::with::<_, anyhow::Result<libffi::CodePtr>>(|state| {
            let library = state.get_library(&library_name)?;
            let symbol = library.get::<unsafe extern "C" fn() -> ()>(symbol_name.as_bytes())?;

            let ptr = *symbol.deref() as *mut c_void;
            Ok(libffi::CodePtr(ptr))
        })?
    };

    let result = unsafe {
        match result_type {
            Type::Undefined => {
                cif.call::<()>(symbol_ptr, &ffi_args);
                cif::Value::Void
            }
            Type::Integer(type_) => match (type_.size, type_.sign) {
                (IntegerSize::_8, IntegerSign::Unsigned) => {
                    cif::Value::U8(cif.call::<u8>(symbol_ptr, &ffi_args))
                }
                (IntegerSize::_8, IntegerSign::Signed) => {
                    cif::Value::I8(cif.call::<i8>(symbol_ptr, &ffi_args))
                }
                (IntegerSize::_16, IntegerSign::Unsigned) => {
                    cif::Value::U16(cif.call::<u16>(symbol_ptr, &ffi_args))
                }
                (IntegerSize::_16, IntegerSign::Signed) => {
                    cif::Value::I16(cif.call::<i16>(symbol_ptr, &ffi_args))
                }
                (IntegerSize::_32, IntegerSign::Unsigned) => {
                    cif::Value::U32(cif.call::<u32>(symbol_ptr, &ffi_args))
                }
                (IntegerSize::_32, IntegerSign::Signed) => {
                    cif::Value::I32(cif.call::<i32>(symbol_ptr, &ffi_args))
                }
                (IntegerSize::_64, IntegerSign::Unsigned) => {
                    cif::Value::U64(cif.call::<u64>(symbol_ptr, &ffi_args))
                }
                (IntegerSize::_64, IntegerSign::Signed) => {
                    cif::Value::I64(cif.call::<i64>(symbol_ptr, &ffi_args))
                }
            },
            Type::Float(type_) => match type_.size {
                FloatSize::_32 => cif::Value::F32(cif.call::<f32>(symbol_ptr, &ffi_args)),
                FloatSize::_64 => cif::Value::F64(cif.call::<f64>(symbol_ptr, &ffi_args)),
            },
            Type::String(_) => {
                let ptr = cif.call::<*const c_char>(symbol_ptr, &ffi_args);
                cif::Value::Ptr(ptr as *mut c_void)
            }
            Type::Boolean => cif::Value::U8(cif.call::<u8>(symbol_ptr, &ffi_args)),
            Type::GObject(_) | Type::Boxed(_) | Type::Struct(_) | Type::GVariant(_) => {
                let ptr = cif.call::<*mut c_void>(symbol_ptr, &ffi_args);
                cif::Value::Ptr(ptr)
            }
            Type::Array(_) => {
                let ptr = cif.call::<*mut c_void>(symbol_ptr, &ffi_args);
                cif::Value::Ptr(ptr)
            }
            Type::Null => cif::Value::Void,
            _ => bail!("Unsupported return type: {:?}", result_type),
        }
    };

    let mut ref_updates = Vec::new();

    for (i, arg) in args.iter().enumerate() {
        if let Value::Ref(r#ref) = &arg.value {
            if let Type::Ref(ref_type) = &arg.type_ {
                let is_object_passthrough = matches!(
                    (&*ref_type.inner_type, &*r#ref.value),
                    (Type::Boxed(_) | Type::Struct(_) | Type::GObject(_), Value::Object(_))
                );
                if is_object_passthrough {
                    continue;
                }
            }
            let new_value = Value::from_cif_value(&cif_args[i], &arg.type_)?;
            ref_updates.push((r#ref.js_obj.clone(), new_value));
        }
    }

    Ok((Value::from_cif_value(&result, &result_type)?, ref_updates))
}

pub fn batch_call(mut cx: FunctionContext) -> JsResult<JsUndefined> {
    let js_calls = cx.argument::<JsArray>(0)?;
    let len = js_calls.len(&mut cx);

    if len == 0 {
        return Ok(cx.undefined());
    }

    let mut descriptors = Vec::with_capacity(len as usize);

    for i in 0..len {
        let js_call = js_calls.get::<JsObject, _, _>(&mut cx, i)?;

        let library_name = js_call
            .get::<JsString, _, _>(&mut cx, "library")?
            .value(&mut cx);
        let symbol_name = js_call
            .get::<JsString, _, _>(&mut cx, "symbol")?
            .value(&mut cx);
        let js_args = js_call.get::<JsArray, _, _>(&mut cx, "args")?;
        let args = Arg::from_js_array(&mut cx, js_args)?;

        descriptors.push(BatchCallDescriptor {
            library_name,
            symbol_name,
            args,
        });
    }

    let (tx, rx) = mpsc::channel::<anyhow::Result<()>>();

    gtk_dispatch::enter_js_wait();
    gtk_dispatch::schedule(move || {
        let result = handle_batch_calls(descriptors);
        let _ = tx.send(result);
    });

    wait_for_result(&mut cx, &rx)
        .or_else(|err| cx.throw_error(format!("Error during batch FFI call: {err}")))?;

    Ok(cx.undefined())
}

fn handle_batch_calls(descriptors: Vec<BatchCallDescriptor>) -> anyhow::Result<()> {
    for descriptor in descriptors {
        handle_call(
            descriptor.library_name,
            descriptor.symbol_name,
            descriptor.args,
            Type::Undefined,
        )?;
    }

    Ok(())
}

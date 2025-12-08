use std::{
    ffi::{c_char, c_void},
    ops::Deref,
    sync::{Arc, mpsc},
};

use anyhow::bail;
use gtk4::glib;
use libffi::middle as ffi;
use neon::prelude::*;

use crate::{
    arg::Arg,
    cif,
    state::GtkThreadState,
    types::{CallbackTrampoline, FloatSize, IntegerSign, IntegerSize, Type},
    uv,
    value::Value,
};

type RefUpdate = (Arc<Root<JsObject>>, Value);

pub fn call(mut cx: FunctionContext) -> JsResult<JsValue> {
    let library_name = cx.argument::<JsString>(0)?.value(&mut cx);
    let symbol_name = cx.argument::<JsString>(1)?.value(&mut cx);
    let js_args = cx.argument::<JsArray>(2)?;
    let js_result_type = cx.argument::<JsObject>(3)?;
    let args = Arg::from_js_array(&mut cx, js_args)?;
    let result_type = Type::from_js_value(&mut cx, js_result_type.upcast())?;
    let has_refs = args.iter().any(|arg| matches!(arg.value, Value::Ref(_)));
    let is_void = matches!(result_type, Type::Undefined | Type::Null);

    if is_void && !has_refs {
        glib::idle_add_once(move || {
            let _ = handle_call(library_name, symbol_name, args, result_type);
        });

        return Ok(cx.undefined().upcast());
    }

    let (tx, rx) = mpsc::channel::<anyhow::Result<(Value, Vec<RefUpdate>)>>();

    glib::idle_add_once(move || {
        let _ = tx.send(handle_call(library_name, symbol_name, args, result_type));
    });

    let (value, ref_updates) = uv::wait_for_result(
        uv::get_event_loop(&cx),
        &rx,
        "GTK thread disconnected while waiting for call result",
    )
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
    let mut arg_types: Vec<ffi::Type> = Vec::with_capacity(args.len() + 1);
    for arg in &args {
        match &arg.type_ {
            Type::Callback(cb) if cb.trampoline != CallbackTrampoline::Closure => {
                arg_types.push(ffi::Type::pointer());
                arg_types.push(ffi::Type::pointer());

                if cb.trampoline == CallbackTrampoline::DrawFunc
                    || cb.trampoline == CallbackTrampoline::CompareDataFunc
                {
                    arg_types.push(ffi::Type::pointer());
                }
            }
            _ => {
                arg_types.push((&arg.type_).into());
            }
        }
    }

    let cif = ffi::Builder::new()
        .res((&result_type).into())
        .args(arg_types)
        .into_cif();

    let cif_args = args
        .clone()
        .into_iter()
        .map(TryInto::<cif::Value>::try_into)
        .collect::<anyhow::Result<Vec<cif::Value>>>()?;

    let mut ffi_args: Vec<ffi::Arg> = Vec::with_capacity(cif_args.len() + 1);
    for cif_arg in &cif_args {
        match cif_arg {
            cif::Value::TrampolineCallback(trampoline_cb) => {
                ffi_args.push(ffi::arg(&trampoline_cb.trampoline_ptr));
                ffi_args.push(ffi::arg(&trampoline_cb.closure.ptr));
                if let Some(destroy_ptr) = &trampoline_cb.destroy_ptr {
                    ffi_args.push(ffi::arg(destroy_ptr));
                }
            }
            other => {
                ffi_args.push(other.into());
            }
        }
    }

    let symbol_ptr = unsafe {
        GtkThreadState::with::<_, anyhow::Result<ffi::CodePtr>>(|state| {
            let library = state.get_library(&library_name)?;
            let symbol = library.get::<unsafe extern "C" fn() -> ()>(symbol_name.as_bytes())?;

            let ptr = *symbol.deref() as *mut c_void;
            Ok(ffi::CodePtr(ptr))
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
            Type::GObject(_) | Type::Boxed(_) => {
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
            // For Ref<Boxed> and Ref<GObject> out parameters, the original ObjectId
            // already points to the memory that was modified by the FFI call.
            // We don't need to update the ref - the JS side can use the original
            // object which now contains the initialized data.
            if let Type::Ref(ref_type) = &arg.type_ {
                match &*ref_type.inner_type {
                    Type::Boxed(_) | Type::GObject(_) => {
                        // Skip ref update - the original ObjectId is still valid
                        continue;
                    }
                    _ => {}
                }
            }
            let new_value = Value::from_cif_value(&cif_args[i], &arg.type_)?;
            ref_updates.push((r#ref.js_obj.clone(), new_value));
        }
    }

    Ok((Value::from_cif_value(&result, &result_type)?, ref_updates))
}

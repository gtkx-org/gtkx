use std::ffi::c_void;
use std::sync::Arc;
use std::sync::atomic::{AtomicPtr, Ordering};

use gtk4::glib::{
    self, gobject_ffi,
    translate::{FromGlibPtrFull as _, ToGlibPtr as _},
};
use neon::prelude::*;

use crate::callback::ClosureGuard;
use crate::ffi::{self, FfiStorage};
use crate::js_dispatch;
use crate::types::{IntegerKind, Type};
use crate::value;
use crate::value::Callback;

struct ClosureContext {
    channel: neon::event::Channel,
    js_func: Arc<neon::handle::Root<neon::types::JsFunction>>,
    arg_types: Vec<Type>,
}

impl ClosureContext {
    fn from_callback(callback: &Callback, callback_type: &CallbackType) -> Self {
        Self {
            channel: callback.channel.clone(),
            js_func: callback.js_func.clone(),
            arg_types: callback_type.arg_types.clone(),
        }
    }

    fn build_closure_with_guard(self, return_type: Box<Type>) -> glib::Closure {
        let has_ref_params = self.arg_types.iter().any(|t| matches!(t, Type::Ref(_)));
        let closure_holder: Arc<AtomicPtr<gobject_ffi::GClosure>> =
            Arc::new(AtomicPtr::new(std::ptr::null_mut()));
        let closure_holder_for_callback = closure_holder.clone();

        let closure = glib::Closure::new(move |args: &[glib::Value]| {
            let _guard =
                ClosureGuard::from_ptr(closure_holder_for_callback.load(Ordering::Acquire));

            let args_values = match value::Value::from_glib_values(args, &self.arg_types) {
                Ok(v) => v,
                Err(e) => {
                    gtkx_warn!("closure: failed to convert callback arguments: {e}");
                    return None;
                }
            };

            let return_type_ref: Option<&Type> = Some(&return_type);

            if has_ref_params {
                let ref_pointers: Vec<(*mut c_void, &Type)> = args
                    .iter()
                    .zip(self.arg_types.iter())
                    .filter_map(|(gval, ty)| {
                        if let Type::Ref(ref_type) = ty {
                            let ptr = unsafe {
                                glib::gobject_ffi::g_value_get_pointer(
                                    gval.to_glib_none().0 as *const _,
                                )
                            };
                            Some((ptr, &*ref_type.inner_type))
                        } else {
                            None
                        }
                    })
                    .collect();

                js_dispatch::JsDispatcher::global().invoke_and_wait(
                    &self.channel,
                    &self.js_func,
                    args_values,
                    true,
                    |result| match result {
                        Ok(value::Value::Array(arr)) => {
                            for (i, (ptr, inner_type)) in ref_pointers.iter().enumerate() {
                                if let Some(val) = arr.get(i + 1)
                                    && !(*ptr).is_null()
                                {
                                    write_ref_value_to_ptr(*ptr, val, inner_type);
                                }
                            }
                            let return_val =
                                arr.into_iter().next().unwrap_or(value::Value::Undefined);
                            value::Value::into_glib_value_with_default(return_val, return_type_ref)
                        }
                        Ok(value) => {
                            value::Value::into_glib_value_with_default(value, return_type_ref)
                        }
                        Err(_) => value::Value::into_glib_value_with_default(
                            value::Value::Undefined,
                            return_type_ref,
                        ),
                    },
                )
            } else {
                js_dispatch::JsDispatcher::global().invoke_and_wait(
                    &self.channel,
                    &self.js_func,
                    args_values,
                    true,
                    |result| match result {
                        Ok(value) => {
                            value::Value::into_glib_value_with_default(value, return_type_ref)
                        }
                        Err(_) => value::Value::into_glib_value_with_default(
                            value::Value::Undefined,
                            return_type_ref,
                        ),
                    },
                )
            }
        });

        let closure_ptr: *mut gobject_ffi::GClosure = closure.to_glib_full();
        closure_holder.store(closure_ptr, Ordering::Release);

        unsafe { glib::Closure::from_glib_full(closure_ptr) }
    }
}

fn write_ref_value_to_ptr(ptr: *mut c_void, val: &value::Value, inner_type: &Type) {
    match (val, inner_type) {
        (value::Value::Number(n), Type::Float(float_kind)) => {
            float_kind.write_ptr(ptr as *mut u8, *n);
        }
        (value::Value::Number(n), Type::Integer(int_type)) => {
            int_type.write_ptr(ptr as *mut u8, *n);
        }
        (value::Value::Number(n), Type::Enum(_)) => {
            IntegerKind::I32.write_ptr(ptr as *mut u8, *n);
        }
        (value::Value::Number(n), Type::Flags(_)) => {
            IntegerKind::U32.write_ptr(ptr as *mut u8, *n);
        }
        (value::Value::Boolean(b), Type::Boolean) => unsafe {
            *(ptr as *mut i32) = if *b { 1 } else { 0 };
        },
        (value::Value::Null | value::Value::Undefined, _) => {}
        _ => {
            gtkx_warn!(
                "write_ref_value_to_ptr: unexpected value/type pair: {:?} / {:?}",
                val,
                inner_type
            );
        }
    }
}

pub fn build_closure_ffi_value(callback: &Callback, callback_type: &CallbackType) -> ffi::FfiValue {
    let ctx = ClosureContext::from_callback(callback, callback_type);
    let closure = ctx.build_closure_with_guard(callback_type.return_type.clone());
    let closure_ptr: *mut gobject_ffi::GClosure = closure.to_glib_full();
    ffi::FfiValue::Storage(FfiStorage::closure(closure_ptr))
}

fn build_null_closure_ffi_value() -> ffi::FfiValue {
    ffi::FfiValue::Storage(FfiStorage::new(
        std::ptr::null_mut(),
        ffi::FfiStorageKind::Unit,
    ))
}

#[derive(Debug, Clone)]
pub struct CallbackType {
    pub arg_types: Vec<Type>,
    pub return_type: Box<Type>,
}

impl CallbackType {
    pub fn from_js_value(cx: &mut FunctionContext, value: Handle<JsValue>) -> NeonResult<Self> {
        let obj = value.downcast::<JsObject, _>(cx).or_throw(cx)?;

        let arg_types_prop: Handle<'_, JsValue> = obj.prop(cx, "argTypes").get()?;
        let arg_types_arr = arg_types_prop.downcast::<JsArray, _>(cx).or_else(|_| {
            cx.throw_type_error("'argTypes' property is required for callback types")
        })?;
        let arg_types_vec = arg_types_arr.to_vec(cx)?;
        let mut arg_types = Vec::with_capacity(arg_types_vec.len());
        for item in arg_types_vec {
            arg_types.push(Type::from_js_value(cx, item)?);
        }

        let return_type_prop: Handle<'_, JsValue> = obj.prop(cx, "returnType").get()?;
        let return_type = Box::new(Type::from_js_value(cx, return_type_prop).or_else(|_| {
            cx.throw_type_error("'returnType' property is required for callback types")
        })?);

        Ok(CallbackType {
            arg_types,
            return_type,
        })
    }
}

impl CallbackType {
    pub fn encode(&self, val: &value::Value, optional: bool) -> anyhow::Result<ffi::FfiValue> {
        use anyhow::bail;

        let callback = match val {
            value::Value::Callback(callback) => callback,
            value::Value::Null | value::Value::Undefined if optional => {
                return Ok(build_null_closure_ffi_value());
            }
            _ => bail!("Expected a Callback for callback type, got {:?}", val),
        };

        Ok(build_closure_ffi_value(callback, self))
    }
}

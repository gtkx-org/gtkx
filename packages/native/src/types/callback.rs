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
use crate::gtk_dispatch::GtkDispatcher;
use crate::js_dispatch;
use crate::types::Type;
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

            let return_type_inner = *return_type.clone();

            let args_values = value::Value::from_glib_values(args, &self.arg_types)
                .expect("Failed to convert GLib callback arguments");

            if has_ref_params {
                let ref_pointers: Vec<(*mut c_void, Type)> = args
                    .iter()
                    .zip(self.arg_types.iter())
                    .filter_map(|(gval, ty)| {
                        if let Type::Ref(ref_type) = ty {
                            let ptr = unsafe {
                                glib::gobject_ffi::g_value_get_pointer(
                                    gval.to_glib_none().0 as *const _,
                                )
                            };
                            Some((ptr, *ref_type.inner_type.clone()))
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
                                    && !ptr.is_null()
                                {
                                    write_ref_value_to_ptr(*ptr, val, inner_type);
                                }
                            }
                            let return_val =
                                arr.into_iter().next().unwrap_or(value::Value::Undefined);
                            value::Value::into_glib_value_with_default(
                                return_val,
                                Some(&return_type_inner),
                            )
                        }
                        Ok(value) => value::Value::into_glib_value_with_default(
                            value,
                            Some(&return_type_inner),
                        ),
                        Err(_) => value::Value::into_glib_value_with_default(
                            value::Value::Undefined,
                            Some(&return_type_inner),
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
                        Ok(value) => value::Value::into_glib_value_with_default(
                            value,
                            Some(&return_type_inner),
                        ),
                        Err(_) => value::Value::into_glib_value_with_default(
                            value::Value::Undefined,
                            Some(&return_type_inner),
                        ),
                    },
                )
            }
        });

        let closure_ptr: *mut gobject_ffi::GClosure = closure.to_glib_full();
        closure_holder.store(closure_ptr, Ordering::Release);
        unsafe { GtkDispatcher::install_closure_invalidate_notifier(closure_ptr) };

        unsafe { glib::Closure::from_glib_full(closure_ptr) }
    }
}

fn write_ref_value_to_ptr(ptr: *mut c_void, val: &value::Value, inner_type: &Type) {
    match (val, inner_type) {
        (value::Value::Number(n), Type::Float(float_kind)) => {
            float_kind.write_ptr(ptr as *mut u8, *n);
        }
        (value::Value::Number(n), Type::Integer(int_type)) => {
            int_type.kind.write_ptr(ptr as *mut u8, *n);
        }
        (value::Value::Boolean(b), Type::Boolean) => unsafe {
            *(ptr as *mut i32) = if *b { 1 } else { 0 };
        },
        (value::Value::Null | value::Value::Undefined, _) => {}
        _ => {
            eprintln!(
                "write_ref_value_to_ptr: unexpected value/type pair: {:?} / {:?}",
                val, inner_type
            );
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CallbackKind {
    Closure,
    AsyncReady,
}

impl std::str::FromStr for CallbackKind {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "closure" => Ok(CallbackKind::Closure),
            "asyncReadyCallback" => Ok(CallbackKind::AsyncReady),
            _ => Err(format!(
                "'kind' must be 'closure' or 'asyncReadyCallback'; got '{}'",
                s
            )),
        }
    }
}

impl CallbackKind {
    pub fn build_ffi_value(
        &self,
        callback: &Callback,
        callback_type: &CallbackType,
    ) -> ffi::FfiValue {
        match self {
            CallbackKind::Closure => {
                let ctx = ClosureContext::from_callback(callback, callback_type);
                let closure = ctx.build_closure_with_guard(callback_type.return_type.clone());
                let closure_ptr: *mut gobject_ffi::GClosure = closure.to_glib_full();
                ffi::FfiValue::Storage(FfiStorage::closure(closure_ptr))
            }
            CallbackKind::AsyncReady => {
                let source_type = callback_type
                    .source_type
                    .clone()
                    .unwrap_or(Box::new(Type::Null));
                let result_type = callback_type
                    .result_type
                    .clone()
                    .unwrap_or(Box::new(Type::Null));

                let channel = callback.channel.clone();
                let js_func = callback.js_func.clone();

                let closure = glib::Closure::new(move |args: &[glib::Value]| {
                    let source_value = args
                        .first()
                        .map(|gval| {
                            value::Value::from_glib_value(gval, &source_type)
                                .expect("Failed to convert async source value")
                        })
                        .unwrap_or(value::Value::Null);

                    let result_value = args
                        .get(1)
                        .map(|gval| {
                            value::Value::from_glib_value(gval, &result_type)
                                .expect("Failed to convert async result value")
                        })
                        .unwrap_or(value::Value::Null);

                    js_dispatch::JsDispatcher::global().invoke_and_wait(
                        &channel,
                        &js_func,
                        vec![source_value, result_value],
                        false,
                        |_| None::<glib::Value>,
                    )
                });

                let closure_ptr: *mut gobject_ffi::GClosure = closure.to_glib_full();
                unsafe { GtkDispatcher::install_closure_invalidate_notifier(closure_ptr) };

                ffi::FfiValue::Trampoline(ffi::TrampolineValue {
                    fn_ptr: crate::callback::async_ready_trampoline as *mut c_void,
                    state_ptr: closure_ptr as *mut c_void,
                    destroy_ptr: None,
                    _owned_state: None,
                })
            }
        }
    }

    fn build_null_ffi_value(&self) -> ffi::FfiValue {
        match self {
            CallbackKind::Closure => ffi::FfiValue::Storage(FfiStorage::new(
                std::ptr::null_mut(),
                ffi::FfiStorageKind::Unit,
            )),
            CallbackKind::AsyncReady => ffi::FfiValue::Trampoline(ffi::TrampolineValue {
                fn_ptr: std::ptr::null_mut(),
                state_ptr: std::ptr::null_mut(),
                destroy_ptr: None,
                _owned_state: None,
            }),
        }
    }
}

#[derive(Debug, Clone)]
pub struct CallbackType {
    pub kind: CallbackKind,
    pub arg_types: Vec<Type>,
    pub return_type: Box<Type>,
    pub source_type: Option<Box<Type>>,
    pub result_type: Option<Box<Type>>,
}

impl CallbackType {
    pub fn from_js_value(cx: &mut FunctionContext, value: Handle<JsValue>) -> NeonResult<Self> {
        let obj = value.downcast::<JsObject, _>(cx).or_throw(cx)?;

        let kind_prop: Handle<'_, JsValue> = obj.prop(cx, "kind").get()?;
        let kind_str = kind_prop
            .downcast::<JsString, _>(cx)
            .or_else(|_| cx.throw_type_error("'kind' property is required for callback types"))?
            .value(cx);

        let kind: CallbackKind = kind_str
            .parse()
            .map_err(|e: String| cx.throw_type_error::<_, ()>(e).unwrap_err())?;

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

        let source_type: Option<Handle<JsValue>> = obj.get_opt(cx, "sourceType")?;
        let source_type = match source_type {
            Some(v) => Some(Box::new(Type::from_js_value(cx, v)?)),
            None => None,
        };

        let result_type: Option<Handle<JsValue>> = obj.get_opt(cx, "resultType")?;
        let result_type = match result_type {
            Some(v) => Some(Box::new(Type::from_js_value(cx, v)?)),
            None => None,
        };

        Ok(CallbackType {
            kind,
            arg_types,
            return_type,
            source_type,
            result_type,
        })
    }
}

impl ffi::FfiEncode for CallbackType {
    fn encode(&self, val: &value::Value, optional: bool) -> anyhow::Result<ffi::FfiValue> {
        use anyhow::bail;

        let callback = match val {
            value::Value::Callback(callback) => callback,
            value::Value::Null | value::Value::Undefined if optional => {
                return Ok(self.kind.build_null_ffi_value());
            }
            _ => bail!("Expected a Callback for callback type, got {:?}", val),
        };

        Ok(self.kind.build_ffi_value(callback, self))
    }
}

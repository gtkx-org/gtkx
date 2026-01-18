use std::ffi::c_void;
use std::sync::Arc;
use std::sync::atomic::{AtomicPtr, Ordering};

use gtk4::glib::{
    self, gobject_ffi, translate::FromGlibPtrNone as _, translate::ToGlibPtr as _,
    value::ToValue as _,
};
use neon::prelude::*;

use crate::ffi::{FfiStorage, FfiStorageKind, TrampolineCallbackValue};
use crate::js_dispatch;
use crate::trampoline::{ClosureCallbackData, ClosureGuard};
use crate::types::Type;
use crate::value::Callback;
use crate::{ffi, value};

struct ClosureContext {
    channel: neon::event::Channel,
    js_func: Arc<neon::handle::Root<neon::types::JsFunction>>,
    arg_types: Option<Vec<Type>>,
}

impl ClosureContext {
    fn from_callback(callback: &Callback, callback_type: &CallbackType) -> Self {
        Self {
            channel: callback.channel.clone(),
            js_func: callback.js_func.clone(),
            arg_types: callback_type.arg_types.clone(),
        }
    }

    fn build_void_closure(self) -> glib::Closure {
        glib::Closure::new(move |args: &[glib::Value]| {
            let args_values = value::Value::from_glib_values(args, &self.arg_types)
                .expect("Failed to convert GLib callback arguments");

            js_dispatch::JsDispatcher::global().invoke_and_wait(
                &self.channel,
                &self.js_func,
                args_values,
                false,
                |_| None::<glib::Value>,
            )
        })
    }

    fn build_bool_closure(self) -> glib::Closure {
        glib::Closure::new(move |args: &[glib::Value]| {
            let args_values = value::Value::from_glib_values(args, &self.arg_types)
                .expect("Failed to convert GLib callback arguments");

            js_dispatch::JsDispatcher::global().invoke_and_wait(
                &self.channel,
                &self.js_func,
                args_values,
                true,
                |result| match result {
                    Ok(value::Value::Boolean(b)) => Some(b.to_value()),
                    _ => Some(false.to_value()),
                },
            )
        })
    }

    fn build_object_closure(self) -> glib::Closure {
        glib::Closure::new(move |args: &[glib::Value]| {
            let args_values = value::Value::from_glib_values(args, &self.arg_types)
                .expect("Failed to convert GLib callback arguments");

            js_dispatch::JsDispatcher::global().invoke_and_wait(
                &self.channel,
                &self.js_func,
                args_values,
                true,
                |result| match result {
                    Ok(value::Value::Object(handle)) => {
                        if let Some(ptr) = handle.get_ptr() {
                            let obj: glib::Object = unsafe {
                                glib::Object::from_glib_none(ptr as *mut glib::gobject_ffi::GObject)
                            };
                            Some(obj.to_value())
                        } else {
                            Some(None::<glib::Object>.to_value())
                        }
                    }
                    _ => Some(None::<glib::Object>.to_value()),
                },
            )
        })
    }

    fn build_closure_with_guard(self, return_type: Option<Box<Type>>) -> glib::Closure {
        let closure_holder: Arc<AtomicPtr<gobject_ffi::GClosure>> =
            Arc::new(AtomicPtr::new(std::ptr::null_mut()));
        let closure_holder_for_callback = closure_holder.clone();

        let closure = glib::Closure::new(move |args: &[glib::Value]| {
            let return_type_inner = *return_type.clone().unwrap_or(Box::new(Type::Undefined));

            let args_values = value::Value::from_glib_values(args, &self.arg_types)
                .expect("Failed to convert GLib callback arguments");

            let _guard =
                ClosureGuard::from_ptr(closure_holder_for_callback.load(Ordering::Acquire));

            js_dispatch::JsDispatcher::global().invoke_and_wait(
                &self.channel,
                &self.js_func,
                args_values,
                true,
                |result| match result {
                    Ok(value) => {
                        value::Value::into_glib_value_with_default(value, Some(&return_type_inner))
                    }
                    Err(_) => value::Value::into_glib_value_with_default(
                        value::Value::Undefined,
                        Some(&return_type_inner),
                    ),
                },
            )
        });

        let closure_ptr: *mut gobject_ffi::GClosure = closure.to_glib_full();
        closure_holder.store(closure_ptr, Ordering::Release);

        unsafe { glib::Closure::from_glib_none(closure_ptr) }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CallbackTrampoline {
    Closure,
    AsyncReady,
    Destroy,
    DrawFunc,
    ShortcutFunc,
    TreeListModelCreateFunc,
    AnimationTargetFunc,
    TickCallback,
    PathIntersectionFunc,
}

impl std::str::FromStr for CallbackTrampoline {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "closure" => Ok(CallbackTrampoline::Closure),
            "asyncReady" => Ok(CallbackTrampoline::AsyncReady),
            "destroy" => Ok(CallbackTrampoline::Destroy),
            "drawFunc" => Ok(CallbackTrampoline::DrawFunc),
            "shortcutFunc" => Ok(CallbackTrampoline::ShortcutFunc),
            "treeListModelCreateFunc" => Ok(CallbackTrampoline::TreeListModelCreateFunc),
            "animationTargetFunc" => Ok(CallbackTrampoline::AnimationTargetFunc),
            "tickCallback" => Ok(CallbackTrampoline::TickCallback),
            "pathIntersectionFunc" => Ok(CallbackTrampoline::PathIntersectionFunc),
            _ => Err(format!(
                "'trampoline' must be one of: 'closure', 'asyncReady', 'destroy', 'drawFunc', 'shortcutFunc', 'treeListModelCreateFunc', 'animationTargetFunc', 'tickCallback', 'pathIntersectionFunc'; got '{}'",
                s
            )),
        }
    }
}

impl CallbackTrampoline {
    fn build_closure_value(closure_ptr: *mut gobject_ffi::GClosure) -> ffi::FfiValue {
        ffi::FfiValue::Storage(FfiStorage::new(
            closure_ptr as *mut c_void,
            FfiStorageKind::Unit,
        ))
    }

    fn build_trampoline_value(
        closure: glib::Closure,
        trampoline_ptr: *mut c_void,
        destroy_ptr: Option<*mut c_void>,
        data_first: bool,
    ) -> ffi::FfiValue {
        let closure_ptr: *mut gobject_ffi::GClosure = closure.to_glib_full();

        ffi::FfiValue::TrampolineCallback(TrampolineCallbackValue {
            trampoline_ptr,
            closure: FfiStorage::new(closure_ptr as *mut c_void, FfiStorageKind::Unit),
            destroy_ptr,
            data_first,
        })
    }

    fn build_custom_data_value<T>(
        data: T,
        trampoline_ptr: *mut c_void,
        release_ptr: *mut c_void,
    ) -> ffi::FfiValue {
        let data_ptr = Box::into_raw(Box::new(data)) as *mut c_void;

        ffi::FfiValue::TrampolineCallback(TrampolineCallbackValue {
            trampoline_ptr,
            closure: FfiStorage::new(data_ptr, FfiStorageKind::Callback(data_ptr)),
            destroy_ptr: Some(release_ptr),
            data_first: false,
        })
    }

    pub fn build_ffi_value(
        &self,
        callback: &Callback,
        callback_type: &CallbackType,
    ) -> ffi::FfiValue {
        let ctx = ClosureContext::from_callback(callback, callback_type);

        match self {
            CallbackTrampoline::Closure => {
                let closure = ctx.build_closure_with_guard(callback_type.return_type.clone());
                let closure_ptr: *mut gobject_ffi::GClosure = closure.to_glib_full();
                Self::build_closure_value(closure_ptr)
            }

            CallbackTrampoline::AsyncReady => {
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

                Self::build_trampoline_value(
                    closure,
                    crate::trampoline::async_ready_trampoline as *mut c_void,
                    None,
                    false,
                )
            }

            CallbackTrampoline::Destroy => {
                let channel = callback.channel.clone();
                let js_func = callback.js_func.clone();

                let closure = glib::Closure::new(move |_args: &[glib::Value]| {
                    js_dispatch::JsDispatcher::global().invoke_and_wait(
                        &channel,
                        &js_func,
                        vec![],
                        false,
                        |_| None::<glib::Value>,
                    )
                });

                Self::build_trampoline_value(
                    closure,
                    crate::trampoline::destroy_trampoline as *mut c_void,
                    None,
                    true,
                )
            }

            CallbackTrampoline::DrawFunc => {
                let closure = ctx.build_void_closure();
                TrampolineCallbackValue::build(closure, ClosureCallbackData::draw_func as *mut c_void)
            }

            CallbackTrampoline::ShortcutFunc => {
                let closure = ctx.build_bool_closure();
                TrampolineCallbackValue::build(closure, ClosureCallbackData::shortcut_func as *mut c_void)
            }

            CallbackTrampoline::TreeListModelCreateFunc => {
                let closure = ctx.build_object_closure();
                TrampolineCallbackValue::build(
                    closure,
                    ClosureCallbackData::tree_list_model_create_func as *mut c_void,
                )
            }

            CallbackTrampoline::AnimationTargetFunc => {
                let closure = ctx.build_void_closure();
                TrampolineCallbackValue::build(
                    closure,
                    ClosureCallbackData::animation_target_func as *mut c_void,
                )
            }

            CallbackTrampoline::TickCallback => {
                let tick_data = crate::trampoline::TickCallbackData {
                    channel: callback.channel.clone(),
                    js_func: callback.js_func.clone(),
                    arg_types: callback_type.arg_types.clone(),
                };

                Self::build_custom_data_value(
                    tick_data,
                    crate::trampoline::TickCallbackData::tick_callback as *mut c_void,
                    crate::trampoline::TickCallbackData::release as *mut c_void,
                )
            }

            CallbackTrampoline::PathIntersectionFunc => {
                let data = crate::trampoline::PathIntersectionCallbackData {
                    channel: callback.channel.clone(),
                    js_func: callback.js_func.clone(),
                    arg_types: callback_type.arg_types.clone(),
                };

                Self::build_custom_data_value(
                    data,
                    crate::trampoline::PathIntersectionCallbackData::path_intersection_func as *mut c_void,
                    crate::trampoline::PathIntersectionCallbackData::release as *mut c_void,
                )
            }
        }
    }
}

#[derive(Debug, Clone)]
pub struct CallbackType {
    pub trampoline: CallbackTrampoline,
    pub arg_types: Option<Vec<Type>>,
    pub return_type: Option<Box<Type>>,
    pub source_type: Option<Box<Type>>,
    pub result_type: Option<Box<Type>>,
}

impl CallbackType {
    pub fn from_js_value(cx: &mut FunctionContext, value: Handle<JsValue>) -> NeonResult<Self> {
        let obj = value.downcast::<JsObject, _>(cx).or_throw(cx)?;

        let trampoline_prop: Handle<'_, JsValue> = obj.prop(cx, "trampoline").get()?;
        let trampoline_str = trampoline_prop
            .downcast::<JsString, _>(cx)
            .or_else(|_| {
                cx.throw_type_error("'trampoline' property is required for callback types")
            })?
            .value(cx);

        let trampoline: CallbackTrampoline = trampoline_str
            .parse()
            .map_err(|e: String| cx.throw_type_error::<_, ()>(e).unwrap_err())?;

        let arg_types: Option<Handle<JsArray>> = obj.get_opt(cx, "argTypes")?;
        let arg_types = match arg_types {
            Some(arr) => {
                let vec = arr.to_vec(cx)?;
                let mut types = Vec::with_capacity(vec.len());
                for item in vec {
                    types.push(Type::from_js_value(cx, item)?);
                }
                Some(types)
            }
            None => None,
        };

        let return_type: Option<Handle<JsValue>> = obj.get_opt(cx, "returnType")?;
        let return_type = match return_type {
            Some(v) => Some(Box::new(Type::from_js_value(cx, v)?)),
            None => None,
        };

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
            trampoline,
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
                return Ok(ffi::FfiValue::Ptr(std::ptr::null_mut()));
            }
            _ => bail!("Expected a Callback for callback type, got {:?}", val),
        };

        Ok(self.trampoline.build_ffi_value(callback, self))
    }
}

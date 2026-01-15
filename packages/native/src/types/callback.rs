//! Callback type handling for FFI.
//!
//! GTK and GLib use callbacks extensively for signals, async operations,
//! and customization points. This module provides [`CallbackType`] and
//! [`CallbackTrampoline`] to bridge JavaScript functions to native callbacks.
//!
//! Different callback patterns require different trampolines:
//! - `Closure`: Standard GLib closure with arbitrary arguments
//! - `AsyncReady`: For `GAsyncReadyCallback` async completion handlers
//! - `DrawFunc`: For `GtkDrawingArea` draw functions
//! - `ShortcutFunc`: For `GtkShortcut` handlers
//! - `TreeListModelCreateFunc`: For `GtkTreeListModel` child creation

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
use crate::trampoline::{CallbackData, ClosureGuard};
use crate::types::Type;
use crate::value::Callback;
use crate::{ffi, value};

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
    pub fn build_ffi_value(
        &self,
        callback: &Callback,
        callback_type: &CallbackType,
    ) -> ffi::FfiValue {
        let channel = callback.channel.clone();
        let js_func = callback.js_func.clone();

        match self {
            CallbackTrampoline::Closure => {
                let arg_types = callback_type.arg_types.clone();
                let return_type = callback_type.return_type.clone();

                let closure_holder: Arc<AtomicPtr<gobject_ffi::GClosure>> =
                    Arc::new(AtomicPtr::new(std::ptr::null_mut()));
                let closure_holder_for_callback = closure_holder.clone();

                let closure = glib::Closure::new(move |args: &[glib::Value]| {
                    let return_type_inner =
                        *return_type.clone().unwrap_or(Box::new(Type::Undefined));

                    let args_values = value::Value::from_glib_values(args, &arg_types)
                        .expect("Failed to convert GLib callback arguments");

                    let _guard =
                        ClosureGuard::from_ptr(closure_holder_for_callback.load(Ordering::Acquire));

                    js_dispatch::JsDispatcher::global().invoke_and_wait(
                        &channel,
                        &js_func,
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
                });

                let closure_ptr: *mut gobject_ffi::GClosure = closure.to_glib_full();
                closure_holder.store(closure_ptr, Ordering::Release);

                ffi::FfiValue::Storage(FfiStorage::new(
                    closure_ptr as *mut c_void,
                    FfiStorageKind::Unit,
                ))
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
                let trampoline_ptr = crate::trampoline::async_ready_trampoline as *mut c_void;

                ffi::FfiValue::TrampolineCallback(TrampolineCallbackValue {
                    trampoline_ptr,
                    closure: FfiStorage::new(closure_ptr as *mut c_void, FfiStorageKind::Unit),
                    destroy_ptr: None,
                    data_first: false,
                })
            }

            CallbackTrampoline::Destroy => {
                let closure = glib::Closure::new(move |_args: &[glib::Value]| {
                    js_dispatch::JsDispatcher::global().invoke_and_wait(
                        &channel,
                        &js_func,
                        vec![],
                        false,
                        |_| None::<glib::Value>,
                    )
                });

                let closure_ptr: *mut gobject_ffi::GClosure = closure.to_glib_full();
                let trampoline_ptr = crate::trampoline::destroy_trampoline as *mut c_void;

                ffi::FfiValue::TrampolineCallback(TrampolineCallbackValue {
                    trampoline_ptr,
                    closure: FfiStorage::new(closure_ptr as *mut c_void, FfiStorageKind::Unit),
                    destroy_ptr: None,
                    data_first: true,
                })
            }

            CallbackTrampoline::DrawFunc => {
                let arg_types = callback_type.arg_types.clone();

                let closure = glib::Closure::new(move |args: &[glib::Value]| {
                    let args_values = value::Value::from_glib_values(args, &arg_types)
                        .expect("Failed to convert GLib draw callback arguments");

                    js_dispatch::JsDispatcher::global().invoke_and_wait(
                        &channel,
                        &js_func,
                        args_values,
                        false,
                        |_| None::<glib::Value>,
                    )
                });

                TrampolineCallbackValue::build(closure, CallbackData::draw_func as *mut c_void)
            }

            CallbackTrampoline::ShortcutFunc => {
                let arg_types = callback_type.arg_types.clone();

                let closure = glib::Closure::new(move |args: &[glib::Value]| {
                    let args_values = value::Value::from_glib_values(args, &arg_types)
                        .expect("Failed to convert GLib shortcut callback arguments");

                    js_dispatch::JsDispatcher::global().invoke_and_wait(
                        &channel,
                        &js_func,
                        args_values,
                        true,
                        |result| match result {
                            Ok(value::Value::Boolean(b)) => Some(b.to_value()),
                            _ => Some(false.to_value()),
                        },
                    )
                });

                TrampolineCallbackValue::build(closure, CallbackData::shortcut_func as *mut c_void)
            }

            CallbackTrampoline::TreeListModelCreateFunc => {
                let arg_types = callback_type.arg_types.clone();

                let closure = glib::Closure::new(move |args: &[glib::Value]| {
                    let args_values = value::Value::from_glib_values(args, &arg_types)
                        .expect("Failed to convert GLib tree list model callback arguments");

                    js_dispatch::JsDispatcher::global().invoke_and_wait(
                        &channel,
                        &js_func,
                        args_values,
                        true,
                        |result| match result {
                            Ok(value::Value::Object(obj_id)) => {
                                if let Some(ptr) = obj_id.get_ptr() {
                                    let obj: glib::Object = unsafe {
                                        glib::Object::from_glib_none(
                                            ptr as *mut glib::gobject_ffi::GObject,
                                        )
                                    };
                                    Some(obj.to_value())
                                } else {
                                    Some(None::<glib::Object>.to_value())
                                }
                            }
                            _ => Some(None::<glib::Object>.to_value()),
                        },
                    )
                });

                TrampolineCallbackValue::build(
                    closure,
                    CallbackData::tree_list_model_create_func as *mut c_void,
                )
            }

            CallbackTrampoline::AnimationTargetFunc => {
                let arg_types = callback_type.arg_types.clone();

                let closure = glib::Closure::new(move |args: &[glib::Value]| {
                    let args_values = value::Value::from_glib_values(args, &arg_types)
                        .expect("Failed to convert animation target callback arguments");

                    js_dispatch::JsDispatcher::global().invoke_and_wait(
                        &channel,
                        &js_func,
                        args_values,
                        false,
                        |_| None::<glib::Value>,
                    )
                });

                TrampolineCallbackValue::build(
                    closure,
                    CallbackData::animation_target_func as *mut c_void,
                )
            }

            CallbackTrampoline::TickCallback => {
                let arg_types = callback_type.arg_types.clone();

                let tick_data = Box::new(crate::trampoline::TickCallbackData {
                    channel: channel.clone(),
                    js_func: js_func.clone(),
                    arg_types,
                });
                let data_ptr = Box::into_raw(tick_data) as *mut c_void;

                ffi::FfiValue::TrampolineCallback(TrampolineCallbackValue {
                    trampoline_ptr: crate::trampoline::TickCallbackData::trampoline as *mut c_void,
                    closure: FfiStorage::new(data_ptr, FfiStorageKind::Callback(data_ptr)),
                    destroy_ptr: Some(crate::trampoline::TickCallbackData::release as *mut c_void),
                    data_first: false,
                })
            }

            CallbackTrampoline::PathIntersectionFunc => {
                let arg_types = callback_type.arg_types.clone();

                let data = Box::new(crate::trampoline::PathIntersectionCallbackData {
                    channel: channel.clone(),
                    js_func: js_func.clone(),
                    arg_types,
                });
                let data_ptr = Box::into_raw(data) as *mut c_void;

                ffi::FfiValue::TrampolineCallback(TrampolineCallbackValue {
                    trampoline_ptr: crate::trampoline::PathIntersectionCallbackData::trampoline
                        as *mut c_void,
                    closure: FfiStorage::new(data_ptr, FfiStorageKind::Callback(data_ptr)),
                    destroy_ptr: Some(
                        crate::trampoline::PathIntersectionCallbackData::release as *mut c_void,
                    ),
                    data_first: false,
                })
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

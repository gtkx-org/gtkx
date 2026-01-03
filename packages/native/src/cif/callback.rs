use std::{ffi::c_void, sync::Arc};

use anyhow::bail;
use gtk4::glib::{self, translate::FromGlibPtrNone as _, translate::ToGlibPtr as _, value::ToValue as _};
use neon::prelude::*;

use super::owned_ptr::OwnedPtr;
use super::trampoline::{TrampolineCallbackValue, build_trampoline_callback};
use super::Value;
use crate::{arg, callback, gtk_dispatch, js_dispatch, types::*, value};

pub fn closure_to_glib_full(closure: glib::Closure) -> *mut c_void {
    let ptr: *mut glib::gobject_ffi::GClosure = closure.to_glib_full();
    ptr as *mut c_void
}

fn wait_for_js_result<T, F>(
    rx: std::sync::mpsc::Receiver<Result<value::Value, ()>>,
    on_result: F,
) -> T
where
    F: FnOnce(Result<value::Value, ()>) -> T,
{
    use std::time::Duration;
    const POLL_INTERVAL: Duration = Duration::from_micros(100);

    loop {
        gtk_dispatch::dispatch_pending();

        match rx.recv_timeout(POLL_INTERVAL) {
            Ok(result) => return on_result(result),
            Err(std::sync::mpsc::RecvTimeoutError::Timeout) => {
                continue;
            }
            Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => {
                return on_result(Err(()));
            }
        }
    }
}

fn invoke_and_wait_for_js_result<T, F>(
    channel: &Channel,
    callback: &Arc<Root<JsFunction>>,
    args_values: Vec<value::Value>,
    capture_result: bool,
    on_result: F,
) -> T
where
    F: FnOnce(Result<value::Value, ()>) -> T,
{
    let rx = if gtk_dispatch::is_js_waiting() {
        js_dispatch::queue(callback.clone(), args_values, capture_result)
    } else {
        js_dispatch::queue_with_wakeup(channel, callback.clone(), args_values, capture_result)
    };

    wait_for_js_result(rx, on_result)
}

fn convert_glib_args(
    args: &[glib::Value],
    arg_types: &Option<Vec<Type>>,
) -> anyhow::Result<Vec<value::Value>> {
    match arg_types {
        Some(types) => args
            .iter()
            .zip(types.iter())
            .map(|(gval, type_)| value::Value::from_glib_value(gval, type_))
            .collect(),
        None => args.iter().map(value::Value::try_from).collect(),
    }
}

pub(super) fn try_from_callback(arg: &arg::Arg, type_: &CallbackType) -> anyhow::Result<Value> {
    let cb = match &arg.value {
        value::Value::Callback(callback) => callback,
        value::Value::Null | value::Value::Undefined if arg.optional => {
            return Ok(Value::Ptr(std::ptr::null_mut()));
        }
        _ => bail!("Expected a Callback for callback type, got {:?}", arg.value),
    };

    let channel = cb.channel.clone();
    let callback = cb.js_func.clone();

    match type_.trampoline {
        CallbackTrampoline::Closure => {
            let arg_types = type_.arg_types.clone();
            let return_type = type_.return_type.clone();

            let closure = glib::Closure::new(move |args: &[glib::Value]| {
                let args_values = convert_glib_args(args, &arg_types)
                    .expect("Failed to convert GLib callback arguments");
                let return_type = *return_type.clone().unwrap_or(Box::new(Type::Undefined));

                invoke_and_wait_for_js_result(
                    &channel,
                    &callback,
                    args_values,
                    true,
                    |result| match result {
                        Ok(value) => value::Value::into_glib_value_with_default(
                            value,
                            Some(&return_type),
                        ),
                        Err(_) => value::Value::into_glib_value_with_default(
                            value::Value::Undefined,
                            Some(&return_type),
                        ),
                    },
                )
            });

            let closure_ptr = closure_to_glib_full(closure);
            Ok(Value::OwnedPtr(OwnedPtr::new((), closure_ptr)))
        }

        CallbackTrampoline::AsyncReady => {
            let source_type = type_.source_type.clone().unwrap_or(Box::new(Type::Null));
            let result_type = type_.result_type.clone().unwrap_or(Box::new(Type::Null));

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

                let args_values = vec![source_value, result_value];

                invoke_and_wait_for_js_result(&channel, &callback, args_values, false, |_| {
                    None::<glib::Value>
                })
            });

            let closure_ptr = closure_to_glib_full(closure);
            let trampoline_ptr = callback::get_async_ready_trampoline_ptr();

            Ok(Value::TrampolineCallback(TrampolineCallbackValue {
                trampoline_ptr,
                closure: OwnedPtr::new((), closure_ptr),
                destroy_ptr: None,
                data_first: false,
            }))
        }

        CallbackTrampoline::Destroy => {
            let closure = glib::Closure::new(move |_args: &[glib::Value]| {
                invoke_and_wait_for_js_result(&channel, &callback, vec![], false, |_| {
                    None::<glib::Value>
                })
            });

            let closure_ptr = closure_to_glib_full(closure);
            let trampoline_ptr = callback::get_destroy_trampoline_ptr();

            Ok(Value::TrampolineCallback(TrampolineCallbackValue {
                trampoline_ptr,
                closure: OwnedPtr::new((), closure_ptr),
                destroy_ptr: None,
                data_first: true,
            }))
        }

        CallbackTrampoline::DrawFunc => {
            let arg_types = type_.arg_types.clone();

            let closure = glib::Closure::new(move |args: &[glib::Value]| {
                let args_values = convert_glib_args(args, &arg_types)
                    .expect("Failed to convert GLib draw callback arguments");

                invoke_and_wait_for_js_result(&channel, &callback, args_values, false, |_| {
                    None::<glib::Value>
                })
            });

            Ok(build_trampoline_callback(closure, &callback::TrampolineSpec::draw_func()))
        }

        CallbackTrampoline::ShortcutFunc => {
            let arg_types = type_.arg_types.clone();

            let closure = glib::Closure::new(move |args: &[glib::Value]| {
                let args_values = convert_glib_args(args, &arg_types)
                    .expect("Failed to convert GLib shortcut callback arguments");

                invoke_and_wait_for_js_result(
                    &channel,
                    &callback,
                    args_values,
                    true,
                    |result| match result {
                        Ok(value::Value::Boolean(b)) => Some(b.to_value()),
                        _ => Some(false.to_value()),
                    },
                )
            });

            Ok(build_trampoline_callback(closure, &callback::TrampolineSpec::shortcut_func()))
        }

        CallbackTrampoline::TreeListModelCreateFunc => {
            let arg_types = type_.arg_types.clone();

            let closure = glib::Closure::new(move |args: &[glib::Value]| {
                let args_values = convert_glib_args(args, &arg_types)
                    .expect("Failed to convert GLib tree list model callback arguments");

                invoke_and_wait_for_js_result(
                    &channel,
                    &callback,
                    args_values,
                    true,
                    |result| match result {
                        Ok(value::Value::Object(obj_id)) => {
                            if let Some(ptr) = obj_id.as_ptr() {
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

            Ok(build_trampoline_callback(
                closure,
                &callback::TrampolineSpec::tree_list_model_create_func(),
            ))
        }
    }
}

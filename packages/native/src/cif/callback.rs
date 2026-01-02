use anyhow::bail;
use gtk4::glib::{self, translate::FromGlibPtrNone as _, value::ToValue as _};

use super::helpers::{
    arg_types_to_glib_types, closure_ptr_for_transfer, closure_to_glib_full, convert_glib_args,
    invoke_and_wait_for_js_result,
};
use super::owned_ptr::OwnedPtr;
use super::trampoline::{TrampolineCallbackValue, build_trampoline_callback};
use super::Value;
use crate::{arg, callback, types::*, value};

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

            let closure_ptr = closure_to_glib_full(&closure);
            Ok(Value::OwnedPtr(OwnedPtr::new(closure, closure_ptr)))
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

            let closure_ptr = closure_ptr_for_transfer(closure);
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

            let closure_ptr = closure_ptr_for_transfer(closure);
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
            let arg_gtypes = arg_types_to_glib_types(&arg_types);

            let closure = glib::Closure::new(move |args: &[glib::Value]| {
                let args_values = convert_glib_args(args, &arg_types)
                    .expect("Failed to convert GLib draw callback arguments");

                invoke_and_wait_for_js_result(&channel, &callback, args_values, false, |_| {
                    None::<glib::Value>
                })
            });

            Ok(build_trampoline_callback(
                closure,
                arg_gtypes,
                &callback::TrampolineSpec::draw_func(),
            ))
        }

        CallbackTrampoline::ShortcutFunc => {
            let arg_types = type_.arg_types.clone();
            let arg_gtypes = arg_types_to_glib_types(&arg_types);

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

            Ok(build_trampoline_callback(
                closure,
                arg_gtypes,
                &callback::TrampolineSpec::shortcut_func(),
            ))
        }

        CallbackTrampoline::TreeListModelCreateFunc => {
            let arg_types = type_.arg_types.clone();
            let arg_gtypes = arg_types_to_glib_types(&arg_types);

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
                arg_gtypes,
                &callback::TrampolineSpec::tree_list_model_create_func(),
            ))
        }
    }
}

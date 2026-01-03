use std::{ffi::c_void, sync::Arc};

use anyhow::bail;
use gtk4::glib::{self, translate::ToGlibPtr as _};
use neon::prelude::*;

use crate::{gtk_dispatch, js_dispatch, types::*, value};

pub(super) fn extract_object_ptr(val: &value::Value, type_name: &str) -> anyhow::Result<*mut c_void> {
    match val {
        value::Value::Object(id) => id
            .as_ptr()
            .ok_or_else(|| anyhow::anyhow!("{} has been garbage collected", type_name)),
        value::Value::Null | value::Value::Undefined => Ok(std::ptr::null_mut()),
        _ => bail!("Expected an Object for {} type, got {:?}", type_name, val),
    }
}

pub(super) fn wait_for_js_result<T, F>(
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

pub(super) fn invoke_and_wait_for_js_result<T, F>(
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

pub fn closure_to_glib_full(closure: &glib::Closure) -> *mut c_void {
    let ptr: *mut glib::gobject_ffi::GClosure = closure.to_glib_full();
    ptr as *mut c_void
}

pub fn closure_ptr_for_transfer(closure: glib::Closure) -> *mut c_void {
    let ptr: *mut glib::gobject_ffi::GClosure = closure.to_glib_full();
    ptr as *mut c_void
}

pub(super) fn convert_glib_args(
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

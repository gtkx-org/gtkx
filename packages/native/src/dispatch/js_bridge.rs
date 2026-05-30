//! [`Mailbox`] methods that cross into the JavaScript runtime.
//!
//! Every function here either invokes a JavaScript callback, converts values
//! through a live [`napi::Env`], or drives the wake threadsafe function. None
//! of it can run without a Node.js runtime, so it is excluded from coverage
//! instrumentation — there is no JavaScript engine or libuv event loop in a
//! `cargo test` process to exercise it against.

use std::sync::atomic::Ordering;
use std::sync::{Arc, mpsc};

use napi::bindgen_prelude::{FromNapiValue, Unknown};
use napi::threadsafe_function::ThreadsafeFunctionCallMode;
use napi::{Env, JsFunction, JsObject, NapiValue as _};

use super::{GlibDisconnectedError, Mailbox, NodeCallback, NodeCallbackResult, WakeJsTsfn};
use crate::error_reporter::NativeErrorReporter;
use crate::value::{JsRef, Value};

impl Mailbox {
    /// Stores the threadsafe function used to wake the JS thread from arbitrary
    /// other threads. Set once during `start()` and invoked by the `GLib` thread
    /// when callbacks are pushed onto the node inbox.
    #[cfg_attr(coverage_nightly, coverage(off))]
    pub fn set_wake_tsfn(&self, tsfn: Arc<WakeJsTsfn>) {
        let _ = self.wake_js_tsfn.set(tsfn);
    }

    #[cfg_attr(coverage_nightly, coverage(off))]
    fn push_node_callback(&self, callback: NodeCallback) {
        self.node_inbox
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
            .push_back(callback);
        self.wake_js.notify();
    }

    #[cfg_attr(coverage_nightly, coverage(off))]
    fn pop_node_callback(&self) -> Option<NodeCallback> {
        self.node_inbox
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
            .pop_front()
    }

    /// Schedules a task on the `GLib` thread and blocks the JS thread until the
    /// task completes. While blocked, drains any callbacks pushed onto the
    /// node inbox so re-entrant `GLib → JS → GLib` calls progress.
    #[cfg_attr(coverage_nightly, coverage(off))]
    pub fn dispatch_to_glib_and_wait<R, F>(
        &self,
        env: Env,
        task: F,
    ) -> Result<R, GlibDisconnectedError>
    where
        F: FnOnce() -> R + Send + 'static,
        R: Send + 'static,
    {
        let (tx, rx) = mpsc::channel();
        self.schedule_glib(Box::new(move || {
            if tx.send(task()).is_err() {
                NativeErrorReporter::global()
                    .report_str("GLib dispatch completed but result channel was closed");
            }
        }));
        self.wait_for_glib_result(env, &rx)
    }

    /// Blocks the JS thread until the receiver yields a value, draining any
    /// pending node callbacks along the way. Useful when callers schedule
    /// tasks via [`Mailbox::schedule_glib`] and want fine-grained control over
    /// what value the `GLib` task signals back through (for example, the
    /// freeze loop signals readiness mid-execution).
    #[cfg_attr(coverage_nightly, coverage(off))]
    pub fn wait_for_glib_result<R>(
        &self,
        env: Env,
        rx: &mpsc::Receiver<R>,
    ) -> Result<R, GlibDisconnectedError> {
        loop {
            self.process_node_pending(env);

            match rx.try_recv() {
                Ok(result) => return Ok(result),
                Err(mpsc::TryRecvError::Disconnected) => return Err(GlibDisconnectedError),
                Err(mpsc::TryRecvError::Empty) => self.wake_js.wait(),
            }
        }
    }

    /// Pushes a JS callback onto the node inbox and blocks the `GLib` thread
    /// until JS produces a result. While blocked, drains GLib-bound tasks
    /// pushed by the executing JS callback so re-entrant `JS → GLib → JS`
    /// calls progress.
    #[cfg_attr(coverage_nightly, coverage(off))]
    pub fn invoke_node_and_wait(
        &self,
        callback: &Arc<JsRef<JsFunction>>,
        args: Vec<Value>,
        capture_result: bool,
    ) -> anyhow::Result<Value> {
        let (value, _) =
            self.invoke_node_and_wait_with_cells(callback, args, capture_result, Vec::new())?;
        Ok(value)
    }

    /// Like [`Self::invoke_node_and_wait`] but, for each index in
    /// `out_cell_indices`, passes that argument to JS wrapped in a mutable
    /// `{ value }` cell and reads the cell's `value` back after the callback
    /// returns. Used by the trampoline path to flush signal out-parameters the
    /// handler wrote into their cells.
    #[cfg_attr(coverage_nightly, coverage(off))]
    pub fn invoke_node_and_wait_with_cells(
        &self,
        callback: &Arc<JsRef<JsFunction>>,
        args: Vec<Value>,
        capture_result: bool,
        out_cell_indices: Vec<usize>,
    ) -> anyhow::Result<super::NodeCallbackResult> {
        let callback_depth = self.callback_depth.load(Ordering::Acquire) + 1;
        let (tx, rx) = mpsc::channel();

        self.push_node_callback(NodeCallback {
            callback: callback.clone(),
            args,
            capture_result,
            out_cell_indices,
            result_tx: tx,
        });

        if let Some(tsfn) = self.wake_js_tsfn.get() {
            tsfn.call((), ThreadsafeFunctionCallMode::NonBlocking);
        }

        self.wait_for_node_result(&rx, callback_depth)
    }

    /// Blocks the `GLib` thread until the node callback at `callback_depth`
    /// produces a result, draining only `glib_inbox` tasks enqueued at that
    /// depth or deeper — the nested calls the callback itself makes.
    #[cfg_attr(coverage_nightly, coverage(off))]
    fn wait_for_node_result(
        &self,
        rx: &mpsc::Receiver<anyhow::Result<NodeCallbackResult>>,
        callback_depth: usize,
    ) -> anyhow::Result<NodeCallbackResult> {
        loop {
            self.dispatch_pending_from_depth(callback_depth);

            match rx.try_recv() {
                Ok(result) => return result,
                Err(mpsc::TryRecvError::Disconnected) => {
                    return Err(anyhow::anyhow!("JS callback channel disconnected"));
                }
                Err(mpsc::TryRecvError::Empty) => self.wake_glib.wait(),
            }
        }
    }

    /// Drains all currently-queued node callbacks and invokes them in JS.
    /// Intended to run on the JS thread, either from the wake TSFN scheduled by
    /// [`Mailbox::invoke_node_and_wait`] or from the wait loop in
    /// [`Mailbox::wait_for_glib_result`].
    #[cfg_attr(coverage_nightly, coverage(off))]
    pub fn process_node_pending(&self, env: Env) {
        while let Some(pending) = self.pop_node_callback() {
            let NodeCallback {
                callback,
                args,
                capture_result,
                out_cell_indices,
                result_tx,
            } = pending;
            self.enter_callback();
            let result =
                Self::execute_callback(env, &callback, args, capture_result, &out_cell_indices);
            self.leave_callback();
            if result_tx.send(result).is_err() {
                NativeErrorReporter::global()
                    .report_str("Node callback completed but result channel was closed");
            }
            self.wake_glib.notify();
        }
    }

    /// Wraps `value` in a fresh `{ value }` JavaScript object so a callback can
    /// mutate the slot in place — the cell a trampoline out-parameter is
    /// written through.
    #[cfg_attr(coverage_nightly, coverage(off))]
    fn wrap_out_cell<'env>(env: &'env Env, value: Unknown<'env>) -> napi::Result<Unknown<'env>> {
        let mut cell = env.create_object()?;
        cell.set_named_property("value", value)?;
        Ok(unsafe { Unknown::from_raw_unchecked(env.raw(), napi::NapiRaw::raw(&cell)) })
    }

    /// Reads the `value` slot of each out-cell argument back into a [`Value`],
    /// paired with the argument's index, after the callback has run.
    #[cfg_attr(coverage_nightly, coverage(off))]
    fn read_out_cells(
        env: &Env,
        js_args: &[Unknown<'_>],
        out_cell_indices: &[usize],
    ) -> napi::Result<Vec<(usize, Value)>> {
        let mut cells = Vec::with_capacity(out_cell_indices.len());
        for &index in out_cell_indices {
            let Some(arg) = js_args.get(index) else {
                continue;
            };
            let cell: JsObject =
                unsafe { JsObject::from_raw_unchecked(env.raw(), napi::JsValue::raw(arg)) };
            let slot: Unknown<'_> = cell.get_named_property("value")?;
            cells.push((index, Value::from_js_value(env, slot)?));
        }
        Ok(cells)
    }

    #[cfg_attr(coverage_nightly, coverage(off))]
    fn execute_callback(
        env: Env,
        callback: &Arc<JsRef<JsFunction>>,
        args: Vec<Value>,
        capture_result: bool,
        out_cell_indices: &[usize],
    ) -> anyhow::Result<NodeCallbackResult> {
        use napi::sys;

        let js_args: Vec<Unknown<'_>> = args
            .into_iter()
            .enumerate()
            .map(|(index, v)| {
                let converted = v
                    .to_js_value(&env)
                    .map_err(|e| anyhow::anyhow!("converting callback arg: {e}"))?;
                if out_cell_indices.contains(&index) {
                    Self::wrap_out_cell(&env, converted)
                        .map_err(|e| anyhow::anyhow!("wrapping out-cell arg: {e}"))
                } else {
                    Ok(converted)
                }
            })
            .collect::<anyhow::Result<Vec<_>>>()?;

        let raw_args: Vec<sys::napi_value> = js_args.iter().map(napi::JsValue::raw).collect();

        let func = callback
            .get_value(&env)
            .map_err(|e| anyhow::anyhow!("retrieving callback function: {e}"))?;

        let func_raw = unsafe { napi::NapiRaw::raw(&func) };

        let mut undef_this = std::ptr::null_mut();
        unsafe {
            sys::napi_get_undefined(env.raw(), &mut undef_this);
        }

        let mut return_value = std::ptr::null_mut();
        let status = unsafe {
            sys::napi_call_function(
                env.raw(),
                undef_this,
                func_raw,
                raw_args.len(),
                raw_args.as_ptr(),
                &mut return_value,
            )
        };

        if status == sys::Status::napi_pending_exception {
            let mut exception = std::ptr::null_mut();
            unsafe {
                sys::napi_get_and_clear_last_exception(env.raw(), &mut exception);
            }
            let msg = if exception.is_null() {
                "JS callback threw an exception".to_owned()
            } else {
                Self::extract_exception_message(env.raw(), exception)
            };
            return Err(anyhow::anyhow!("{msg}"));
        }
        if status != sys::Status::napi_ok {
            return Err(anyhow::anyhow!("napi_call_function failed: {status:?}"));
        }

        let cells = Self::read_out_cells(&env, &js_args, out_cell_indices)
            .map_err(|e| anyhow::anyhow!("reading out-cell args: {e}"))?;

        let value = if capture_result {
            let unknown = unsafe { Unknown::from_raw_unchecked(env.raw(), return_value) };
            Value::from_js_value(&env, unknown)
                .map_err(|e| anyhow::anyhow!("converting callback result: {e}"))?
        } else {
            Value::Undefined
        };
        Ok((value, cells))
    }

    #[cfg_attr(coverage_nightly, coverage(off))]
    fn extract_exception_message(
        env: napi::sys::napi_env,
        exception: napi::sys::napi_value,
    ) -> String {
        use napi::sys;

        let mut value_type = sys::ValueType::napi_undefined;
        unsafe {
            sys::napi_typeof(env, exception, &mut value_type);
        }

        if value_type == sys::ValueType::napi_object {
            let mut message = std::ptr::null_mut();
            unsafe {
                sys::napi_get_named_property(env, exception, c"message".as_ptr(), &mut message);
            }
            if !message.is_null()
                && let Ok(s) = unsafe { String::from_napi_value(env, message) }
            {
                return s;
            }
        } else if value_type == sys::ValueType::napi_string
            && let Ok(s) = unsafe { String::from_napi_value(env, exception) }
        {
            return s;
        }

        "unknown exception".to_owned()
    }
}

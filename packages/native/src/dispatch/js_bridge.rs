use std::panic::{self, AssertUnwindSafe};
use std::sync::{Arc, mpsc};

use napi::bindgen_prelude::{FromNapiValue, Unknown};
use napi::threadsafe_function::ThreadsafeFunctionCallMode;
use napi::{Env, JsFunction, JsObject, NapiValue as _};

use super::{
    GlibDispatchError, JsReference, Mailbox, NodeCallback, NodeCallbackResult, NodeTask,
    WakeJsTsfn, send_or_report,
};
use crate::panic_handler::format_panic_payload;
use crate::toggle_ref::RefOp;
use crate::value::{JsRef, Value};

#[cfg_attr(coverage_nightly, coverage(off))]
fn node_channel_disconnected<R>() -> anyhow::Result<R> {
    Err(anyhow::anyhow!("JS callback channel disconnected"))
}

#[derive(Debug)]
pub struct ReadySignal {
    tx: mpsc::Sender<()>,
}

impl ReadySignal {
    #[cfg_attr(coverage_nightly, coverage(off))]
    pub fn signal(self) {
        send_or_report(
            &self.tx,
            (),
            "Long-lived GLib task ready signal channel was closed",
        );
        Mailbox::global().wake_js.notify();
    }
}

#[cfg_attr(coverage_nightly, coverage(off))]
fn poll_result<R>(rx: &mpsc::Receiver<R>) -> Result<Option<R>, GlibDispatchError> {
    match rx.try_recv() {
        Ok(result) => Ok(Some(result)),
        Err(mpsc::TryRecvError::Disconnected) => Err(GlibDispatchError::disconnected()),
        Err(mpsc::TryRecvError::Empty) => Ok(None),
    }
}

impl Mailbox {
    #[cfg_attr(coverage_nightly, coverage(off))]
    fn set_wake_tsfn(&self, tsfn: Arc<WakeJsTsfn>) {
        let _ = self.wake_js_tsfn.set(tsfn);
    }

    #[cfg_attr(coverage_nightly, coverage(off))]
    pub fn install_wake(&self, env: Env) -> napi::Result<()> {
        let wake_js_fn = env.create_function_from_closure::<(), _, _>("gtkx_wake_js", |ctx| {
            Self::global().process_node_pending(*ctx.env);
            Ok(())
        })?;

        let wake_tsfn: WakeJsTsfn = wake_js_fn
            .build_threadsafe_function::<()>()
            .weak::<true>()
            .callee_handled::<false>()
            .build()?;

        self.set_wake_tsfn(Arc::new(wake_tsfn));
        Ok(())
    }

    #[cfg_attr(coverage_nightly, coverage(off))]
    fn push_node_task(&self, task: NodeTask) {
        self.node_inbox.lock().push_back(task);
        self.wake_js.notify();
    }

    #[cfg_attr(coverage_nightly, coverage(off))]
    fn pop_node_task(&self) -> Option<NodeTask> {
        self.node_inbox.lock().pop_front()
    }

    #[cfg_attr(coverage_nightly, coverage(off))]
    fn wake_node_thread(&self) {
        if let Some(tsfn) = self.wake_js_tsfn.get() {
            tsfn.call((), ThreadsafeFunctionCallMode::NonBlocking);
        }
    }

    #[cfg_attr(coverage_nightly, coverage(off))]
    pub(crate) fn schedule_js_reference_delete(&self, reference: JsReference) {
        self.push_node_task(NodeTask::DeleteReference(reference));
        self.wake_node_thread();
    }

    #[cfg_attr(coverage_nightly, coverage(off))]
    pub fn dispatch_to_glib_and_wait<R, F>(&self, env: Env, task: F) -> Result<R, GlibDispatchError>
    where
        F: FnOnce() -> R + Send + 'static,
        R: Send + 'static,
    {
        let (tx, rx) = mpsc::channel();
        self.schedule_glib(Box::new(move || {
            let outcome = panic::catch_unwind(AssertUnwindSafe(task))
                .map_err(|payload| format_panic_payload(&*payload));
            send_or_report(
                &tx,
                outcome,
                "GLib dispatch completed but result channel was closed",
            );
        }));
        self.wait_for_glib_result(env, &rx)?
            .map_err(|message| GlibDispatchError::task_panicked(&message))
    }

    #[cfg_attr(coverage_nightly, coverage(off))]
    pub fn dispatch_and_wait_napi<R, F>(&self, env: Env, task: F) -> napi::Result<R>
    where
        F: FnOnce() -> R + Send + 'static,
        R: Send + 'static,
    {
        self.dispatch_to_glib_and_wait(env, task)
            .map_err(|e| napi::Error::new(napi::Status::GenericFailure, e.to_string()))
    }

    #[cfg_attr(coverage_nightly, coverage(off))]
    pub fn dispatch_long_lived_glib_task<F>(&self, env: Env, task: F) -> napi::Result<()>
    where
        F: FnOnce(ReadySignal) + Send + 'static,
    {
        let (tx, rx) = mpsc::channel::<()>();
        self.schedule_glib(Box::new(move || task(ReadySignal { tx })));
        self.wait_for_glib_result(env, &rx)
            .map_err(|e| napi::Error::new(napi::Status::GenericFailure, e.to_string()))
    }

    #[cfg_attr(coverage_nightly, coverage(off))]
    fn wait_for_glib_result<R>(
        &self,
        env: Env,
        rx: &mpsc::Receiver<R>,
    ) -> Result<R, GlibDispatchError> {
        loop {
            if let Some(result) = poll_result(rx)? {
                return Ok(result);
            }

            self.process_node_pending(env);

            if let Some(result) = poll_result(rx)? {
                return Ok(result);
            }
            self.wake_js.wait();
        }
    }

    #[cfg_attr(coverage_nightly, coverage(off))]
    pub fn invoke_node_and_wait_with_cells(
        &self,
        callback: &Arc<JsRef<JsFunction>>,
        args: Vec<Value>,
        capture_result: bool,
        out_cell_indices: Vec<usize>,
    ) -> anyhow::Result<super::NodeCallbackResult> {
        let callback = callback.clone();
        self.submit_blocking_node_task(move |result_tx, glib_initiated| {
            NodeTask::Callback(NodeCallback {
                callback,
                args,
                capture_result,
                out_cell_indices,
                result_tx,
                glib_initiated,
            })
        })
    }

    #[cfg_attr(coverage_nightly, coverage(off))]
    pub fn apply_wrapper_ref_op_and_wait(&self, ref_ptr: usize, op: RefOp) -> anyhow::Result<()> {
        self.submit_blocking_node_task(|result_tx, glib_initiated| NodeTask::WrapperRefOp {
            ref_ptr,
            op,
            result_tx,
            glib_initiated,
        })
    }

    #[cfg_attr(coverage_nightly, coverage(off))]
    fn submit_blocking_node_task<R>(
        &self,
        build: impl FnOnce(mpsc::Sender<anyhow::Result<R>>, bool) -> NodeTask,
    ) -> anyhow::Result<R> {
        let (glib_initiated, wait_depth) = self.node_wait_setup();
        let (tx, rx) = mpsc::channel();

        self.push_node_task(build(tx, glib_initiated));

        self.wake_node_thread();
        self.wait_node(&rx, wait_depth)
    }

    /// Computes whether a blocking node task is initiated from the `GLib` thread and, if so, the
    /// depth at which the subsequent wait must drain `GLib` tasks.
    ///
    /// `glib_initiated` is true when the current thread owns the default `GLib` main context, i.e.
    /// the task is being submitted from inside a GLib-thread callback. In that case the wait
    /// must drain only tasks deeper than the current frame, so `wait_depth = callback_depth + 1`
    /// (see the module-level depth-tagged reentrancy invariant in `dispatch`).
    #[cfg_attr(coverage_nightly, coverage(off))]
    fn node_wait_setup(&self) -> (bool, Option<usize>) {
        let glib_initiated = glib::MainContext::default().is_owner();
        let wait_depth = glib_initiated.then(|| {
            self.callback_depth
                .load(std::sync::atomic::Ordering::Acquire)
                + 1
        });
        (glib_initiated, wait_depth)
    }

    #[cfg_attr(coverage_nightly, coverage(off))]
    fn wait_node<R>(
        &self,
        rx: &mpsc::Receiver<anyhow::Result<R>>,
        wait_depth: Option<usize>,
    ) -> anyhow::Result<R> {
        let Some(depth) = wait_depth else {
            return rx.recv().unwrap_or_else(|_| node_channel_disconnected());
        };
        self.wait_for_node_result(rx, depth)
    }

    /// Blocks for a node-task result while keeping the `GLib` thread live at a bounded depth.
    ///
    /// This runs on the `GLib` thread for a task it itself initiated. While waiting, it repeatedly
    /// drains `GLib` tasks tagged `depth >= callback_depth` via [`Mailbox::dispatch_pending_from_depth`]
    /// — strictly the inner frame's own work — so the inner callback can make progress without
    /// re-running a task enqueued by an outer frame, preventing a nested cross-thread deadlock
    /// (see the module-level depth-tagged reentrancy invariant in `dispatch`).
    #[cfg_attr(coverage_nightly, coverage(off))]
    fn wait_for_node_result<R>(
        &self,
        rx: &mpsc::Receiver<anyhow::Result<R>>,
        callback_depth: usize,
    ) -> anyhow::Result<R> {
        loop {
            self.dispatch_pending_from_depth(callback_depth);

            match rx.try_recv() {
                Ok(result) => return result,
                Err(mpsc::TryRecvError::Disconnected) => return node_channel_disconnected(),
                Err(mpsc::TryRecvError::Empty) => self.wake_glib.wait(),
            }
        }
    }

    #[cfg_attr(coverage_nightly, coverage(off))]
    pub fn process_node_pending(&self, env: Env) {
        while let Some(task) = self.pop_node_task() {
            match task {
                NodeTask::Callback(pending) => {
                    let NodeCallback {
                        callback,
                        args,
                        capture_result,
                        out_cell_indices,
                        result_tx,
                        glib_initiated,
                    } = pending;
                    self.run_glib_initiated(
                        glib_initiated,
                        &result_tx,
                        "Node callback completed but result channel was closed",
                        || {
                            Self::execute_callback(
                                env,
                                &callback,
                                args,
                                capture_result,
                                &out_cell_indices,
                            )
                        },
                    );
                }
                NodeTask::DeleteReference(reference) => reference.delete_on_js_thread(),
                NodeTask::WrapperRefOp {
                    ref_ptr,
                    op,
                    result_tx,
                    glib_initiated,
                } => {
                    self.run_glib_initiated(
                        glib_initiated,
                        &result_tx,
                        "Wrapper reference operation completed but result channel was closed",
                        || {
                            op.apply(&env, ref_ptr);
                            Ok(())
                        },
                    );
                }
            }
        }
    }

    #[cfg_attr(coverage_nightly, coverage(off))]
    fn run_glib_initiated<R>(
        &self,
        glib_initiated: bool,
        result_tx: &mpsc::Sender<anyhow::Result<R>>,
        closed_message: &'static str,
        op: impl FnOnce() -> anyhow::Result<R>,
    ) {
        if glib_initiated {
            self.enter_glib_callback();
        }
        let result = op();
        if glib_initiated {
            self.leave_glib_callback();
        }
        send_or_report(result_tx, result, closed_message);
        self.wake_glib.notify();
    }

    #[cfg_attr(coverage_nightly, coverage(off))]
    fn wrap_out_cell<'env>(env: &'env Env, value: Unknown<'env>) -> napi::Result<Unknown<'env>> {
        let mut cell = env.create_object()?;
        cell.set_named_property("value", value)?;
        // SAFETY: runs on the Node (JS) thread that owns `env`; `cell` is a live JS object just
        // created in this `env`, so reconstructing an `Unknown` from its raw value is sound.
        Ok(unsafe { Unknown::from_raw_unchecked(env.raw(), napi::NapiRaw::raw(&cell)) })
    }

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
            // SAFETY: runs on the Node (JS) thread that owns `env`; `arg` is a live JS value in
            // this `env` (an out-cell object passed to the callback), so reconstructing a
            // `JsObject` from its raw value is sound.
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

        // SAFETY: `func` is the live callback function retrieved from the napi reference for this
        // `env`; reading its raw napi value is a plain accessor on the JS thread.
        let func_raw = unsafe { napi::NapiRaw::raw(&func) };

        let mut undef_this = std::ptr::null_mut();
        // SAFETY: runs on the Node (JS) thread that owns `env`; `napi_get_undefined` writes the
        // undefined value into the writable `undef_this` out-param.
        unsafe {
            sys::napi_get_undefined(env.raw(), &mut undef_this);
        }

        let mut return_value = std::ptr::null_mut();
        // SAFETY: on the JS thread with a live `env`; `func_raw` is the callback, `undef_this` the
        // receiver, and `raw_args`/`raw_args.len()` describe a valid argument array, so calling the
        // function and writing its result into `return_value` is sound.
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
            // SAFETY: on the JS thread with a live `env`; a pending exception is present, so
            // `napi_get_and_clear_last_exception` retrieves it into the writable out-param.
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
            // SAFETY: on the JS thread with a live `env`; `return_value` is the live result the
            // successful `napi_call_function` produced, so wrapping it as an `Unknown` is sound.
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
        // SAFETY: on the JS thread with a live `env`; `exception` is the live thrown value, and
        // `napi_typeof` writes its type into the writable out-param.
        unsafe {
            sys::napi_typeof(env, exception, &mut value_type);
        }

        if value_type == sys::ValueType::napi_object {
            let mut message = std::ptr::null_mut();
            // SAFETY: on the JS thread with a live `env`; `exception` is a live object, so reading
            // its `message` property into the writable out-param is sound.
            unsafe {
                sys::napi_get_named_property(env, exception, c"message".as_ptr(), &mut message);
            }
            if !message.is_null()
                // SAFETY: `message` is non-null (guarded by the preceding condition) and a live JS
                // value in `env`; converting it to a Rust `String` on the JS thread is sound.
                && let Ok(s) = unsafe { String::from_napi_value(env, message) }
            {
                return s;
            }
        } else if value_type == sys::ValueType::napi_string
            // SAFETY: `exception` is a live JS string value in `env`; converting it to a Rust
            // `String` on the JS thread is sound.
            && let Ok(s) = unsafe { String::from_napi_value(env, exception) }
        {
            return s;
        }

        "unknown exception".to_owned()
    }
}

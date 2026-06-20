//! [`Mailbox`] methods that cross into the JavaScript runtime.
//!
//! Every function here either invokes a JavaScript callback, converts values
//! through a live [`napi::Env`], or drives the wake threadsafe function. None
//! of it can run without a Node.js runtime, so it is excluded from coverage
//! instrumentation — there is no JavaScript engine or libuv event loop in a
//! `cargo test` process to exercise it against.

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

/// The outcome of a node-result wait whose oneshot sender was dropped before
/// delivering: the JS side is gone, so the blocked native caller fails rather
/// than hanging.
#[cfg_attr(coverage_nightly, coverage(off))]
fn node_channel_disconnected<R>() -> anyhow::Result<R> {
    Err(anyhow::anyhow!("JS callback channel disconnected"))
}

/// One non-blocking poll of a result channel: `Ok(Some)` on a delivered
/// result, `Ok(None)` when empty, and the dispatch error when the sender is
/// gone.
#[cfg_attr(coverage_nightly, coverage(off))]
fn poll_result<R>(rx: &mpsc::Receiver<R>) -> Result<Option<R>, GlibDispatchError> {
    match rx.try_recv() {
        Ok(result) => Ok(Some(result)),
        Err(mpsc::TryRecvError::Disconnected) => Err(GlibDispatchError::disconnected()),
        Err(mpsc::TryRecvError::Empty) => Ok(None),
    }
}

impl Mailbox {
    /// Stores the threadsafe function used to wake the JS thread from arbitrary
    /// other threads. Set once during `init()` and invoked by the `GLib` thread
    /// when callbacks are pushed onto the node inbox.
    #[cfg_attr(coverage_nightly, coverage(off))]
    pub fn set_wake_tsfn(&self, tsfn: Arc<WakeJsTsfn>) {
        let _ = self.wake_js_tsfn.set(tsfn);
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

    /// Schedules a task on the `GLib` thread and blocks the JS thread until the
    /// task completes. While blocked, drains any callbacks pushed onto the
    /// node inbox so re-entrant `GLib → JS → GLib` calls progress.
    ///
    /// A panic inside the task is caught on the `GLib` thread and surfaces to
    /// the caller as a [`GlibDispatchError`] naming the panic; the `GLib`
    /// thread keeps running.
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

    /// Runs [`Self::dispatch_to_glib_and_wait`] and maps a [`GlibDispatchError`]
    /// into the `GenericFailure` [`napi::Error`] every napi-export call site
    /// surfaces, so the dispatch-error policy lives in one place.
    #[cfg_attr(coverage_nightly, coverage(off))]
    pub fn dispatch_and_wait_napi<R, F>(&self, env: Env, task: F) -> napi::Result<R>
    where
        F: FnOnce() -> R + Send + 'static,
        R: Send + 'static,
    {
        self.dispatch_to_glib_and_wait(env, task)
            .map_err(|e| napi::Error::new(napi::Status::GenericFailure, e.to_string()))
    }

    /// Blocks the JS thread until the receiver yields a value, draining any
    /// pending node callbacks along the way. Useful when callers schedule
    /// tasks via [`Mailbox::schedule_glib`] and want fine-grained control over
    /// what value the `GLib` task signals back through (for example, the
    /// freeze loop signals readiness mid-execution).
    ///
    /// The result is polled *before* pending node tasks are processed: a value
    /// produced by the `GLib` thread is observed before any reference-delete
    /// task queued after it, so a wrapper-reference address read on the `GLib`
    /// thread cannot be freed by a concurrent teardown before the caller
    /// dereferences it. Node tasks left pending here are picked up by the wake
    /// threadsafe function or the next wait.
    #[cfg_attr(coverage_nightly, coverage(off))]
    pub fn wait_for_glib_result<R>(
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

    /// Pushes a JS callback onto the node inbox and blocks the calling thread
    /// until JS produces a result. For each index in `out_cell_indices`, passes
    /// that argument to JS wrapped in a mutable `{ value }` cell and reads the
    /// cell's `value` back after the callback returns — the trampoline path uses
    /// this to flush signal out-parameters the handler wrote into their cells.
    /// On the `GLib` thread, drains GLib-bound tasks pushed by the executing JS
    /// callback while blocked, so re-entrant `JS → GLib → JS` calls progress.
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

    /// Applies a wrapper-reference operation on the JS thread — strengthen,
    /// weaken, or delete the wrapper `napi_ref` at `ref_ptr` — blocking the
    /// calling thread until it completes.
    ///
    /// A toggle notify fires this from the `GLib` thread, often while that
    /// thread is already parked mid-install. The wait is the same depth-aware,
    /// re-entrant one [`Self::invoke_node_and_wait_with_cells`] uses, so the
    /// napi reference call — which must run on the JS thread — is serviced even
    /// by a JS thread parked in an enclosing wait.
    #[cfg_attr(coverage_nightly, coverage(off))]
    pub fn apply_wrapper_ref_op_and_wait(&self, ref_ptr: usize, op: RefOp) -> anyhow::Result<()> {
        self.submit_blocking_node_task(|result_tx, glib_initiated| NodeTask::WrapperRefOp {
            ref_ptr,
            op,
            result_tx,
            glib_initiated,
        })
    }

    /// Pushes a blocking node task built by `build` and blocks the calling
    /// thread until it delivers its result, draining re-entrant `GLib`-bound
    /// work along the way.
    ///
    /// `build` receives the result channel's sender and the `glib_initiated`
    /// flag so each caller assembles its own [`NodeTask`] payload; the
    /// re-entrancy `wait_depth` and the push/wake/wait skeleton stay here.
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

    /// Computes the re-entrancy parameters for a blocking node task: whether the
    /// `GLib` thread initiated it (so it joins the callback nesting depth) and,
    /// when so, the depth its result wait runs at.
    ///
    /// The depth counts GLib-initiated callbacks currently executing on the JS
    /// thread. Those execute only while this `GLib` thread is parked in an
    /// enclosing wait, so the value read here is exactly this thread's own wait
    /// nesting and cannot change before the pushed task runs at that level plus
    /// one.
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

    /// Blocks the calling thread until the pushed node task delivers its result
    /// on `rx`.
    ///
    /// Native libraries can invoke a trampoline on a thread of their own (a
    /// `GLib.Thread` body, a `Gio.Task` pool worker), so the wait path is chosen
    /// by thread: the `GLib` thread takes the re-entrant
    /// [`Self::wait_for_node_result`] loop at `wait_depth`, while any other
    /// thread parks on its private result channel. A foreign waiter must never
    /// touch the `GLib` wait machinery — the shared wake permit holds a single
    /// permit (two parked threads would steal each other's wakeups), and
    /// draining GLib-bound tasks would execute GTK mutations off the `GLib`
    /// thread.
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

    /// Blocks the `GLib` thread until the node callback at `callback_depth`
    /// produces a result, draining only `glib_inbox` tasks enqueued at that
    /// depth or deeper — the nested calls the callback itself makes.
    ///
    /// Must run only on the `GLib` thread: it parks on the single-permit
    /// `wake_glib` signal and executes GLib-bound tasks inline.
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

    /// Drains all currently-queued node tasks and runs them on the JS thread,
    /// invoking callbacks and applying wrapper-reference operations. Intended to
    /// run on the JS thread, either from the wake TSFN a pushed task scheduled or
    /// from the wait loop in [`Mailbox::wait_for_glib_result`].
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

    /// Runs `op` for a `GLib`-initiated node task between the callback-nesting
    /// bracket, then delivers its result and wakes the parked `GLib` thread.
    ///
    /// The `enter_glib_callback`/`leave_glib_callback` pair must bracket `op`:
    /// [`Self::push_glib_task`] reads `callback_depth` to tag the nested tasks
    /// `op` enqueues at this waiter's level, so the bracket cannot be deferred
    /// until after `op` runs. `closed_message` names the handshake in the error
    /// raised when the waiter is already gone.
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

    /// Wraps `value` in a fresh `{ value }` JavaScript object so a callback can
    /// mutate the slot in place — the cell a trampoline out-parameter is
    /// written through.
    #[cfg_attr(coverage_nightly, coverage(off))]
    fn wrap_out_cell<'env>(env: &'env Env, value: Unknown<'env>) -> napi::Result<Unknown<'env>> {
        let mut cell = env.create_object()?;
        cell.set_named_property("value", value)?;
        // SAFETY: `cell` is a live JS object just created from the current
        // callback's `env`.
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
            // SAFETY: `arg` is a live out-cell object built by
            // `wrap_out_cell` from the current callback's `env`.
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

        // SAFETY: `func` is a live function handle from the current
        // callback's `env`.
        let func_raw = unsafe { napi::NapiRaw::raw(&func) };

        let mut undef_this = std::ptr::null_mut();
        // SAFETY: This runs on the JS thread with the live `env` of the
        // current callback.
        unsafe {
            sys::napi_get_undefined(env.raw(), &mut undef_this);
        }

        let mut return_value = std::ptr::null_mut();
        // SAFETY: `func_raw`, `undef_this`, and every element of
        // `raw_args` are live values from the current callback's `env`,
        // and `raw_args` stays alive across the call.
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
            // SAFETY: This runs on the JS thread with the live `env` of
            // the current callback.
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
            // SAFETY: `return_value` is the live result napi_call_function
            // produced under the current callback's `env`.
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
        // SAFETY: `exception` is the live value just cleared from `env`'s
        // pending-exception slot on the JS thread.
        unsafe {
            sys::napi_typeof(env, exception, &mut value_type);
        }

        if value_type == sys::ValueType::napi_object {
            let mut message = std::ptr::null_mut();
            // SAFETY: `exception` is a live object value under `env` on
            // the JS thread, and the property name is NUL-terminated.
            unsafe {
                sys::napi_get_named_property(env, exception, c"message".as_ptr(), &mut message);
            }
            if !message.is_null()
                // SAFETY: `message` is the live, non-null property value
                // just read under `env`.
                && let Ok(s) = unsafe { String::from_napi_value(env, message) }
            {
                return s;
            }
        } else if value_type == sys::ValueType::napi_string
            // SAFETY: `exception` is a live string value under `env` on
            // the JS thread.
            && let Ok(s) = unsafe { String::from_napi_value(env, exception) }
        {
            return s;
        }

        "unknown exception".to_owned()
    }
}

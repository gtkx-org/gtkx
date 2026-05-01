//! Cross-thread message dispatch between the JavaScript and `GLib` threads.
//!
//! This module owns the JS↔GLib bridge as a single [`Mailbox`] singleton that
//! exposes two queues:
//!
//! - `glib_inbox`: tasks pushed by the JS thread for execution on the `GLib` thread.
//! - `node_inbox`: callbacks pushed by the `GLib` thread for execution in the JS context.
//!
//! Each thread parks on its own wake signal while waiting for a response.
//! Re-entrance falls out of the call stack: while a thread is parked waiting for
//! a response from the other side, the wait loop also services any incoming
//! requests on its own inbox. Cross-boundary calls therefore nest naturally
//! to arbitrary depth without any explicit driver state, depth counter, or
//! correlation id.
//!
//! ## Freeze mode
//!
//! React's commit phase brackets a batch of mutations with [`Mailbox::freeze`] /
//! [`Mailbox::unfreeze`]. While frozen, the `GLib` thread runs a tight loop
//! (`run_freeze_loop`) that drains incoming tasks without yielding to the `GLib`
//! main loop, ensuring the frame clock cannot fire mid-commit. Nested freeze
//! pairs are no-ops; only the outermost pair starts and stops the loop.
//!
//! ## Lifecycle
//!
//! [`Mailbox::mark_started`] is set once the `GLib` thread is up and the
//! application has activated. [`Mailbox::mark_stopped`] is set when the
//! application hold guard is released. After stopped, new tasks are silently
//! dropped to allow clean shutdown.

use std::collections::VecDeque;
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::{Arc, Mutex, OnceLock, mpsc};

use gtk4::glib;
use neon::prelude::*;

use crate::error_reporter::NativeErrorReporter;
use crate::value::Value;
use crate::wait_signal::WaitSignal;

type GlibTask = Box<dyn FnOnce() + Send + 'static>;

struct NodeCallback {
    callback: Arc<Root<JsFunction>>,
    args: Vec<Value>,
    capture_result: bool,
    result_tx: mpsc::Sender<anyhow::Result<Value>>,
}

/// Bidirectional message queues coordinating the JS and `GLib` threads.
///
/// Holds two inboxes — one for tasks bound for the `GLib` thread, one for
/// callbacks bound for the JS thread — plus the wake primitives that park
/// each thread when its inbox is empty.
pub struct Mailbox {
    glib_inbox: Mutex<VecDeque<GlibTask>>,
    node_inbox: Mutex<VecDeque<NodeCallback>>,

    wake_js: WaitSignal,
    wake_glib: WaitSignal,

    dispatch_scheduled: AtomicBool,

    started: AtomicBool,
    stopped: AtomicBool,

    freeze_depth: AtomicUsize,
    freeze_loop_active: AtomicBool,
    freeze_wake: WaitSignal,
}

impl std::fmt::Debug for Mailbox {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Mailbox")
            .field("started", &self.started)
            .field("stopped", &self.stopped)
            .field("freeze_depth", &self.freeze_depth)
            .finish_non_exhaustive()
    }
}

static MAILBOX: OnceLock<Mailbox> = OnceLock::new();

impl Mailbox {
    /// Returns the global mailbox singleton, initializing it on first access.
    pub fn global() -> &'static Self {
        MAILBOX.get_or_init(Self::new)
    }

    fn new() -> Self {
        Self {
            glib_inbox: Mutex::new(VecDeque::new()),
            node_inbox: Mutex::new(VecDeque::new()),
            wake_js: WaitSignal::new(),
            wake_glib: WaitSignal::new(),
            dispatch_scheduled: AtomicBool::new(false),
            started: AtomicBool::new(false),
            stopped: AtomicBool::new(false),
            freeze_depth: AtomicUsize::new(0),
            freeze_loop_active: AtomicBool::new(false),
            freeze_wake: WaitSignal::new(),
        }
    }

    /// Marks the `GLib` thread as ready to receive tasks.
    pub fn mark_started(&self) {
        self.stopped.store(false, Ordering::Release);
        self.started.store(true, Ordering::Release);
    }

    /// Returns whether the `GLib` thread is currently accepting tasks.
    pub fn is_started(&self) -> bool {
        self.started.load(Ordering::Acquire)
    }

    /// Marks the mailbox as shut down. Subsequent `dispatch_to_glib*` calls become no-ops.
    pub fn mark_stopped(&self) {
        self.started.store(false, Ordering::Release);
        self.stopped.store(true, Ordering::Release);
        self.wake_js.notify();
        self.wake_glib.notify();
    }

    /// Returns whether the mailbox has been shut down.
    pub fn is_stopped(&self) -> bool {
        self.stopped.load(Ordering::Acquire)
    }

    /// Increments the freeze depth. Returns true if this was the outermost call.
    pub fn freeze(&self) -> bool {
        self.freeze_depth.fetch_add(1, Ordering::AcqRel) == 0
    }

    /// Decrements the freeze depth. Wakes the freeze loop when depth reaches zero.
    pub fn unfreeze(&self) {
        if self.freeze_depth.fetch_sub(1, Ordering::AcqRel) == 1 {
            self.freeze_wake.notify();
        }
    }

    /// Drains all currently-queued `GLib` tasks until [`Self::unfreeze`] resets
    /// the freeze depth to zero. Runs on the `GLib` thread without yielding to
    /// the `GLib` main loop, preventing the frame clock from firing between
    /// individual mutations during a React commit.
    pub fn run_freeze_loop(&self) {
        self.freeze_loop_active.store(true, Ordering::Release);
        loop {
            self.dispatch_pending();
            if self.freeze_depth.load(Ordering::Acquire) == 0 {
                break;
            }
            self.freeze_wake.wait();
        }
        self.freeze_loop_active.store(false, Ordering::Release);
        self.dispatch_pending();
    }

    fn push_glib_task(&self, task: GlibTask) {
        self.glib_inbox
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
            .push_back(task);
        if self.freeze_loop_active.load(Ordering::Acquire) {
            self.freeze_wake.notify();
        }
        self.wake_glib.notify();
    }

    fn pop_glib_task(&self) -> Option<GlibTask> {
        self.glib_inbox
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
            .pop_front()
    }

    fn push_node_callback(&self, callback: NodeCallback) {
        self.node_inbox
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
            .push_back(callback);
        self.wake_js.notify();
    }

    fn pop_node_callback(&self) -> Option<NodeCallback> {
        self.node_inbox
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
            .pop_front()
    }

    /// Pushes a fire-and-forget task onto the `GLib` inbox. The task runs on the
    /// `GLib` thread the next time the inbox is drained — either by the `GLib`
    /// main loop's idle source, by the freeze loop, or by another thread's
    /// wait loop dispatching pending tasks.
    pub fn schedule_glib<F>(&self, task: F)
    where
        F: FnOnce() + Send + 'static,
    {
        if self.stopped.load(Ordering::Acquire) {
            return;
        }

        self.push_glib_task(Box::new(task));

        if self.freeze_loop_active.load(Ordering::Acquire) {
            return;
        }

        if self
            .dispatch_scheduled
            .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
            .is_ok()
        {
            glib::idle_add_full(glib::Priority::HIGH_IDLE, || {
                Self::global().dispatch_pending();
                glib::ControlFlow::Break
            });
        }
    }

    /// Wakes the JS thread if it is parked in [`Self::wait_for_glib_result`].
    ///
    /// Callers running long-lived `GLib` tasks (e.g. the freeze loop, which does
    /// not return until [`Self::unfreeze`] is called) must invoke this after
    /// signalling their `Receiver` so the JS thread observes the value rather
    /// than blocking forever — the standard wake-after-drain in
    /// [`Self::dispatch_pending`] only fires once the task closure returns.
    pub fn notify_js(&self) {
        self.wake_js.notify();
    }

    /// Drains all queued `GLib` tasks. Returns whether any were executed.
    /// Intended to run on the `GLib` thread.
    pub fn dispatch_pending(&self) -> bool {
        self.dispatch_scheduled.store(false, Ordering::Release);
        let mut dispatched = false;

        while let Some(task) = self.pop_glib_task() {
            task();
            dispatched = true;
        }

        if dispatched {
            self.wake_js.notify();
        }

        dispatched
    }

    /// Schedules a task on the `GLib` thread and blocks the JS thread until the
    /// task completes. While blocked, drains any callbacks pushed onto the
    /// node inbox so re-entrant `GLib → JS → GLib` calls progress.
    pub fn dispatch_to_glib_and_wait<'a, R, C, F>(
        &self,
        cx: &mut C,
        task: F,
    ) -> Result<R, GlibDisconnectedError>
    where
        C: Context<'a>,
        F: FnOnce() -> R + Send + 'static,
        R: Send + 'static,
    {
        let (tx, rx) = mpsc::channel();
        self.schedule_glib(move || {
            if tx.send(task()).is_err() {
                NativeErrorReporter::global()
                    .report_str("GLib dispatch completed but result channel was closed");
            }
        });
        self.wait_for_glib_result(cx, &rx)
    }

    /// Blocks the JS thread until the receiver yields a value, draining any
    /// pending node callbacks along the way. Useful when callers schedule
    /// tasks via [`Self::schedule_glib`] and want fine-grained control over
    /// what value the `GLib` task signals back through (for example, the
    /// freeze loop signals readiness mid-execution).
    pub fn wait_for_glib_result<'a, R, C: Context<'a>>(
        &self,
        cx: &mut C,
        rx: &mpsc::Receiver<R>,
    ) -> Result<R, GlibDisconnectedError> {
        loop {
            self.process_node_pending(cx);

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
    pub fn invoke_node_and_wait(
        &self,
        channel: &Channel,
        callback: &Arc<Root<JsFunction>>,
        args: Vec<Value>,
        capture_result: bool,
    ) -> anyhow::Result<Value> {
        let (tx, rx) = mpsc::channel();

        self.push_node_callback(NodeCallback {
            callback: callback.clone(),
            args,
            capture_result,
            result_tx: tx,
        });

        channel.send(|mut cx| {
            Self::global().process_node_pending(&mut cx);
            Ok(())
        });

        self.wait_for_node_result(&rx)
    }

    fn wait_for_node_result(
        &self,
        rx: &mpsc::Receiver<anyhow::Result<Value>>,
    ) -> anyhow::Result<Value> {
        loop {
            self.dispatch_pending();

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
    /// Intended to run on the JS thread, either from the libuv-driven wakeup
    /// scheduled by [`Self::invoke_node_and_wait`] or from the wait loop in
    /// [`Self::wait_for_glib_result`].
    pub fn process_node_pending<'a, C: Context<'a>>(&self, cx: &mut C) {
        while let Some(pending) = self.pop_node_callback() {
            let NodeCallback {
                callback,
                args,
                capture_result,
                result_tx,
            } = pending;
            let result = Self::execute_callback(cx, &callback, args, capture_result);
            if result_tx.send(result).is_err() {
                NativeErrorReporter::global()
                    .report_str("Node callback completed but result channel was closed");
            }
            self.wake_glib.notify();
        }
    }

    fn execute_callback<'a, C: Context<'a>>(
        cx: &mut C,
        callback: &Arc<Root<JsFunction>>,
        args: Vec<Value>,
        capture_result: bool,
    ) -> anyhow::Result<Value> {
        let callback = callback.clone();

        match cx.try_catch(|cx| {
            let js_args: Vec<Handle<JsValue>> = args
                .into_iter()
                .map(|v| v.to_js_value(cx))
                .collect::<NeonResult<Vec<_>>>()?;

            let js_this = cx.undefined();
            let js_callback = callback.to_inner(cx);

            if capture_result {
                let js_result = js_callback.call(cx, js_this, js_args)?;
                Value::from_js_value(cx, js_result)
            } else {
                js_callback.call(cx, js_this, js_args)?;
                Ok(Value::Undefined)
            }
        }) {
            Ok(value) => Ok(value),
            Err(exception) => {
                let msg = Self::extract_exception_message(cx, exception);
                Err(anyhow::anyhow!("{msg}"))
            }
        }
    }

    fn extract_exception_message<'a, C: Context<'a>>(
        cx: &mut C,
        exception: Handle<'a, JsValue>,
    ) -> String {
        if let Ok(obj) = exception.downcast::<JsObject, _>(cx)
            && let Ok(msg_handle) = obj.get_value(cx, "message")
            && let Ok(msg_str) = msg_handle.downcast::<JsString, _>(cx)
        {
            return msg_str.value(cx);
        }
        if let Ok(s) = exception.downcast::<JsString, _>(cx) {
            return s.value(cx);
        }
        "unknown exception".to_owned()
    }
}

/// Returned by [`Mailbox::dispatch_to_glib_and_wait`] when the underlying
/// result channel is dropped before producing a value, typically because the
/// `GLib` thread is shutting down.
#[derive(Debug, Clone, Copy)]
pub struct GlibDisconnectedError;

impl std::fmt::Display for GlibDisconnectedError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "GLib thread disconnected")
    }
}

impl std::error::Error for GlibDisconnectedError {}

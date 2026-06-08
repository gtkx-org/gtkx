//! Cross-thread message dispatch between the JavaScript and `GLib` threads.
//!
//! This module owns the JS↔GLib bridge as a single [`Mailbox`] singleton that
//! exposes two queues:
//!
//! - `glib_inbox`: tasks pushed by the JS thread for execution on the `GLib` thread.
//! - `node_inbox`: callbacks pushed by the `GLib` thread for execution in the JS context.
//!
//! Each thread parks on its own wake signal while waiting for a response.
//! Re-entrance follows the call stack: while a thread is parked waiting for a
//! response from the other side, the wait loop services incoming requests on
//! its own inbox so nested `GLib → JS → GLib` calls progress.
//!
//! `glib_inbox` tasks are tagged with the JS callback-nesting depth in effect
//! when they were enqueued. A `GLib` thread parked inside a JS callback drains
//! only tasks at or deeper than that callback's depth — the nested calls the
//! callback itself makes. Shallower tasks (an unrelated mutation the JS thread
//! queued at the top level) stay queued until the callback returns and the
//! `GLib` thread unwinds to a safe point. This keeps a `Gtk.Window.destroy()`
//! from running inside the `gtk_widget_render` of a draw callback, where it
//! would free the window's renderer mid-frame.
//!
//! The [`Mailbox`] methods that cross into the JavaScript runtime — invoking JS
//! callbacks, converting values through a [`napi::Env`], and the wake
//! threadsafe function — live in the [`js_bridge`] submodule.
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
//! [`Mailbox::mark_stopped`] is set during the orchestrated shutdown task,
//! after which new tasks are silently dropped so callers blocked in
//! [`Mailbox::dispatch_to_glib_and_wait`] do not deadlock waiting on a
//! result from the dying main loop.

mod js_bridge;

use std::collections::VecDeque;
use std::panic::{self, AssertUnwindSafe};
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::{Arc, Mutex, OnceLock, mpsc};

use gtk4::glib;
use napi::threadsafe_function::ThreadsafeFunction;
use napi::{JsFunction, Status, sys};

use crate::error_reporter::NativeErrorReporter;
use crate::panic_handler::format_panic_payload;
use crate::value::{JsRef, Value};
use crate::wait_signal::WaitSignal;

type GlibTask = Box<dyn FnOnce() + Send + 'static>;

/// A queued `GLib` task paired with the JS callback-nesting depth in effect
/// when it was enqueued. A parked `GLib` thread uses the depth to tell its
/// own nested calls apart from unrelated top-level work.
type DepthTaggedTask = (usize, GlibTask);

pub type WakeJsTsfn = ThreadsafeFunction<(), (), (), Status, false, true>;

/// A node callback's outcome: the JS return value plus, for each out-cell
/// argument index, the value the callback left in that cell's `value` slot.
pub type NodeCallbackResult = (Value, Vec<(usize, Value)>);

struct NodeCallback {
    callback: Arc<JsRef<JsFunction>>,
    args: Vec<Value>,
    capture_result: bool,
    out_cell_indices: Vec<usize>,
    result_tx: mpsc::Sender<anyhow::Result<NodeCallbackResult>>,
}

enum NodeTask {
    Callback(NodeCallback),
    DeleteReference(JsReference),
}

#[derive(Debug)]
pub(crate) struct JsReference {
    env: sys::napi_env,
    raw: sys::napi_ref,
}

unsafe impl Send for JsReference {}

impl JsReference {
    #[cfg_attr(coverage_nightly, coverage(off))]
    pub(crate) fn new(env: sys::napi_env, raw: sys::napi_ref) -> Self {
        Self { env, raw }
    }

    #[cfg_attr(coverage_nightly, coverage(off))]
    pub(crate) fn delete_on_js_thread(self) {
        let status = unsafe { sys::napi_delete_reference(self.env, self.raw) };
        debug_assert_eq!(status, sys::Status::napi_ok);
    }
}

/// Bidirectional message queues coordinating the JS and `GLib` threads.
///
/// Holds two inboxes — one for tasks bound for the `GLib` thread, one for
/// callbacks bound for the JS thread — plus the wake primitives that park
/// each thread when its inbox is empty.
pub struct Mailbox {
    glib_inbox: Mutex<VecDeque<DepthTaggedTask>>,
    node_inbox: Mutex<VecDeque<NodeTask>>,

    callback_depth: AtomicUsize,

    wake_js: WaitSignal,
    wake_glib: WaitSignal,

    wake_js_tsfn: OnceLock<Arc<WakeJsTsfn>>,

    stopped: AtomicBool,

    freeze_depth: AtomicUsize,
    freeze_loop_active: AtomicBool,
    freeze_wake: WaitSignal,
}

impl std::fmt::Debug for Mailbox {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Mailbox")
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
            callback_depth: AtomicUsize::new(0),
            wake_js: WaitSignal::new(),
            wake_glib: WaitSignal::new(),
            wake_js_tsfn: OnceLock::new(),
            stopped: AtomicBool::new(false),
            freeze_depth: AtomicUsize::new(0),
            freeze_loop_active: AtomicBool::new(false),
            freeze_wake: WaitSignal::new(),
        }
    }

    /// Marks the mailbox as shut down. Subsequent `dispatch_to_glib*` calls become no-ops.
    pub fn mark_stopped(&self) {
        self.stopped.store(true, Ordering::Release);
        self.wake_js.notify();
        self.wake_glib.notify();
    }

    /// Clears the stopped flag so the mailbox accepts tasks again. Intended
    /// for tests that need to restore the mailbox to a fresh state after
    /// exercising the shutdown path.
    pub fn reset_for_test(&self) {
        self.stopped.store(false, Ordering::Release);
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
        let depth = self.callback_depth.load(Ordering::Acquire);
        self.glib_inbox
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
            .push_back((depth, task));
        if self.freeze_loop_active.load(Ordering::Acquire) {
            self.freeze_wake.notify();
        }
        self.wake_glib.notify();
    }

    /// Pushes a fire-and-forget task onto the `GLib` inbox. The task runs on the
    /// `GLib` thread the next time the inbox is drained — either by the `GLib`
    /// main loop's idle source, by the freeze loop, or by another thread's
    /// wait loop dispatching pending tasks.
    pub fn schedule_glib(&self, task: Box<dyn FnOnce() + Send + 'static>) {
        if self.stopped.load(Ordering::Acquire) {
            return;
        }

        self.push_glib_task(task);

        if self.freeze_loop_active.load(Ordering::Acquire) {
            return;
        }

        glib::idle_add_full(glib::Priority::HIGH_IDLE, || {
            Self::global().dispatch_pending();
            glib::ControlFlow::Break
        });
    }

    /// Wakes the JS thread if it is parked in `wait_for_glib_result`.
    ///
    /// Callers running long-lived `GLib` tasks (e.g. the freeze loop, which does
    /// not return until [`Self::unfreeze`] is called) must invoke this after
    /// signalling their `Receiver` so the JS thread observes the value rather
    /// than blocking forever — the standard wake-after-drain in
    /// [`Self::dispatch_pending`] only fires once the task closure returns.
    pub fn notify_js(&self) {
        self.wake_js.notify();
    }

    /// Increments the JS callback-nesting depth. Called on the JS thread
    /// immediately before a node callback is invoked.
    pub fn enter_callback(&self) {
        self.callback_depth.fetch_add(1, Ordering::AcqRel);
    }

    /// Decrements the JS callback-nesting depth. Called on the JS thread
    /// immediately after a node callback returns.
    pub fn leave_callback(&self) {
        self.callback_depth.fetch_sub(1, Ordering::AcqRel);
    }

    /// Drains every queued `GLib` task regardless of depth. Returns whether any
    /// were executed. Intended to run on the `GLib` thread at a top-level
    /// dispatch point — the idle source, the freeze loop, or the main loop.
    pub fn dispatch_pending(&self) -> bool {
        self.dispatch_pending_from_depth(0)
    }

    /// Drains queued `GLib` tasks enqueued at callback-nesting depth
    /// `min_depth` or deeper, in FIFO order, leaving shallower tasks queued.
    ///
    /// A `GLib` thread parked inside a JS callback running at depth `min_depth`
    /// passes that depth so it services only the nested calls that callback
    /// makes, never an unrelated top-level task that would re-enter `GLib`
    /// state mid-callback. The inbox lock is reacquired per task so tasks the
    /// running task enqueues are observed.
    pub fn dispatch_pending_from_depth(&self, min_depth: usize) -> bool {
        let mut dispatched = false;

        loop {
            let task = {
                let mut inbox = self
                    .glib_inbox
                    .lock()
                    .unwrap_or_else(std::sync::PoisonError::into_inner);
                inbox
                    .iter()
                    .position(|(depth, _)| *depth >= min_depth)
                    .and_then(|index| inbox.remove(index))
            };

            match task {
                Some((_, task)) => {
                    if let Err(payload) = panic::catch_unwind(AssertUnwindSafe(task)) {
                        NativeErrorReporter::global().report_str(&format!(
                            "panic in GLib-thread task: {}",
                            format_panic_payload(&*payload)
                        ));
                    }
                    dispatched = true;
                }
                None => break,
            }
        }

        if dispatched {
            self.wake_js.notify();
        }

        dispatched
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

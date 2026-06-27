//! Cross-thread task dispatch between the Node (JS) thread and the single gtkx-glib thread.
//!
//! # Depth-tagged reentrancy invariant
//!
//! GLib-thread work is queued in [`Mailbox::glib_inbox`] and Node-thread work in
//! [`Mailbox::node_inbox`]. The risk is a *nested cross-thread callback*: the `GLib` thread calls
//! into JS, that JS callback synchronously triggers another `GLib` task, and the inner wait must
//! not re-run a task enqueued by an outer frame — doing so would reorder work and deadlock.
//!
//! The protocol that prevents this is the `callback_depth` tagging:
//!
//! - Every task pushed via [`Mailbox::push_glib_task`] is tagged with the current
//!   `callback_depth` at enqueue time.
//! - [`Mailbox::enter_glib_callback`] / [`Mailbox::leave_glib_callback`] bracket each GLib-thread
//!   callback into JS, incrementing/decrementing `callback_depth`.
//! - A blocking node task initiated *from the `GLib` thread* — detected via
//!   `glib::MainContext::default().is_owner()` in `node_wait_setup` — waits at
//!   `wait_depth = callback_depth + 1` and, while blocked, drains only tasks tagged
//!   `depth >= wait_depth` through [`Mailbox::dispatch_pending_from_depth`].
//!
//! Because the inner wait drains strictly deeper tasks, it can make forward progress on work
//! the inner callback itself enqueues without ever re-entering a task that belongs to the outer
//! frame, which is what keeps the nested cross-thread dispatch deadlock-free.

pub(crate) mod error_reporter;
mod freeze;
pub(crate) mod log_handler;
mod node_mailbox;
pub mod wait_signal;

pub mod glib_mailbox;
pub mod panic_handler;

use std::collections::VecDeque;
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::{Arc, OnceLock, mpsc};

use napi::threadsafe_function::ThreadsafeFunction;
use napi::{JsFunction, Status, sys};
use parking_lot::Mutex;

use crate::ffi::value::{JsRef, Value};
use crate::handle::wrapper_registry::WrapperRefOp;
use crate::messaging::error_reporter::ErrorReporter;
use crate::messaging::freeze::FreezeController;
use crate::messaging::wait_signal::WaitSignal;

type GlibTask = Box<dyn FnOnce() + Send + 'static>;

type DepthTaggedTask = (usize, GlibTask);

pub type WakeJsTsfn = ThreadsafeFunction<(), (), (), Status, false, true>;

pub type NodeCallbackResult = (Value, Vec<(usize, Value)>);

struct NodeCallback {
    callback: Arc<JsRef<JsFunction>>,
    args: Vec<Value>,
    capture_result: bool,
    out_cell_indices: Vec<usize>,
    result_tx: mpsc::Sender<anyhow::Result<NodeCallbackResult>>,
    glib_initiated: bool,
}

enum NodeTask {
    Callback(NodeCallback),
    DeleteReference(JsRefDeletion),
    WrapperRefOp {
        ref_ptr: usize,
        op: WrapperRefOp,
        result_tx: mpsc::Sender<anyhow::Result<()>>,
        glib_initiated: bool,
    },
}

#[derive(Debug)]
pub(crate) struct JsRefDeletion {
    env: sys::napi_env,
    raw: sys::napi_ref,
}

// SAFETY: a `JsRefDeletion` only carries the raw napi env/ref handles by value; it is moved to the
// Node (JS) thread and its handles are exclusively touched there (in `delete_on_js_thread`), never
// dereferenced from the gtkx-glib thread, so transferring ownership across threads is sound.
unsafe impl Send for JsRefDeletion {}

impl JsRefDeletion {
    #[cfg_attr(coverage_nightly, coverage(off))]
    pub(crate) fn new(env: sys::napi_env, raw: sys::napi_ref) -> Self {
        Self { env, raw }
    }

    #[cfg_attr(coverage_nightly, coverage(off))]
    pub(crate) fn delete_on_js_thread(self) {
        // SAFETY: runs on the Node (JS) thread that owns `self.env`; `self.raw` is the live napi
        // reference captured in `new`, deleted exactly once here as `self` is consumed by value.
        let status = unsafe { sys::napi_delete_reference(self.env, self.raw) };
        debug_assert_eq!(status, sys::Status::napi_ok);
    }
}

pub struct Mailbox {
    glib_inbox: Mutex<VecDeque<DepthTaggedTask>>,
    node_inbox: Mutex<VecDeque<NodeTask>>,

    callback_depth: AtomicUsize,

    wake_js: WaitSignal,
    wake_glib: WaitSignal,

    wake_js_tsfn: OnceLock<Arc<WakeJsTsfn>>,

    running: AtomicBool,

    freeze: FreezeController,
}

impl std::fmt::Debug for Mailbox {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Mailbox")
            .field("running", &self.running)
            .field("freeze", &self.freeze)
            .finish_non_exhaustive()
    }
}

static MAILBOX: OnceLock<Mailbox> = OnceLock::new();

impl Mailbox {
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
            running: AtomicBool::new(true),
            freeze: FreezeController::new(),
        }
    }

    #[cfg(debug_assertions)]
    #[must_use]
    pub fn new_for_test() -> Self {
        Self::new()
    }

    pub fn mark_not_running(&self) {
        self.running.store(false, Ordering::Release);
        self.wake_js.notify();
        self.wake_glib.notify();
        self.freeze.wake_for_shutdown();
    }

    #[cfg(debug_assertions)]
    pub fn reset_for_test(&self) {
        self.running.store(true, Ordering::Release);
    }

    pub fn is_not_running(&self) -> bool {
        !self.running.load(Ordering::Acquire)
    }

    pub fn freeze(&self) -> bool {
        self.freeze.enter()
    }

    pub fn unfreeze(&self) {
        self.freeze.leave();
    }

    pub fn run_freeze_loop(&self) {
        self.freeze.run_loop(self);
    }

    pub fn is_initialized(&self) -> bool {
        self.wake_js_tsfn.get().is_some()
    }

    /// Enters a GLib-thread callback frame, raising `callback_depth` by one.
    ///
    /// Tasks enqueued while this frame is active are tagged with the raised depth, which a
    /// nested wait uses to avoid re-running outer-frame work (module-level reentrancy invariant).
    pub fn enter_glib_callback(&self) {
        self.callback_depth.fetch_add(1, Ordering::AcqRel);
    }

    /// Leaves the current GLib-thread callback frame, lowering `callback_depth` by one.
    pub fn leave_glib_callback(&self) {
        self.callback_depth.fetch_sub(1, Ordering::AcqRel);
    }
}

pub(crate) fn send_or_report<T>(tx: &mpsc::Sender<T>, value: T, context: &str) {
    if tx.send(value).is_err() {
        ErrorReporter::global().report_str(context);
    }
}

#[derive(Debug, Clone)]
pub struct GlibDispatchError(String);

impl GlibDispatchError {
    pub(crate) fn disconnected() -> Self {
        Self("GLib thread disconnected".to_owned())
    }

    pub(crate) fn task_panicked(message: &str) -> Self {
        Self(format!("GLib task panicked: {message}"))
    }
}

impl std::fmt::Display for GlibDispatchError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl std::error::Error for GlibDispatchError {}

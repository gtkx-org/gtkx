pub(crate) mod error_reporter;
mod freeze;
pub(crate) mod log_handler;
mod node_mailbox;
pub mod wait_signal;

pub mod glib_mailbox;
pub mod panic_handler;

use std::collections::VecDeque;
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::{Arc, Mutex, MutexGuard, OnceLock, PoisonError, mpsc};

use napi::Env;
use napi::bindgen_prelude::{FunctionCallContext, JsValuesTupleIntoVec};
use napi::threadsafe_function::ThreadsafeFunction;
use napi::{Status, sys};

pub(crate) trait LockExt<T> {
    fn lock_unpoison(&self) -> MutexGuard<'_, T>;
}

impl<T> LockExt<T> for Mutex<T> {
    fn lock_unpoison(&self) -> MutexGuard<'_, T> {
        self.lock().unwrap_or_else(PoisonError::into_inner)
    }
}

use crate::ffi::value::{JsRef, Value};
use crate::handle::wrapper::WrapperRefOp;
use crate::messaging::error_reporter::ErrorReporter;
use crate::messaging::freeze::FreezeController;
use crate::messaging::wait_signal::WaitSignal;

type GlibTask = Box<dyn FnOnce() + Send + 'static>;

type DepthTaggedTask = (usize, GlibTask);

pub type WakeNodeTsfn = ThreadsafeFunction<(), (), (), Status, false, true>;

pub(crate) fn build_weak_tsfn<T, F>(
    env: Env,
    name: &str,
    handler: F,
) -> napi::Result<ThreadsafeFunction<T, (), T, Status, false, true>>
where
    T: 'static + JsValuesTupleIntoVec,
    F: 'static + Fn(FunctionCallContext) -> napi::Result<()>,
{
    env.create_function_from_closure::<T, (), F>(name, handler)?
        .build_threadsafe_function::<T>()
        .weak::<true>()
        .callee_handled::<false>()
        .build()
}

pub type NodeCallbackResult = (Value, Vec<(usize, Value)>);

struct NodeCallback {
    callback: Arc<JsRef>,
    args: Vec<Value>,
    capture_result: bool,
    ref_indices: Vec<usize>,
    result_tx: mpsc::Sender<anyhow::Result<NodeCallbackResult>>,
    glib_initiated: bool,
}

enum NodeTask {
    Callback(NodeCallback),
    DeleteReference(JsRefDeletion),
    WrapperRefOp {
        napi_ref: usize,
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

unsafe impl Send for JsRefDeletion {}

impl JsRefDeletion {
    pub(crate) fn new(env: sys::napi_env, raw: sys::napi_ref) -> Self {
        Self { env, raw }
    }

    pub(crate) fn delete_on_node_thread(self) {
        let status = unsafe { sys::napi_delete_reference(self.env, self.raw) };
        debug_assert_eq!(status, sys::Status::napi_ok);
    }
}

pub struct Mailbox {
    glib_inbox: Mutex<VecDeque<DepthTaggedTask>>,
    node_inbox: Mutex<VecDeque<NodeTask>>,

    callback_depth: AtomicUsize,

    wake_node: WaitSignal,
    wake_glib: WaitSignal,

    wake_node_tsfn: OnceLock<WakeNodeTsfn>,

    running: AtomicBool,

    freeze: FreezeController,
}

static MAILBOX: OnceLock<Mailbox> = OnceLock::new();

impl Default for Mailbox {
    fn default() -> Self {
        Self::new()
    }
}

impl Mailbox {
    pub fn global() -> &'static Self {
        MAILBOX.get_or_init(Self::new)
    }

    pub fn new() -> Self {
        Self {
            glib_inbox: Mutex::new(VecDeque::new()),
            node_inbox: Mutex::new(VecDeque::new()),
            callback_depth: AtomicUsize::new(0),
            wake_node: WaitSignal::new(),
            wake_glib: WaitSignal::new(),
            wake_node_tsfn: OnceLock::new(),
            running: AtomicBool::new(true),
            freeze: FreezeController::new(),
        }
    }

    pub fn mark_not_running(&self) {
        self.running.store(false, Ordering::Release);
        self.wake_node.notify();
        self.wake_glib.notify();
        self.freeze.wake_for_shutdown();
    }

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
        self.wake_node_tsfn.get().is_some()
    }

    pub fn enter_glib_callback(&self) {
        self.callback_depth.fetch_add(1, Ordering::AcqRel);
    }

    pub fn leave_glib_callback(&self) {
        self.callback_depth.fetch_sub(1, Ordering::AcqRel);
    }
}

pub(crate) fn send_or_report<T>(tx: &mpsc::Sender<T>, value: T, message: &str) {
    if tx.send(value).is_err() {
        ErrorReporter::global().report_str(message);
    }
}

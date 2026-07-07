pub(crate) mod error_reporter;
mod freeze;
pub(crate) mod log_handler;
mod node_mailbox;
pub mod wait_signal;

pub mod glib_mailbox;
pub mod panic_handler;

use std::collections::VecDeque;
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::{Mutex, MutexGuard, OnceLock, PoisonError, mpsc};

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

use crate::ffi::value::{JsHandle, Value};
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
    callback: JsHandle,
    args: Vec<Value>,
    capture_result: bool,
    ref_indices: Vec<usize>,
    result_tx: mpsc::Sender<anyhow::Result<NodeCallbackResult>>,
    glib_initiated: bool,
}

enum NodeTask {
    Callback(NodeCallback),
    ReleaseJsRef {
        id: u64,
    },
    DeleteWrapperRef {
        napi_ref: usize,
    },
    WrapperRefOp {
        napi_ref: usize,
        op: WrapperRefOp,
        result_tx: mpsc::Sender<anyhow::Result<()>>,
        glib_initiated: bool,
    },
    WrapperUnref {
        napi_ref: usize,
    },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum WrapperRefOp {
    Unref,
    Ref,
}

impl WrapperRefOp {
    pub(crate) fn apply(self, env: &Env, napi_ref: usize) {
        let raw_ref = napi_ref as sys::napi_ref;
        let mut count: u32 = 0;
        unsafe {
            match self {
                Self::Ref => {
                    sys::napi_reference_ref(env.raw(), raw_ref, &mut count);
                }
                Self::Unref => {
                    sys::napi_reference_unref(env.raw(), raw_ref, &mut count);
                }
            }
        }
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

pub(crate) const NATIVE_LOG_PREFIX: &str = "[gtkx:native]";

pub(crate) fn native_debug_enabled() -> bool {
    if std::env::args().any(|arg| arg == "--debug") {
        return true;
    }
    match std::env::var("GTKX_DEBUG") {
        Ok(spec) => spec
            .split(|c: char| c == ',' || c.is_whitespace())
            .any(|name| matches!(name, "1" | "*" | "native")),
        Err(_) => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lock_unpoison_returns_the_guard_and_recovers_from_poison() {
        let lock = Mutex::new(7u32);
        assert_eq!(*lock.lock_unpoison(), 7);

        let poisoned = Mutex::new(9u32);
        let _ = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            let _guard = poisoned.lock().expect("first lock should succeed");
            panic!("poison the mutex");
        }));
        assert_eq!(*poisoned.lock_unpoison(), 9);
    }

    #[test]
    fn send_or_report_delivers_to_an_open_channel() {
        let (tx, rx) = mpsc::channel();
        send_or_report(&tx, 42u32, "unused");
        assert_eq!(rx.recv().expect("value should arrive"), 42);
    }

    #[test]
    fn send_or_report_reports_when_the_receiver_is_gone() {
        let (tx, rx) = mpsc::channel::<u32>();
        drop(rx);
        send_or_report(&tx, 1, "receiver dropped");
    }

    #[test]
    fn wrapper_ref_op_is_copyable_and_comparable() {
        let op = WrapperRefOp::Ref;
        assert_eq!(op, WrapperRefOp::Ref);
        assert_ne!(op, WrapperRefOp::Unref);
        assert_eq!(format!("{op:?}"), "Ref");
    }

    #[test]
    fn mailbox_running_state_transitions() {
        let mailbox = Mailbox::new();
        assert!(!mailbox.is_not_running());
        mailbox.mark_not_running();
        assert!(mailbox.is_not_running());
        mailbox.reset_for_test();
        assert!(!mailbox.is_not_running());
    }

    #[test]
    fn mailbox_freeze_reports_only_the_outermost_entry() {
        let mailbox = Mailbox::new();
        assert!(mailbox.freeze());
        assert!(!mailbox.freeze());
        mailbox.unfreeze();
        mailbox.unfreeze();
        assert!(mailbox.freeze());
        mailbox.unfreeze();
    }

    #[test]
    fn mailbox_callback_depth_can_be_entered_and_left() {
        let mailbox = Mailbox::new();
        mailbox.enter_glib_callback();
        mailbox.leave_glib_callback();
    }
}

//! Task dispatch from JavaScript thread to GLib thread.
//!
//! This module provides mechanisms for scheduling Rust closures to execute
//! on the GLib main thread. GLib/GObject-based libraries require all operations
//! to happen on the main thread, so this dispatcher bridges the gap from the Neon JS thread.
//!
//! ## Scheduling Modes
//!
//! - [`GtkDispatcher::schedule`]: Queue a task for execution during the next GTK idle cycle.
//!   Uses `glib::idle_add_full` at `HIGH_IDLE` priority (100) for integration with the GLib
//!   event loop. This priority is higher than `GDK_PRIORITY_REDRAW` (120), ensuring dispatched
//!   tasks run before the frame clock paint in the same main context iteration.
//! - [`GtkDispatcher::dispatch_pending`]: Manually execute all queued tasks immediately.
//!   Used during blocking FFI calls to prevent deadlocks.
//!
//! ## Freeze Mode
//!
//! During React's commit phase, [`GtkDispatcher::freeze`] puts the dispatcher into
//! freeze mode. A single GTK-thread task enters a tight loop that processes all incoming
//! FFI calls via [`GtkDispatcher::dispatch_pending`] without returning to the GLib main
//! loop. This prevents the frame clock from firing between individual mutations, ensuring
//! a single atomic repaint after [`GtkDispatcher::unfreeze`] is called.
//!
//! Freeze calls use a depth counter to handle nesting: if a GTK signal fires during the
//! freeze and triggers a JS callback that causes another React commit, the inner
//! freeze/unfreeze calls are no-ops. Only the outermost [`GtkDispatcher::unfreeze`] exits
//! the loop.
//!
//! ## Signal Dispatch Isolation
//!
//! When a GTK signal callback dispatches to JS via `invoke_and_wait`, GLib blocks and
//! cooperatively processes tasks from JS to prevent deadlocks. However, only tasks
//! dispatched while `in_signal_dispatch` is set are processed during this cooperative
//! loop. This prevents unrelated tasks (e.g., model splices from React microtasks) from
//! executing during the PAINT phase of a frame, which would cause "snapshot without
//! allocation" warnings.
//!
//! ## Shutdown
//!
//! [`GtkDispatcher::mark_stopped`] signals that the application is shutting down. After this,
//! new tasks are silently dropped to allow clean termination. This is called after the
//! application hold guard is released and the GTK main loop has exited.

use std::collections::VecDeque;
use std::sync::{
    Mutex, OnceLock,
    atomic::{AtomicBool, AtomicUsize, Ordering},
    mpsc,
};

use gtk4::glib;
use neon::prelude::*;

use crate::error_reporter::NativeErrorReporter;
use crate::js_dispatch;
use crate::wait_signal::WaitSignal;

type TaskFn = Box<dyn FnOnce() + Send + 'static>;

struct Task {
    func: TaskFn,
    signal_scoped: bool,
}

pub struct GtkDispatcher {
    queue: Mutex<VecDeque<Task>>,
    dispatch_scheduled: AtomicBool,
    started: AtomicBool,
    stopped: AtomicBool,
    js_wait_depth: AtomicUsize,
    freeze_depth: AtomicUsize,
    freeze_loop_active: AtomicBool,
    pub freeze_wake: WaitSignal,
    pub wake: WaitSignal,
}

impl std::fmt::Debug for GtkDispatcher {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("GtkDispatcher")
            .field("started", &self.started)
            .field("stopped", &self.stopped)
            .field("freeze_depth", &self.freeze_depth)
            .finish()
    }
}

static DISPATCHER: OnceLock<GtkDispatcher> = OnceLock::new();

impl GtkDispatcher {
    pub fn global() -> &'static GtkDispatcher {
        DISPATCHER.get_or_init(GtkDispatcher::new)
    }

    fn new() -> Self {
        Self {
            queue: Mutex::new(VecDeque::new()),
            dispatch_scheduled: AtomicBool::new(false),
            started: AtomicBool::new(false),
            stopped: AtomicBool::new(false),
            js_wait_depth: AtomicUsize::new(0),
            freeze_depth: AtomicUsize::new(0),
            freeze_loop_active: AtomicBool::new(false),
            freeze_wake: WaitSignal::new(),
            wake: WaitSignal::new(),
        }
    }

    fn push_task(&self, func: TaskFn) {
        let signal_scoped = js_dispatch::JsDispatcher::global()
            .signal_callback_depth
            .load(Ordering::Acquire)
            > 0;
        self.queue
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
            .push_back(Task {
                func,
                signal_scoped,
            });
        if self.freeze_loop_active.load(Ordering::Acquire) {
            self.freeze_wake.notify();
        }
        js_dispatch::JsDispatcher::global().wake.notify();
    }

    fn pop_task(&self) -> Option<Task> {
        self.queue
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
            .pop_front()
    }

    fn pop_signal_scoped_task(&self) -> Option<Task> {
        let mut queue = self
            .queue
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);

        for i in 0..queue.len() {
            if queue[i].signal_scoped {
                return queue.remove(i);
            }
        }
        None
    }

    pub fn run_on_gtk_thread<F, T>(&self, task: F) -> mpsc::Receiver<T>
    where
        F: FnOnce() -> T + Send + 'static,
        T: Send + 'static,
    {
        let (tx, rx) = mpsc::channel();

        self.schedule(move || {
            if tx.send(task()).is_err() {
                NativeErrorReporter::global()
                    .report_str("GTK task completed but result channel was closed");
            }
        });

        rx
    }

    pub fn enter_js_wait(&self) {
        self.js_wait_depth.fetch_add(1, Ordering::AcqRel);
    }

    pub fn exit_js_wait(&self) {
        self.js_wait_depth.fetch_sub(1, Ordering::AcqRel);
    }

    pub fn is_js_waiting(&self) -> bool {
        self.js_wait_depth.load(Ordering::Acquire) > 0
    }

    pub fn mark_started(&self) {
        self.stopped.store(false, Ordering::Release);
        self.started.store(true, Ordering::Release);
    }

    pub fn is_started(&self) -> bool {
        self.started.load(Ordering::Acquire)
    }

    pub fn mark_stopped(&self) {
        self.started.store(false, Ordering::Release);
        self.stopped.store(true, Ordering::Release);
    }

    pub fn is_stopped(&self) -> bool {
        self.stopped.load(Ordering::Acquire)
    }

    pub fn freeze(&self) -> bool {
        self.freeze_depth.fetch_add(1, Ordering::AcqRel) == 0
    }

    pub fn unfreeze(&self) {
        if self.freeze_depth.fetch_sub(1, Ordering::AcqRel) == 1 {
            self.freeze_wake.notify();
        }
    }

    pub fn run_freeze_loop(&self) {
        self.freeze_loop_active.store(true, Ordering::Release);
        loop {
            self.dispatch_pending();
            if self.freeze_depth.load(Ordering::Acquire) == 0 {
                break;
            }
            self.freeze_wake.wait();
        }
        self.dispatch_pending();
        self.freeze_loop_active.store(false, Ordering::Release);
    }

    pub fn schedule<F>(&self, task: F)
    where
        F: FnOnce() + Send + 'static,
    {
        if self.stopped.load(Ordering::Acquire) {
            return;
        }

        self.push_task(Box::new(task));

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

    pub fn dispatch_pending(&self) -> bool {
        self.dispatch_scheduled.store(false, Ordering::Release);
        let mut dispatched = false;

        while let Some(task) = self.pop_task() {
            (task.func)();
            dispatched = true;
        }

        if dispatched {
            self.wake.notify();
        }

        dispatched
    }

    pub fn dispatch_signal_pending(&self) -> bool {
        let mut dispatched = false;

        while let Some(task) = self.pop_signal_scoped_task() {
            (task.func)();
            dispatched = true;
        }

        if dispatched {
            self.wake.notify();
        }

        dispatched
    }

    pub fn dispatch_and_wait<'a, R, C, F>(
        &self,
        cx: &mut C,
        task: F,
    ) -> Result<R, GtkDisconnectedError>
    where
        C: Context<'a>,
        F: FnOnce() -> R + Send + 'static,
        R: Send + 'static,
    {
        let (tx, rx) = mpsc::channel();
        self.enter_js_wait();
        self.schedule(move || {
            if tx.send(task()).is_err() {
                NativeErrorReporter::global()
                    .report_str("GTK dispatch completed but result channel was closed");
            }
        });
        self.wait_for_gtk_result(cx, &rx)
    }

    pub fn wait_for_gtk_result<'a, R, C: Context<'a>>(
        &self,
        cx: &mut C,
        rx: &mpsc::Receiver<R>,
    ) -> Result<R, GtkDisconnectedError> {
        let result = loop {
            js_dispatch::JsDispatcher::global().process_pending(cx);

            match rx.try_recv() {
                Ok(result) => break result,
                Err(mpsc::TryRecvError::Disconnected) => {
                    self.exit_js_wait();
                    return Err(GtkDisconnectedError);
                }
                Err(mpsc::TryRecvError::Empty) => self.wake.wait(),
            }
        };

        self.exit_js_wait();
        Ok(result)
    }
}

#[derive(Debug, Clone, Copy)]
pub struct GtkDisconnectedError;

impl std::fmt::Display for GtkDisconnectedError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "GTK thread disconnected")
    }
}

impl std::error::Error for GtkDisconnectedError {}

//! Task dispatch from JavaScript thread to GTK thread.
//!
//! This module provides mechanisms for scheduling Rust closures to execute
//! on the GTK main thread. GTK requires all widget operations to happen on
//! its main thread, so this dispatcher bridges the gap from the Neon JS thread.
//!
//! ## Scheduling Modes
//!
//! - [`GtkDispatcher::schedule`]: Queue a task for execution during the next GTK idle cycle.
//!   Uses `glib::idle_add_once` for integration with GTK's event loop.
//! - [`GtkDispatcher::dispatch_pending`]: Manually execute all queued tasks immediately.
//!   Used during blocking FFI calls to prevent deadlocks.
//!
//! ## JS Wait Tracking
//!
//! When JavaScript is blocking waiting for a GTK operation to complete,
//! callbacks must be routed differently. The wait depth tracking methods
//! ([`GtkDispatcher::enter_js_wait`], [`GtkDispatcher::exit_js_wait`],
//! [`GtkDispatcher::is_js_waiting`]) coordinate this.
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
use std::time::Duration;

use gtk4::glib;
use neon::prelude::*;

use crate::js_dispatch;

type Task = Box<dyn FnOnce() + Send + 'static>;

pub struct GtkDispatcher {
    queue: Mutex<VecDeque<Task>>,
    dispatch_scheduled: AtomicBool,
    started: AtomicBool,
    stopped: AtomicBool,
    js_wait_depth: AtomicUsize,
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
        }
    }

    fn push_task(&self, task: Task) {
        self.queue.lock().unwrap().push_back(task);
    }

    fn pop_task(&self) -> Option<Task> {
        self.queue.lock().unwrap().pop_front()
    }

    fn is_queue_empty(&self) -> bool {
        self.queue.lock().unwrap().is_empty()
    }

    pub fn run_on_gtk_thread<F, T>(&self, task: F) -> mpsc::Receiver<T>
    where
        F: FnOnce() -> T + Send + 'static,
        T: Send + 'static,
    {
        let (tx, rx) = mpsc::channel();

        self.schedule(move || {
            let _ = tx.send(task());
        });

        rx
    }

    pub fn is_js_waiting(&self) -> bool {
        self.js_wait_depth.load(Ordering::Acquire) > 0
    }

    pub fn enter_js_wait(&self) {
        self.js_wait_depth.fetch_add(1, Ordering::AcqRel);
    }

    pub fn exit_js_wait(&self) {
        self.js_wait_depth.fetch_sub(1, Ordering::AcqRel);
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

    pub fn schedule<F>(&self, task: F)
    where
        F: FnOnce() + Send + 'static,
    {
        if self.stopped.load(Ordering::Acquire) {
            return;
        }

        self.push_task(Box::new(task));

        if self
            .dispatch_scheduled
            .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
            .is_ok()
        {
            glib::idle_add_once(Self::idle_dispatch_callback);
        }
    }

    pub fn dispatch_pending(&self) -> bool {
        let mut dispatched = false;

        while let Some(task) = self.pop_task() {
            task();
            dispatched = true;
        }

        if dispatched {
            self.dispatch_scheduled.store(false, Ordering::Release);
            if !self.is_queue_empty()
                && self
                    .dispatch_scheduled
                    .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
                    .is_ok()
            {
                glib::idle_add_once(Self::idle_dispatch_callback);
            }
        }

        dispatched
    }

    fn drain_queue(&self) {
        self.dispatch_scheduled.store(false, Ordering::Release);

        while let Some(task) = self.pop_task() {
            task();
        }

        if !self.is_queue_empty()
            && self
                .dispatch_scheduled
                .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
                .is_ok()
        {
            glib::idle_add_once(Self::idle_dispatch_callback);
        }
    }

    fn idle_dispatch_callback() {
        Self::global().drain_queue();
    }

    pub fn wait_for_gtk_result<'a, R, C: Context<'a>>(
        &self,
        cx: &mut C,
        rx: &mpsc::Receiver<R>,
    ) -> Result<R, GtkDisconnectedError> {
        const POLL_INTERVAL: Duration = Duration::from_micros(100);

        let result = loop {
            js_dispatch::JsDispatcher::global().process_pending(cx);

            match rx.recv_timeout(POLL_INTERVAL) {
                Ok(result) => break result,
                Err(mpsc::RecvTimeoutError::Timeout) => continue,
                Err(mpsc::RecvTimeoutError::Disconnected) => {
                    self.exit_js_wait();
                    return Err(GtkDisconnectedError);
                }
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

//! Task dispatch from JavaScript thread to GTK thread.
//!
//! This module provides mechanisms for scheduling Rust closures to execute
//! on the GTK main thread. GTK requires all widget operations to happen on
//! its main thread, so this dispatcher bridges the gap from the Neon JS thread.
//!
//! ## Scheduling Modes
//!
//! - [`schedule`]: Queue a task for execution during the next GTK idle cycle.
//!   Uses `glib::idle_add_once` for integration with GTK's event loop.
//! - [`dispatch_pending`]: Manually execute all queued tasks immediately.
//!   Used during blocking FFI calls to prevent deadlocks.
//!
//! ## JS Wait Tracking
//!
//! When JavaScript is blocking waiting for a GTK operation to complete,
//! callbacks must be routed differently. The wait depth tracking functions
//! ([`enter_js_wait`], [`exit_js_wait`], [`is_js_waiting`]) coordinate this.
//!
//! ## Shutdown
//!
//! [`mark_stopped`] signals that the application is shutting down. After this,
//! new tasks are silently dropped to allow clean termination.

use std::sync::{
    atomic::{AtomicBool, AtomicUsize, Ordering},
    mpsc,
};

use gtk4::glib;

use crate::queue::Queue;

pub fn run_on_gtk_thread<F, T>(task: F) -> mpsc::Receiver<T>
where
    F: FnOnce() -> T + Send + 'static,
    T: Send + 'static,
{
    let (tx, rx) = mpsc::channel();

    schedule(move || {
        let _ = tx.send(task());
    });

    rx
}

type Task = Box<dyn FnOnce() + Send + 'static>;

static QUEUE: Queue<Task> = Queue::new();
static DISPATCH_SCHEDULED: AtomicBool = AtomicBool::new(false);
static STOPPED: AtomicBool = AtomicBool::new(false);
static JS_WAIT_DEPTH: AtomicUsize = AtomicUsize::new(0);

pub fn is_js_waiting() -> bool {
    JS_WAIT_DEPTH.load(Ordering::Acquire) > 0
}

pub fn enter_js_wait() {
    JS_WAIT_DEPTH.fetch_add(1, Ordering::AcqRel);
}

pub fn exit_js_wait() {
    JS_WAIT_DEPTH.fetch_sub(1, Ordering::AcqRel);
}

pub fn mark_stopped() {
    STOPPED.store(true, Ordering::Release);
}

pub fn schedule<F>(task: F)
where
    F: FnOnce() + Send + 'static,
{
    if STOPPED.load(Ordering::Acquire) {
        return;
    }

    QUEUE.push(Box::new(task));

    if DISPATCH_SCHEDULED
        .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
        .is_ok()
    {
        glib::idle_add_once(dispatch_batch);
    }
}

fn dispatch_batch() {
    DISPATCH_SCHEDULED.store(false, Ordering::Release);

    while let Some(task) = QUEUE.pop() {
        task();
    }

    if !QUEUE.is_empty()
        && DISPATCH_SCHEDULED
            .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
            .is_ok()
    {
        glib::idle_add_once(dispatch_batch);
    }
}

pub fn dispatch_pending() -> bool {
    let mut dispatched = false;

    while let Some(task) = QUEUE.pop() {
        task();
        dispatched = true;
    }

    if dispatched {
        DISPATCH_SCHEDULED.store(false, Ordering::Release);
        if !QUEUE.is_empty()
            && DISPATCH_SCHEDULED
                .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
                .is_ok()
        {
            glib::idle_add_once(dispatch_batch);
        }
    }

    dispatched
}


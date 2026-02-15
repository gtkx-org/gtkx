//! Task dispatch from JavaScript thread to GLib thread.
//!
//! This module provides mechanisms for scheduling Rust closures to execute
//! on the GLib main thread. GLib/GObject-based libraries require all operations
//! to happen on the main thread, so this dispatcher bridges the gap from the Neon JS thread.
//!
//! ## Scheduling Modes
//!
//! - [`GtkDispatcher::schedule`]: Queue a task for execution during the next GTK idle cycle.
//!   Uses `glib::idle_add_once` for integration with the GLib event loop.
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
use std::ptr::NonNull;
use std::sync::{
    Mutex, OnceLock,
    atomic::{AtomicBool, AtomicUsize, Ordering},
    mpsc,
};

use gtk4::glib::{self, gobject_ffi};
use neon::prelude::*;

use crate::js_dispatch;
use crate::state::GtkThreadState;
use crate::wait_signal::WaitSignal;

type Task = Box<dyn FnOnce() + Send + 'static>;

pub struct GtkDispatcher {
    queue: Mutex<VecDeque<Task>>,
    callback_queue: Mutex<VecDeque<Task>>,
    dispatch_scheduled: AtomicBool,
    started: AtomicBool,
    stopped: AtomicBool,
    js_wait_depth: AtomicUsize,
    callback_depth: AtomicUsize,
    batch_depth: AtomicUsize,
    batch_loop_active: AtomicBool,
    pub batch_wake: WaitSignal,
    pub wake: WaitSignal,
}

static DISPATCHER: OnceLock<GtkDispatcher> = OnceLock::new();

impl GtkDispatcher {
    pub fn global() -> &'static GtkDispatcher {
        DISPATCHER.get_or_init(GtkDispatcher::new)
    }

    fn new() -> Self {
        Self {
            queue: Mutex::new(VecDeque::new()),
            callback_queue: Mutex::new(VecDeque::new()),
            dispatch_scheduled: AtomicBool::new(false),
            started: AtomicBool::new(false),
            stopped: AtomicBool::new(false),
            js_wait_depth: AtomicUsize::new(0),
            callback_depth: AtomicUsize::new(0),
            batch_depth: AtomicUsize::new(0),
            batch_loop_active: AtomicBool::new(false),
            batch_wake: WaitSignal::new(),
            wake: WaitSignal::new(),
        }
    }

    fn push_task(&self, task: Task) {
        self.queue.lock().unwrap().push_back(task);
        if self.batch_loop_active.load(Ordering::Acquire) {
            self.batch_wake.notify();
        }
        js_dispatch::JsDispatcher::global().wake.notify();
    }

    fn pop_task(&self) -> Option<Task> {
        self.queue.lock().unwrap().pop_front()
    }

    fn is_queue_empty(&self) -> bool {
        self.queue.lock().unwrap().is_empty()
    }

    fn push_callback_task(&self, task: Task) {
        self.callback_queue.lock().unwrap().push_back(task);
        js_dispatch::JsDispatcher::global().wake.notify();
    }

    pub fn dispatch_callback_pending(&self) {
        let tasks: Vec<Task> = self.callback_queue.lock().unwrap().drain(..).collect();
        for task in tasks {
            task();
        }
        self.wake.notify();
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

    pub fn enter_callback(&self) {
        self.callback_depth.fetch_add(1, Ordering::AcqRel);
    }

    pub fn exit_callback(&self) {
        let prev = self.callback_depth.fetch_sub(1, Ordering::AcqRel);
        if prev == 1 {
            self.process_deferred_closure_unrefs();
        }
    }

    pub fn is_in_callback(&self) -> bool {
        self.callback_depth.load(Ordering::Acquire) > 0
    }

    pub fn defer_closure_unref(&self, closure: NonNull<gobject_ffi::GClosure>) {
        GtkThreadState::with(|state| {
            state.deferred_closure_unrefs.push(closure);
        });
    }

    fn process_deferred_closure_unrefs(&self) {
        GtkThreadState::with(|state| {
            let closures: Vec<_> = state.deferred_closure_unrefs.drain(..).collect();
            for closure in closures {
                unsafe { gobject_ffi::g_closure_unref(closure.as_ptr()) };
            }
        });
    }

    /// # Safety
    /// `closure_ptr` must be a valid pointer to a `GClosure`.
    pub unsafe fn install_closure_invalidate_notifier(closure_ptr: *mut gobject_ffi::GClosure) {
        unsafe extern "C" fn invalidate_notifier(
            _data: *mut std::ffi::c_void,
            closure: *mut gobject_ffi::GClosure,
        ) {
            let Some(closure_ptr) = NonNull::new(closure) else {
                return;
            };

            unsafe { gobject_ffi::g_closure_ref(closure) };

            if GtkDispatcher::global().is_in_callback() {
                GtkDispatcher::global().defer_closure_unref(closure_ptr);
            } else {
                glib::idle_add_local_once(move || {
                    unsafe { gobject_ffi::g_closure_unref(closure_ptr.as_ptr()) };
                });
            }
        }

        unsafe {
            gobject_ffi::g_closure_add_invalidate_notifier(
                closure_ptr,
                std::ptr::null_mut(),
                Some(invalidate_notifier),
            );
        }
    }

    pub fn freeze(&self) -> bool {
        self.batch_depth.fetch_add(1, Ordering::AcqRel) == 0
    }

    pub fn unfreeze(&self) {
        if self.batch_depth.fetch_sub(1, Ordering::AcqRel) == 1 {
            self.batch_wake.notify();
        }
    }

    pub fn run_batch_loop(&self) {
        self.batch_loop_active.store(true, Ordering::Release);
        loop {
            self.dispatch_pending();
            if self.batch_depth.load(Ordering::Acquire) == 0 {
                break;
            }
            self.batch_wake.wait();
        }
        self.dispatch_pending();
        self.batch_loop_active.store(false, Ordering::Release);
    }

    pub fn schedule<F>(&self, task: F)
    where
        F: FnOnce() + Send + 'static,
    {
        if self.stopped.load(Ordering::Acquire) {
            return;
        }

        if js_dispatch::JsDispatcher::global().is_executing_callback() && self.is_in_callback() {
            self.push_callback_task(Box::new(task));
            return;
        }

        self.push_task(Box::new(task));

        if self.batch_loop_active.load(Ordering::Acquire) {
            return;
        }

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
            self.wake.notify();
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

        self.wake.notify();

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

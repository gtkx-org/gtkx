

use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};

use gtk4::glib;

use crate::queue::Queue;

type Task = Box<dyn FnOnce() + Send + 'static>;

static QUEUE: Queue<Task> = Queue::new();
static DISPATCH_SCHEDULED: AtomicBool = AtomicBool::new(false);
static STOPPED: AtomicBool = AtomicBool::new(false);
static JS_WAIT_DEPTH: AtomicUsize = AtomicUsize::new(0);

/// Returns whether the JS thread is currently waiting for a GTK dispatch result.
///
/// When true, signal handlers should use `js_dispatch::queue()` for synchronous
/// processing. When false, they should use the Neon channel for async processing.
pub fn is_js_waiting() -> bool {
    JS_WAIT_DEPTH.load(Ordering::Acquire) > 0
}

/// Increments the JS wait depth counter.
///
/// Called when entering the wait loop in call.rs. Supports nested calls.
pub fn enter_js_wait() {
    JS_WAIT_DEPTH.fetch_add(1, Ordering::AcqRel);
}

/// Decrements the JS wait depth counter.
///
/// Called when exiting the wait loop in call.rs. Supports nested calls.
pub fn exit_js_wait() {
    JS_WAIT_DEPTH.fetch_sub(1, Ordering::AcqRel);
}

/// Marks the dispatch system as stopped.
///
/// After this is called, `schedule()` will silently drop new tasks instead of
/// trying to dispatch them. This prevents crashes when Node.js GC runs after
/// the GTK main loop has exited.
pub fn mark_stopped() {
    STOPPED.store(true, Ordering::Release);
}

/// Schedules a task to be executed on the GTK thread.
///
/// The task is added to a queue and will be dispatched either:
/// 1. By the GTK main loop via an idle source (normal path)
/// 2. By `dispatch_pending()` during signal handling (re-entrant path)
///
/// If the dispatch system has been marked as stopped, the task is silently dropped.
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_utils;
    use std::sync::{
        Arc,
        atomic::{AtomicBool, AtomicUsize, Ordering as AtomicOrdering},
    };

    #[test]
    fn js_wait_depth_starts_at_zero() {
        assert!(!is_js_waiting());
    }

    #[test]
    fn enter_exit_js_wait_tracks_depth() {
        let initial = is_js_waiting();
        assert!(!initial);

        enter_js_wait();
        assert!(is_js_waiting());

        enter_js_wait();
        assert!(is_js_waiting());

        exit_js_wait();
        assert!(is_js_waiting());

        exit_js_wait();
        assert!(!is_js_waiting());
    }

    #[test]
    fn dispatch_pending_executes_tasks() {
        test_utils::ensure_gtk_init();

        let executed = Arc::new(AtomicBool::new(false));
        let executed_clone = executed.clone();

        QUEUE.push(Box::new(move || {
            executed_clone.store(true, AtomicOrdering::SeqCst);
        }));

        let dispatched = dispatch_pending();

        assert!(dispatched);
        assert!(executed.load(AtomicOrdering::SeqCst));
    }

    #[test]
    fn dispatch_pending_returns_false_when_empty() {
        test_utils::ensure_gtk_init();

        while QUEUE.pop().is_some() {}

        let dispatched = dispatch_pending();
        assert!(!dispatched);
    }

    #[test]
    fn dispatch_pending_executes_multiple_tasks_in_order() {
        test_utils::ensure_gtk_init();

        let order = Arc::new(std::sync::Mutex::new(Vec::new()));

        for i in 0..5 {
            let order_clone = order.clone();
            QUEUE.push(Box::new(move || {
                order_clone.lock().unwrap().push(i);
            }));
        }

        dispatch_pending();

        let result = order.lock().unwrap();
        assert_eq!(*result, vec![0, 1, 2, 3, 4]);
    }

    #[test]
    fn task_can_schedule_another_task() {
        test_utils::ensure_gtk_init();

        let counter = Arc::new(AtomicUsize::new(0));
        let counter_clone = counter.clone();

        QUEUE.push(Box::new(move || {
            counter_clone.fetch_add(1, AtomicOrdering::SeqCst);

            let counter_inner = counter_clone.clone();
            QUEUE.push(Box::new(move || {
                counter_inner.fetch_add(1, AtomicOrdering::SeqCst);
            }));
        }));

        dispatch_pending();

        assert_eq!(counter.load(AtomicOrdering::SeqCst), 2);
    }

    #[test]
    fn task_closure_dropped_after_execution() {
        test_utils::ensure_gtk_init();

        let drop_counter = Arc::new(AtomicUsize::new(0));

        struct DropTracker {
            counter: Arc<AtomicUsize>,
        }

        impl Drop for DropTracker {
            fn drop(&mut self) {
                self.counter.fetch_add(1, AtomicOrdering::SeqCst);
            }
        }

        let tracker = DropTracker {
            counter: drop_counter.clone(),
        };

        QUEUE.push(Box::new(move || {
            let _t = tracker;
        }));

        assert_eq!(drop_counter.load(AtomicOrdering::SeqCst), 0);

        dispatch_pending();

        assert_eq!(drop_counter.load(AtomicOrdering::SeqCst), 1);
    }
}

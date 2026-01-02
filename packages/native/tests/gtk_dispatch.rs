mod common;

use std::sync::{
    Arc,
    atomic::{AtomicUsize, Ordering},
};

use native::gtk_dispatch::{dispatch_pending, enter_js_wait, exit_js_wait, is_js_waiting};
use native::queue::Queue;

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
fn queue_basic_operations() {
    let queue: Queue<i32> = Queue::new();

    assert!(queue.is_empty());

    queue.push(1);
    queue.push(2);
    queue.push(3);

    assert!(!queue.is_empty());

    assert_eq!(queue.pop(), Some(1));
    assert_eq!(queue.pop(), Some(2));
    assert_eq!(queue.pop(), Some(3));
    assert_eq!(queue.pop(), None);
    assert!(queue.is_empty());
}

#[test]
fn queue_fifo_order() {
    let queue: Queue<String> = Queue::new();

    for i in 0..5 {
        queue.push(format!("item-{}", i));
    }

    for i in 0..5 {
        assert_eq!(queue.pop(), Some(format!("item-{}", i)));
    }
}

#[test]
fn dispatch_pending_returns_false_when_empty() {
    common::ensure_gtk_init();

    while dispatch_pending() {}

    let dispatched = dispatch_pending();
    assert!(!dispatched);
}

#[test]
fn drop_tracker_works() {
    common::ensure_gtk_init();

    let drop_counter = Arc::new(AtomicUsize::new(0));

    struct DropTracker {
        counter: Arc<AtomicUsize>,
    }

    impl Drop for DropTracker {
        fn drop(&mut self) {
            self.counter.fetch_add(1, Ordering::SeqCst);
        }
    }

    {
        let _tracker = DropTracker {
            counter: drop_counter.clone(),
        };
    }

    assert_eq!(drop_counter.load(Ordering::SeqCst), 1);
}

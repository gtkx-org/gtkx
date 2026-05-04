mod common;

use std::sync::{
    Arc,
    atomic::{AtomicUsize, Ordering},
};

use native::dispatch::Mailbox;

fn drain_pending() {
    let mailbox = Mailbox::global();
    while mailbox.dispatch_pending() {}
}

#[test]
fn dispatch_pending_returns_false_when_empty() {
    common::ensure_gtk_init();
    drain_pending();

    let dispatched = Mailbox::global().dispatch_pending();
    assert!(!dispatched);
}

#[test]
fn schedule_glib_then_dispatch_pending_runs_task() {
    common::ensure_gtk_init();
    drain_pending();

    let counter = Arc::new(AtomicUsize::new(0));
    let counter_clone = counter.clone();

    Mailbox::global().schedule_glib(move || {
        counter_clone.fetch_add(1, Ordering::SeqCst);
    });

    assert_eq!(counter.load(Ordering::SeqCst), 0);

    let dispatched = Mailbox::global().dispatch_pending();
    assert!(dispatched);
    assert_eq!(counter.load(Ordering::SeqCst), 1);
}

#[test]
fn schedule_glib_drops_task_when_stopped() {
    common::ensure_gtk_init();
    drain_pending();

    let mailbox = Mailbox::global();
    mailbox.mark_stopped();

    let counter = Arc::new(AtomicUsize::new(0));
    let counter_clone = counter.clone();

    mailbox.schedule_glib(move || {
        counter_clone.fetch_add(1, Ordering::SeqCst);
    });

    let dispatched = mailbox.dispatch_pending();
    assert!(!dispatched);
    assert_eq!(counter.load(Ordering::SeqCst), 0);

    mailbox.reset_for_test();
}

#[test]
fn freeze_returns_true_only_for_outermost_call() {
    let mailbox = Mailbox::global();

    assert!(mailbox.freeze());
    assert!(!mailbox.freeze());
    assert!(!mailbox.freeze());

    mailbox.unfreeze();
    mailbox.unfreeze();
    mailbox.unfreeze();

    assert!(mailbox.freeze());
    mailbox.unfreeze();
}

#[test]
fn dispatch_pending_drains_multiple_tasks_in_fifo_order() {
    common::ensure_gtk_init();
    drain_pending();

    let order = Arc::new(std::sync::Mutex::new(Vec::<u32>::new()));

    for i in 0..5 {
        let order_clone = order.clone();
        Mailbox::global().schedule_glib(move || {
            order_clone.lock().unwrap().push(i);
        });
    }

    Mailbox::global().dispatch_pending();

    let collected = order.lock().unwrap().clone();
    assert_eq!(collected, vec![0, 1, 2, 3, 4]);
}

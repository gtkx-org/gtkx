use test_support as helpers;

use std::sync::{
    Arc,
    atomic::{AtomicUsize, Ordering},
};
use std::time::Duration;

use native::messaging::Mailbox;

fn drain_pending() {
    let mailbox = Mailbox::global();
    while mailbox.process_glib_pending() {}
}

fn schedule_increment(mailbox: &Mailbox) -> Arc<AtomicUsize> {
    let counter = Arc::new(AtomicUsize::new(0));
    let counter_clone = counter.clone();
    mailbox.schedule_glib(Box::new(move || {
        counter_clone.fetch_add(1, Ordering::SeqCst);
    }));
    counter
}

fn schedule_incrementing_task() -> Arc<AtomicUsize> {
    drain_pending();
    schedule_increment(Mailbox::global())
}

fn frozen_mailbox_with_task() -> (&'static Mailbox, Arc<AtomicUsize>) {
    drain_pending();
    let mailbox = Mailbox::global();
    assert!(mailbox.freeze());
    let counter = schedule_increment(mailbox);
    (mailbox, counter)
}

#[test]
fn dispatch_pending_returns_false_when_empty() {
    helpers::run(|| {
        drain_pending();
        let dispatched = Mailbox::global().process_glib_pending();
        assert!(!dispatched);
    });
}

#[test]
fn schedule_glib_then_dispatch_pending_runs_task() {
    helpers::run(|| {
        let counter = schedule_incrementing_task();
        assert_eq!(counter.load(Ordering::SeqCst), 0);

        let dispatched = Mailbox::global().process_glib_pending();
        assert!(dispatched);
        assert_eq!(counter.load(Ordering::SeqCst), 1);
    });
}

#[test]
fn schedule_glib_drops_task_when_stopped() {
    helpers::run(|| {
        let mailbox = Mailbox::new();
        mailbox.mark_not_running();

        let counter = schedule_increment(&mailbox);

        let dispatched = mailbox.process_glib_pending();
        assert!(!dispatched);
        assert_eq!(counter.load(Ordering::SeqCst), 0);
    });
}

#[test]
fn freeze_returns_true_only_for_outermost_call() {
    helpers::run(|| {
        let mailbox = Mailbox::global();

        assert!(mailbox.freeze());
        assert!(!mailbox.freeze());
        assert!(!mailbox.freeze());

        mailbox.unfreeze();
        mailbox.unfreeze();
        mailbox.unfreeze();

        assert!(mailbox.freeze());
        mailbox.unfreeze();
    });
}

#[test]
fn a_schedule_glib_idle_source_dispatches_through_global_main_context() {
    helpers::run(|| {
        let counter = schedule_incrementing_task();

        helpers::pump_default_context_until(|| counter.load(Ordering::SeqCst) == 1);

        assert_eq!(counter.load(Ordering::SeqCst), 1);
    });
}

#[test]
fn is_not_running_reflects_mark_not_running() {
    helpers::run(|| {
        let mailbox = Mailbox::new();

        assert!(!mailbox.is_not_running());

        mailbox.mark_not_running();
        assert!(mailbox.is_not_running());
    });
}

#[test]
fn run_freeze_loop_drains_until_unfrozen() {
    helpers::run(|| {
        let (mailbox, counter) = frozen_mailbox_with_task();

        let unfreezer = {
            let counter = counter.clone();
            std::thread::spawn(move || {
                let mailbox = Mailbox::global();
                while counter.load(Ordering::SeqCst) == 0 {
                    std::thread::yield_now();
                }
                mailbox.schedule_glib(Box::new(move || {
                    counter.fetch_add(1, Ordering::SeqCst);
                }));
                mailbox.unfreeze();
            })
        };

        mailbox.run_freeze_loop();
        unfreezer.join().expect("unfreezer thread should finish");

        assert_eq!(counter.load(Ordering::SeqCst), 2);
    });
}

#[test]
fn run_freeze_loop_exits_when_stopped_while_frozen() {
    helpers::run(|| {
        let mailbox = Mailbox::new();
        assert!(mailbox.freeze());
        let counter = schedule_increment(&mailbox);

        std::thread::scope(|scope| {
            scope.spawn(|| {
                while counter.load(Ordering::SeqCst) == 0 {
                    std::thread::yield_now();
                }
                mailbox.mark_not_running();
            });

            mailbox.run_freeze_loop();
        });

        assert!(mailbox.is_not_running());

        mailbox.unfreeze();
    });
}

#[test]
fn unfreeze_without_freeze_does_not_wrap_depth() {
    helpers::run(|| {
        let mailbox = Mailbox::global();

        mailbox.unfreeze();

        assert!(mailbox.freeze());
        assert!(!mailbox.freeze());
        mailbox.unfreeze();
        mailbox.unfreeze();
    });
}

#[test]
fn schedule_glib_inside_freeze_loop_skips_idle_source() {
    helpers::run(|| {
        drain_pending();
        let mailbox = Mailbox::global();
        let nested_ran = Arc::new(AtomicUsize::new(0));

        assert!(mailbox.freeze());

        let nested_for_outer = nested_ran.clone();
        mailbox.schedule_glib(Box::new(move || {
            let mailbox = Mailbox::global();
            mailbox.schedule_glib(Box::new(move || {
                nested_for_outer.fetch_add(1, Ordering::SeqCst);
            }));
        }));

        let unfreezer = {
            let nested = nested_ran.clone();
            std::thread::spawn(move || {
                let mailbox = Mailbox::global();
                while nested.load(Ordering::SeqCst) == 0 {
                    std::thread::yield_now();
                }
                mailbox.unfreeze();
            })
        };

        mailbox.run_freeze_loop();
        unfreezer.join().expect("unfreezer thread should finish");

        assert_eq!(nested_ran.load(Ordering::SeqCst), 1);
    });
}

#[test]
fn dispatch_pending_drains_multiple_tasks_in_fifo_order() {
    helpers::run(|| {
        drain_pending();
        let order = Arc::new(std::sync::Mutex::new(Vec::<u32>::new()));

        for i in 0..5 {
            let order_clone = order.clone();
            Mailbox::global().schedule_glib(Box::new(move || {
                order_clone.lock().unwrap().push(i);
            }));
        }

        Mailbox::global().process_glib_pending();

        let collected = order.lock().unwrap().clone();
        assert_eq!(collected, vec![0, 1, 2, 3, 4]);
    });
}

#[test]
fn dispatch_pending_from_depth_defers_top_level_tasks() {
    helpers::run(|| {
        drain_pending();
        let mailbox = Mailbox::global();
        let counter = schedule_increment(mailbox);

        assert!(!mailbox.process_glib_pending_from_depth(1));
        assert_eq!(counter.load(Ordering::SeqCst), 0);

        assert!(mailbox.process_glib_pending_from_depth(0));
        assert_eq!(counter.load(Ordering::SeqCst), 1);
    });
}
#[test]
fn reentrant_freeze_loop_does_not_strand_outer_loop() {
    helpers::run(|| {
        let mailbox = Mailbox::global();
        mailbox.reset_for_test();
        drain_pending();

        assert!(mailbox.freeze());

        let done = Arc::new(AtomicUsize::new(0));
        let done_inner = done.clone();
        mailbox.schedule_glib(Box::new(move || {
            let mailbox = Mailbox::global();
            mailbox.unfreeze();
            mailbox.run_freeze_loop();
            mailbox.freeze();
            done_inner.fetch_add(1, Ordering::SeqCst);
        }));

        let outer = std::thread::spawn(|| Mailbox::global().run_freeze_loop());

        while done.load(Ordering::SeqCst) == 0 {
            std::thread::yield_now();
        }
        std::thread::sleep(Duration::from_millis(50));

        let probe = schedule_increment(mailbox);
        let mut woke = false;
        for _ in 0..1000 {
            if probe.load(Ordering::SeqCst) == 1 {
                woke = true;
                break;
            }
            std::thread::sleep(Duration::from_millis(1));
        }

        mailbox.mark_not_running();
        outer
            .join()
            .expect("outer freeze loop thread should finish");
        mailbox.unfreeze();
        mailbox.reset_for_test();
        drain_pending();

        assert!(
            woke,
            "re-entrant run_freeze_loop clobbered freeze-loop liveness; probe task was stranded"
        );
    });
}

#[test]
fn dispatch_pending_from_depth_runs_deeper_task_before_shallower_one() {
    helpers::run(|| {
        drain_pending();
        let mailbox = Mailbox::global();
        let order = Arc::new(std::sync::Mutex::new(Vec::<u32>::new()));

        let order_top = order.clone();
        mailbox.schedule_glib(Box::new(move || {
            order_top.lock().unwrap().push(0);
        }));

        mailbox.enter_glib_callback();
        let order_nested = order.clone();
        mailbox.schedule_glib(Box::new(move || {
            order_nested.lock().unwrap().push(1);
        }));
        mailbox.leave_glib_callback();

        assert!(mailbox.process_glib_pending_from_depth(1));
        assert_eq!(*order.lock().unwrap(), vec![1]);

        assert!(mailbox.process_glib_pending());
        assert_eq!(*order.lock().unwrap(), vec![1, 0]);
    });
}

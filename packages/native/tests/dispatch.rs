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

/// Drains pending work, schedules a glib task that increments the returned
/// counter, and returns the counter so the test can observe whether the task
/// has run.
fn schedule_incrementing_task() -> Arc<AtomicUsize> {
    drain_pending();
    let counter = Arc::new(AtomicUsize::new(0));
    let counter_clone = counter.clone();
    Mailbox::global().schedule_glib(Box::new(move || {
        counter_clone.fetch_add(1, Ordering::SeqCst);
    }));
    counter
}

#[test]
fn dispatch_pending_returns_false_when_empty() {
    common::run(|| {
        drain_pending();
        let dispatched = Mailbox::global().dispatch_pending();
        assert!(!dispatched);
    });
}

#[test]
fn schedule_glib_then_dispatch_pending_runs_task() {
    common::run(|| {
        let counter = schedule_incrementing_task();
        assert_eq!(counter.load(Ordering::SeqCst), 0);

        let dispatched = Mailbox::global().dispatch_pending();
        assert!(dispatched);
        assert_eq!(counter.load(Ordering::SeqCst), 1);
    });
}

#[test]
fn schedule_glib_drops_task_when_stopped() {
    common::run(|| {
        drain_pending();
        let mailbox = Mailbox::global();
        mailbox.mark_stopped();

        let counter = Arc::new(AtomicUsize::new(0));
        let counter_clone = counter.clone();

        mailbox.schedule_glib(Box::new(move || {
            counter_clone.fetch_add(1, Ordering::SeqCst);
        }));

        let dispatched = mailbox.dispatch_pending();
        assert!(!dispatched);
        assert_eq!(counter.load(Ordering::SeqCst), 0);

        mailbox.reset_for_test();
    });
}

#[test]
fn freeze_returns_true_only_for_outermost_call() {
    common::run(|| {
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

/// Named with a leading `a_` so libtest's alphabetical ordering runs it first:
/// `gtk4::init` acquires the global default `MainContext` for whichever thread
/// calls it first, so the idle source `schedule_glib` registers there can only
/// be dispatched from that same thread.
#[test]
fn a_schedule_glib_idle_source_dispatches_through_global_main_context() {
    common::run(|| {
        let counter = schedule_incrementing_task();

        let context = gtk4::glib::MainContext::default();
        for _ in 0..1000 {
            if counter.load(Ordering::SeqCst) == 1 {
                break;
            }
            if !context.iteration(false) {
                std::thread::yield_now();
            }
        }

        assert_eq!(counter.load(Ordering::SeqCst), 1);
    });
}

#[test]
fn is_stopped_reflects_mark_and_reset() {
    common::run(|| {
        let mailbox = Mailbox::global();

        assert!(!mailbox.is_stopped());

        mailbox.mark_stopped();
        assert!(mailbox.is_stopped());

        mailbox.reset_for_test();
        assert!(!mailbox.is_stopped());
    });
}

#[test]
fn notify_js_does_not_panic() {
    common::run(|| {
        Mailbox::global().notify_js();
    });
}

#[test]
fn run_freeze_loop_drains_until_unfrozen() {
    common::run(|| {
        drain_pending();
        let mailbox = Mailbox::global();
        let counter = Arc::new(AtomicUsize::new(0));

        assert!(mailbox.freeze());

        let counter_for_task = counter.clone();
        mailbox.schedule_glib(Box::new(move || {
            counter_for_task.fetch_add(1, Ordering::SeqCst);
        }));

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
    common::run(|| {
        drain_pending();
        let mailbox = Mailbox::global();
        let counter = Arc::new(AtomicUsize::new(0));

        assert!(mailbox.freeze());

        let counter_for_task = counter.clone();
        mailbox.schedule_glib(Box::new(move || {
            counter_for_task.fetch_add(1, Ordering::SeqCst);
        }));

        let stopper = std::thread::spawn(move || {
            while counter.load(Ordering::SeqCst) == 0 {
                std::thread::yield_now();
            }
            Mailbox::global().mark_stopped();
        });

        mailbox.run_freeze_loop();
        stopper.join().expect("stopper thread should finish");

        assert!(mailbox.is_stopped());

        mailbox.unfreeze();
        mailbox.reset_for_test();
    });
}

#[test]
fn unfreeze_without_freeze_does_not_wrap_depth() {
    common::run(|| {
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
    common::run(|| {
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
fn glib_dispatch_error_display_and_debug() {
    use native::dispatch::GlibDispatchError;

    let disconnected = GlibDispatchError::Disconnected;
    assert_eq!(disconnected.to_string(), "GLib thread disconnected");
    assert!(format!("{disconnected:?}").contains("Disconnected"));

    let panicked = GlibDispatchError::TaskPanicked("boom".to_owned());
    assert_eq!(panicked.to_string(), "GLib task panicked: boom");
    assert!(format!("{panicked:?}").contains("TaskPanicked"));
}

#[test]
fn mailbox_debug_format_lists_state() {
    common::run(|| {
        let debug_str = format!("{:?}", Mailbox::global());
        assert!(debug_str.contains("Mailbox"));
        assert!(debug_str.contains("stopped"));
        assert!(debug_str.contains("freeze_depth"));
    });
}

#[test]
fn dispatch_pending_drains_multiple_tasks_in_fifo_order() {
    common::run(|| {
        drain_pending();
        let order = Arc::new(std::sync::Mutex::new(Vec::<u32>::new()));

        for i in 0..5 {
            let order_clone = order.clone();
            Mailbox::global().schedule_glib(Box::new(move || {
                order_clone.lock().unwrap().push(i);
            }));
        }

        Mailbox::global().dispatch_pending();

        let collected = order.lock().unwrap().clone();
        assert_eq!(collected, vec![0, 1, 2, 3, 4]);
    });
}

#[test]
fn dispatch_pending_from_depth_defers_top_level_tasks() {
    common::run(|| {
        drain_pending();
        let mailbox = Mailbox::global();
        let counter = Arc::new(AtomicUsize::new(0));

        let counter_clone = counter.clone();
        mailbox.schedule_glib(Box::new(move || {
            counter_clone.fetch_add(1, Ordering::SeqCst);
        }));

        assert!(!mailbox.dispatch_pending_from_depth(1));
        assert_eq!(counter.load(Ordering::SeqCst), 0);

        assert!(mailbox.dispatch_pending_from_depth(0));
        assert_eq!(counter.load(Ordering::SeqCst), 1);
    });
}

#[test]
fn dispatch_pending_from_depth_runs_nested_tasks() {
    common::run(|| {
        drain_pending();
        let mailbox = Mailbox::global();
        let counter = Arc::new(AtomicUsize::new(0));

        mailbox.enter_glib_callback();
        let counter_clone = counter.clone();
        mailbox.schedule_glib(Box::new(move || {
            counter_clone.fetch_add(1, Ordering::SeqCst);
        }));
        mailbox.leave_glib_callback();

        assert!(mailbox.dispatch_pending_from_depth(1));
        assert_eq!(counter.load(Ordering::SeqCst), 1);
    });
}

#[test]
fn dispatch_pending_recovers_from_panicking_task_and_continues() {
    common::run(|| {
        drain_pending();
        let mailbox = Mailbox::global();
        let after = Arc::new(AtomicUsize::new(0));

        mailbox.schedule_glib(Box::new(|| {
            panic!("deliberate panic inside dispatched task");
        }));

        let after_for_task = after.clone();
        mailbox.schedule_glib(Box::new(move || {
            after_for_task.fetch_add(1, Ordering::SeqCst);
        }));

        let previous_hook = std::panic::take_hook();
        std::panic::set_hook(Box::new(|_| {}));
        let dispatched = mailbox.dispatch_pending();
        std::panic::set_hook(previous_hook);

        assert!(dispatched);
        assert_eq!(after.load(Ordering::SeqCst), 1);
    });
}

#[test]
fn dispatch_pending_from_depth_runs_deeper_task_before_shallower_one() {
    common::run(|| {
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

        assert!(mailbox.dispatch_pending_from_depth(1));
        assert_eq!(*order.lock().unwrap(), vec![1]);

        assert!(mailbox.dispatch_pending());
        assert_eq!(*order.lock().unwrap(), vec![1, 0]);
    });
}

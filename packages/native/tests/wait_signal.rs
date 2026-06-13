mod common;

use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::thread;
use std::time::Duration;

use native::dispatch::wait_signal::WaitSignal;

#[test]
fn new_creates_unsignalled_state() {
    let signal = WaitSignal::new();
    signal.notify();
    signal.wait();
}

#[test]
fn default_matches_new() {
    let signal = WaitSignal::default();
    signal.notify();
    signal.wait();
}

#[test]
fn notify_before_wait_does_not_block() {
    let signal = WaitSignal::new();

    signal.notify();
    signal.wait();
}

#[test]
fn wait_consumes_the_notification() {
    let signal = Arc::new(WaitSignal::new());

    signal.notify();
    signal.wait();

    let consumed = Arc::new(AtomicBool::new(false));
    let consumed_clone = consumed.clone();
    let signal_clone = signal.clone();

    let waiter = thread::spawn(move || {
        signal_clone.wait();
        consumed_clone.store(true, Ordering::SeqCst);
    });

    thread::sleep(Duration::from_millis(50));
    assert!(!consumed.load(Ordering::SeqCst));

    signal.notify();
    waiter.join().expect("waiter thread should finish");
    assert!(consumed.load(Ordering::SeqCst));
}

#[test]
fn wait_blocks_until_another_thread_notifies() {
    let signal = Arc::new(WaitSignal::new());
    let signal_clone = signal.clone();

    let woke = Arc::new(AtomicBool::new(false));
    let woke_clone = woke.clone();

    let waiter = thread::spawn(move || {
        signal_clone.wait();
        woke_clone.store(true, Ordering::SeqCst);
    });

    thread::sleep(Duration::from_millis(50));
    assert!(!woke.load(Ordering::SeqCst));

    signal.notify();
    waiter.join().expect("waiter thread should finish");
    assert!(woke.load(Ordering::SeqCst));
}

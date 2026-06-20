use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};

use crate::dispatch::Mailbox;
use crate::dispatch::wait_signal::WaitSignal;
use crate::error_reporter::NativeErrorReporter;

#[derive(Debug)]
pub(super) struct FreezeController {
    depth: AtomicUsize,
    loop_active: AtomicBool,
    wake: WaitSignal,
}

impl FreezeController {
    pub(super) fn new() -> Self {
        Self {
            depth: AtomicUsize::new(0),
            loop_active: AtomicBool::new(false),
            wake: WaitSignal::new(),
        }
    }

    pub(super) fn enter(&self) -> bool {
        self.depth.fetch_add(1, Ordering::AcqRel) == 0
    }

    pub(super) fn leave(&self) {
        let previous = self
            .depth
            .fetch_update(Ordering::AcqRel, Ordering::Acquire, |depth| {
                depth.checked_sub(1)
            });
        match previous {
            Ok(1) => self.wake.notify(),
            Ok(_) => {}
            Err(_) => NativeErrorReporter::global()
                .report_str("unfreeze called without a matching freeze; ignoring"),
        }
    }

    pub(super) fn loop_active(&self) -> bool {
        self.loop_active.load(Ordering::Acquire)
    }

    pub(super) fn notify_if_active(&self) {
        if self.loop_active() {
            self.wake.notify();
        }
    }

    pub(super) fn wake_for_shutdown(&self) {
        self.wake.notify();
    }

    pub(super) fn run_loop(&self, mailbox: &Mailbox) {
        self.loop_active.store(true, Ordering::Release);
        loop {
            mailbox.dispatch_pending();
            if self.depth.load(Ordering::Acquire) == 0 || mailbox.is_not_running() {
                break;
            }
            self.wake.wait();
        }
        self.loop_active.store(false, Ordering::Release);
        mailbox.dispatch_pending();
    }
}

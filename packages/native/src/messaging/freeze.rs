use std::sync::atomic::{AtomicUsize, Ordering};

use crate::messaging::Mailbox;
use crate::messaging::error_reporter::ErrorReporter;
use crate::messaging::wait_signal::WaitSignal;

#[derive(Debug)]
pub(super) struct FreezeController {
    depth: AtomicUsize,
    live_loops: AtomicUsize,
    wake: WaitSignal,
}

impl FreezeController {
    pub(super) fn new() -> Self {
        Self {
            depth: AtomicUsize::new(0),
            live_loops: AtomicUsize::new(0),
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
            Err(_) => ErrorReporter::global()
                .report_str("unfreeze called without a matching freeze; ignoring"),
        }
    }

    pub(super) fn loop_active(&self) -> bool {
        self.live_loops.load(Ordering::Acquire) > 0
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
        self.live_loops.fetch_add(1, Ordering::AcqRel);
        loop {
            mailbox.process_glib_pending();
            if self.depth.load(Ordering::Acquire) == 0 || mailbox.is_not_running() {
                break;
            }
            self.wake.wait();
        }
        self.live_loops.fetch_sub(1, Ordering::AcqRel);
        mailbox.process_glib_pending();
    }
}

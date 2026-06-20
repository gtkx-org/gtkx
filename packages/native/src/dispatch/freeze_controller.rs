//! The commit-freeze sub-state-machine the [`Mailbox`] composes.
//!
//! React's commit phase brackets a batch of mutations with [`Self::enter`] /
//! [`Self::leave`]. While frozen, the `GLib` thread runs a tight loop
//! ([`Self::run_loop`]) that drains incoming tasks without yielding to the
//! `GLib` main loop, so the frame clock cannot fire mid-commit. Nested freeze
//! pairs are no-ops; only the outermost pair starts and stops the loop.

use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};

use crate::dispatch::Mailbox;
use crate::dispatch::wait_signal::WaitSignal;
use crate::error_reporter::NativeErrorReporter;

/// Owns the freeze depth counter, the loop-active flag, and the wake signal the
/// freeze loop parks on, isolating the commit-freeze lifecycle from the rest of
/// the [`Mailbox`].
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

    /// Increments the freeze depth. Returns true if this was the outermost call.
    pub(super) fn enter(&self) -> bool {
        self.depth.fetch_add(1, Ordering::AcqRel) == 0
    }

    /// Decrements the freeze depth. Wakes the freeze loop when depth reaches
    /// zero.
    ///
    /// An unpaired call (depth already zero) is rejected and reported instead
    /// of wrapping the counter, which would permanently disable commit
    /// freezing.
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

    /// Whether the freeze loop is currently draining tasks.
    pub(super) fn loop_active(&self) -> bool {
        self.loop_active.load(Ordering::Acquire)
    }

    /// Wakes the freeze loop when it is active, so a newly queued task is
    /// drained without yielding to the `GLib` main loop.
    pub(super) fn notify_if_active(&self) {
        if self.loop_active() {
            self.wake.notify();
        }
    }

    /// Wakes the freeze loop so it observes a shutdown and exits its drain.
    pub(super) fn wake_for_shutdown(&self) {
        self.wake.notify();
    }

    /// Drains all currently-queued `GLib` tasks on `mailbox` until [`Self::leave`]
    /// resets the freeze depth to zero or the mailbox shuts down. Runs on the
    /// `GLib` thread without yielding to the `GLib` main loop, preventing the
    /// frame clock from firing between individual mutations during a React
    /// commit.
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

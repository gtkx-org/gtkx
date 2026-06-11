//! Single-permit wake signal for the mailbox wait loops.
//!
//! A [`WaitSignal`] is a binary permit: [`WaitSignal::notify`] deposits the
//! permit (idempotently — multiple notifies before a wait collapse into one),
//! and [`WaitSignal::wait`] blocks until a permit is present and consumes it.
//! Because the permit persists until consumed, a notify that lands before the
//! waiter parks is never lost.
//!
//! The signal is designed for a **single waiter**: `notify` uses
//! `Condvar::notify_one`, and the consumed permit means concurrent waiters
//! would steal each other's wakeups. Each [`crate::dispatch::Mailbox`] wait
//! loop therefore owns its signal exclusively — `wake_js` is waited on only by
//! the JS thread, `wake_glib` and `freeze_wake` only by the `GLib` thread.
//!
//! Lock poisoning is deliberately swallowed (`PoisonError::into_inner`): the
//! protected state is a plain `bool` with no invariant a panicking thread
//! could have broken mid-update.

use std::sync::{Condvar, Mutex};

/// A consumable binary wake permit coordinating one waiter with its notifiers.
#[derive(Debug)]
pub struct WaitSignal {
    state: Mutex<bool>,
    condvar: Condvar,
}

impl Default for WaitSignal {
    fn default() -> Self {
        Self::new()
    }
}

impl WaitSignal {
    /// Creates a signal with no permit deposited.
    #[must_use]
    pub fn new() -> Self {
        Self {
            state: Mutex::new(false),
            condvar: Condvar::new(),
        }
    }

    /// Deposits the wake permit and wakes the waiter if it is parked.
    /// Multiple notifies before the next [`Self::wait`] collapse into one
    /// permit.
    pub fn notify(&self) {
        {
            let mut notified = self
                .state
                .lock()
                .unwrap_or_else(std::sync::PoisonError::into_inner);
            *notified = true;
        }
        self.condvar.notify_one();
    }

    /// Blocks until a permit is present, then consumes it. Returns
    /// immediately when a notify already landed, so a wakeup raced against
    /// parking is never lost.
    pub fn wait(&self) {
        let mut notified = self
            .state
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        while !*notified {
            notified = self
                .condvar
                .wait(notified)
                .unwrap_or_else(std::sync::PoisonError::into_inner);
        }
        *notified = false;
    }
}

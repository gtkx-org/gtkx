use std::sync::{Condvar, Mutex};

use crate::messaging::LockExt as _;

#[derive(Debug)]
pub struct WaitSignal {
    notified: Mutex<bool>,
    condvar: Condvar,
}

impl Default for WaitSignal {
    fn default() -> Self {
        Self::new()
    }
}

impl WaitSignal {
    pub fn new() -> Self {
        Self {
            notified: Mutex::new(false),
            condvar: Condvar::new(),
        }
    }

    pub fn notify(&self) {
        {
            let mut notified = self.notified.lock_unpoison();
            *notified = true;
        }
        self.condvar.notify_one();
    }

    pub fn wait(&self) {
        let mut notified = self.notified.lock_unpoison();
        while !*notified {
            notified = self
                .condvar
                .wait(notified)
                .unwrap_or_else(std::sync::PoisonError::into_inner);
        }
        *notified = false;
    }
}

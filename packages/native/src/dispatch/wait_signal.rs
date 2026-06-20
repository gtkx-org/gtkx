use parking_lot::{Condvar, Mutex};

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
    #[must_use]
    pub fn new() -> Self {
        Self {
            state: Mutex::new(false),
            condvar: Condvar::new(),
        }
    }

    pub fn notify(&self) {
        {
            let mut notified = self.state.lock();
            *notified = true;
        }
        self.condvar.notify_one();
    }

    pub fn wait(&self) {
        let mut notified = self.state.lock();
        while !*notified {
            self.condvar.wait(&mut notified);
        }
        *notified = false;
    }
}

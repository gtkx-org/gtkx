//! Thread-safe generic FIFO queue.
//!
//! [`Queue<T>`] provides a simple thread-safe queue for coordinating work
//! between threads. Used by both [`gtk_dispatch`](crate::gtk_dispatch) and
//! [`js_dispatch`](crate::js_dispatch) for task scheduling.
//!
//! ## Thread Safety
//!
//! All operations acquire a mutex lock, making concurrent push/pop from
//! multiple threads safe. The queue is suitable for multi-producer,
//! multi-consumer scenarios.

use std::{collections::VecDeque, sync::Mutex};

pub struct Queue<T> {
    items: Mutex<VecDeque<T>>,
}

impl<T> Default for Queue<T> {
    fn default() -> Self {
        Self::new()
    }
}

impl<T> Queue<T> {
    pub const fn new() -> Self {
        Self {
            items: Mutex::new(VecDeque::new()),
        }
    }

    pub fn push(&self, item: T) {
        self.items
            .lock()
            .expect("Queue mutex poisoned during push")
            .push_back(item);
    }

    pub fn pop(&self) -> Option<T> {
        self.items
            .lock()
            .expect("Queue mutex poisoned during pop")
            .pop_front()
    }

    pub fn is_empty(&self) -> bool {
        self.items
            .lock()
            .expect("Queue mutex poisoned during is_empty check")
            .is_empty()
    }
}


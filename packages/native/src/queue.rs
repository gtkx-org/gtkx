

use std::{collections::VecDeque, sync::Mutex};

pub struct Queue<T> {
    items: Mutex<VecDeque<T>>,
}

impl<T> Queue<T> {
    pub const fn new() -> Self {
        Self {
            items: Mutex::new(VecDeque::new()),
        }
    }

    pub fn push(&self, item: T) {
        self.items.lock().unwrap().push_back(item);
    }

    pub fn pop(&self) -> Option<T> {
        self.items.lock().unwrap().pop_front()
    }

    pub fn is_empty(&self) -> bool {
        self.items.lock().unwrap().is_empty()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::{
        Arc,
        atomic::{AtomicUsize, Ordering},
    };
    use std::thread;

    #[test]
    fn push_pop_single_item() {
        let queue: Queue<i32> = Queue::new();

        queue.push(42);
        assert!(!queue.is_empty());

        let item = queue.pop();
        assert_eq!(item, Some(42));
        assert!(queue.is_empty());
    }

    #[test]
    fn pop_empty_returns_none() {
        let queue: Queue<i32> = Queue::new();

        assert!(queue.is_empty());
        assert_eq!(queue.pop(), None);
    }

    #[test]
    fn fifo_ordering() {
        let queue: Queue<i32> = Queue::new();

        queue.push(1);
        queue.push(2);
        queue.push(3);

        assert_eq!(queue.pop(), Some(1));
        assert_eq!(queue.pop(), Some(2));
        assert_eq!(queue.pop(), Some(3));
        assert_eq!(queue.pop(), None);
    }

    #[test]
    fn multi_producer_single_consumer() {
        let queue: Arc<Queue<usize>> = Arc::new(Queue::new());
        let total_items = 1000;
        let num_producers = 4;
        let items_per_producer = total_items / num_producers;

        let mut handles = vec![];

        for producer_id in 0..num_producers {
            let queue_clone = Arc::clone(&queue);
            let handle = thread::spawn(move || {
                for i in 0..items_per_producer {
                    queue_clone.push(producer_id * items_per_producer + i);
                }
            });
            handles.push(handle);
        }

        for handle in handles {
            handle.join().unwrap();
        }

        let mut received = vec![];
        while let Some(item) = queue.pop() {
            received.push(item);
        }

        assert_eq!(received.len(), total_items);

        received.sort();
        let expected: Vec<usize> = (0..total_items).collect();
        assert_eq!(received, expected);
    }

    #[test]
    fn concurrent_push_pop() {
        let queue: Arc<Queue<usize>> = Arc::new(Queue::new());
        let total_items = 1000;
        let counter = Arc::new(AtomicUsize::new(0));

        let queue_producer = Arc::clone(&queue);
        let producer = thread::spawn(move || {
            for i in 0..total_items {
                queue_producer.push(i);
                thread::yield_now();
            }
        });

        let queue_consumer = Arc::clone(&queue);
        let counter_clone = Arc::clone(&counter);
        let consumer = thread::spawn(move || {
            let mut consumed = 0;
            while consumed < total_items {
                if queue_consumer.pop().is_some() {
                    consumed += 1;
                    counter_clone.fetch_add(1, Ordering::SeqCst);
                } else {
                    thread::yield_now();
                }
            }
        });

        producer.join().unwrap();
        consumer.join().unwrap();

        assert_eq!(counter.load(Ordering::SeqCst), total_items);
        assert!(queue.is_empty());
    }

    #[test]
    fn drop_cleans_up_items() {
        let drop_counter = Arc::new(AtomicUsize::new(0));

        struct DropTracker {
            counter: Arc<AtomicUsize>,
        }

        impl Drop for DropTracker {
            fn drop(&mut self) {
                self.counter.fetch_add(1, Ordering::SeqCst);
            }
        }

        {
            let queue: Queue<DropTracker> = Queue::new();
            for _ in 0..10 {
                queue.push(DropTracker {
                    counter: Arc::clone(&drop_counter),
                });
            }
        }

        assert_eq!(drop_counter.load(Ordering::SeqCst), 10);
    }
}

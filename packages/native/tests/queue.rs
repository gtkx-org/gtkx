use std::sync::Arc;
use std::thread;

use native::queue::Queue;

#[test]
fn new_queue_is_empty() {
    let queue: Queue<i32> = Queue::new();
    assert!(queue.is_empty());
}

#[test]
fn default_queue_is_empty() {
    let queue: Queue<i32> = Queue::default();
    assert!(queue.is_empty());
}

#[test]
fn push_makes_queue_non_empty() {
    let queue: Queue<i32> = Queue::new();
    queue.push(42);
    assert!(!queue.is_empty());
}

#[test]
fn pop_returns_pushed_item() {
    let queue: Queue<i32> = Queue::new();
    queue.push(42);
    assert_eq!(queue.pop(), Some(42));
}

#[test]
fn pop_empty_returns_none() {
    let queue: Queue<i32> = Queue::new();
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
fn queue_becomes_empty_after_all_popped() {
    let queue: Queue<i32> = Queue::new();
    queue.push(1);
    queue.push(2);
    queue.pop();
    queue.pop();
    assert!(queue.is_empty());
}

#[test]
fn works_with_strings() {
    let queue: Queue<String> = Queue::new();
    queue.push("hello".to_string());
    queue.push("world".to_string());

    assert_eq!(queue.pop(), Some("hello".to_string()));
    assert_eq!(queue.pop(), Some("world".to_string()));
}

#[test]
fn works_with_complex_types() {
    #[derive(Debug, PartialEq)]
    struct Task {
        id: u32,
        data: Vec<u8>,
    }

    let queue: Queue<Task> = Queue::new();
    queue.push(Task {
        id: 1,
        data: vec![1, 2, 3],
    });
    queue.push(Task {
        id: 2,
        data: vec![4, 5, 6],
    });

    let task1 = queue.pop().unwrap();
    assert_eq!(task1.id, 1);
    assert_eq!(task1.data, vec![1, 2, 3]);
}

#[test]
fn thread_safe_push_pop() {
    let queue = Arc::new(Queue::<i32>::new());
    let queue_clone = Arc::clone(&queue);

    let producer = thread::spawn(move || {
        for i in 0..100 {
            queue_clone.push(i);
        }
    });

    producer.join().unwrap();

    let mut count = 0;
    while queue.pop().is_some() {
        count += 1;
    }
    assert_eq!(count, 100);
}

#[test]
fn concurrent_push_from_multiple_threads() {
    let queue = Arc::new(Queue::<i32>::new());
    let mut handles = vec![];

    for t in 0..4 {
        let queue_clone = Arc::clone(&queue);
        handles.push(thread::spawn(move || {
            for i in 0..25 {
                queue_clone.push(t * 25 + i);
            }
        }));
    }

    for handle in handles {
        handle.join().unwrap();
    }

    let mut count = 0;
    while queue.pop().is_some() {
        count += 1;
    }
    assert_eq!(count, 100);
}

#[test]
fn interleaved_push_pop() {
    let queue: Queue<i32> = Queue::new();

    queue.push(1);
    assert_eq!(queue.pop(), Some(1));

    queue.push(2);
    queue.push(3);
    assert_eq!(queue.pop(), Some(2));

    queue.push(4);
    assert_eq!(queue.pop(), Some(3));
    assert_eq!(queue.pop(), Some(4));
    assert!(queue.is_empty());
}

#[test]
fn large_number_of_items() {
    let queue: Queue<i32> = Queue::new();
    let count = 10_000;

    for i in 0..count {
        queue.push(i);
    }

    for i in 0..count {
        assert_eq!(queue.pop(), Some(i));
    }

    assert!(queue.is_empty());
}

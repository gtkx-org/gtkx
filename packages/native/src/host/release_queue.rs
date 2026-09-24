use std::cell::RefCell;
use std::collections::VecDeque;
use std::sync::{Arc, Mutex};
use std::thread::{self, ThreadId};

use super::panic_handler::guard_ffi_boundary;

type Work = Box<dyn FnOnce()>;
type RemoteWork = Box<dyn FnOnce() + Send>;

#[derive(Default)]
struct LocalQueue {
    retiring: bool,
    draining: bool,
    source: Option<glib::Source>,
    pending: VecDeque<Work>,
    owner: Option<Arc<Owner>>,
}

#[derive(Default)]
struct RemoteQueue {
    closed: bool,
    source: Option<glib::Source>,
    pending: VecDeque<RemoteWork>,
}

pub(crate) struct Owner {
    thread: ThreadId,
    queue: Mutex<RemoteQueue>,
}

static CURRENT_OWNER: Mutex<Option<Arc<Owner>>> = Mutex::new(None);

thread_local! {
    static LOCAL: RefCell<LocalQueue> = RefCell::new(LocalQueue::default());
}

impl Owner {
    pub(crate) fn is_current_thread(&self) -> bool {
        self.thread == thread::current().id()
    }

    pub(crate) fn invoke(
        self: &Arc<Self>,
        context: &'static str,
        work: impl FnOnce() + Send + 'static,
    ) {
        let mut queue = self
            .queue
            .lock()
            .expect("remote release queue lock poisoned");
        if queue.closed {
            return;
        }
        queue.pending.push_back(Box::new(move || {
            guard_ffi_boundary(context, work);
        }));
        if queue
            .source
            .as_ref()
            .is_some_and(|source| !source.is_destroyed())
        {
            return;
        }
        let owner = Arc::downgrade(self);
        let source = glib::idle_source_new(Some(context), glib::Priority::DEFAULT, move || {
            if let Some(owner) = owner.upgrade()
                && owner.is_current_thread()
            {
                owner.dispatch();
            }
            glib::ControlFlow::Break
        });
        source.attach(Some(&glib::MainContext::default()));
        queue.source = Some(source);
    }

    fn dispatch(&self) {
        let pending = {
            let mut queue = self
                .queue
                .lock()
                .expect("remote release queue lock poisoned");
            queue.source.take();
            std::mem::take(&mut queue.pending)
        };
        for work in pending {
            work();
        }
    }

    fn retire(&self) {
        let (source, pending) = {
            let mut queue = self
                .queue
                .lock()
                .expect("remote release queue lock poisoned");
            queue.closed = true;
            (queue.source.take(), std::mem::take(&mut queue.pending))
        };
        if let Some(source) = source {
            source.destroy();
        }
        for work in pending {
            defer(work);
        }
    }
}

pub(crate) fn install() {
    let owner = LOCAL.with_borrow_mut(|queue| {
        if queue.retiring {
            *queue = LocalQueue::default();
        }
        Arc::clone(queue.owner.get_or_insert_with(|| {
            Arc::new(Owner {
                thread: thread::current().id(),
                queue: Mutex::new(RemoteQueue::default()),
            })
        }))
    });
    *CURRENT_OWNER
        .lock()
        .expect("current release owner lock poisoned") = Some(owner);
}

pub(crate) fn owner() -> Arc<Owner> {
    LOCAL.with_borrow(|queue| {
        Arc::clone(
            queue
                .owner
                .as_ref()
                .expect("native cleanup owner is installed"),
        )
    })
}

pub(crate) fn is_retiring() -> bool {
    LOCAL
        .try_with(|queue| queue.borrow().retiring)
        .unwrap_or(true)
}

pub(crate) fn invoke_current(context: &'static str, work: impl FnOnce() + Send + 'static) {
    let owner = CURRENT_OWNER
        .lock()
        .expect("current release owner lock poisoned")
        .clone();
    if let Some(owner) = owner {
        owner.invoke(context, work);
    }
}

pub(crate) fn defer(work: impl FnOnce() + 'static) {
    let (retiring, needs_source) = LOCAL.with_borrow_mut(|queue| {
        queue.pending.push_back(Box::new(work));
        (
            queue.retiring,
            queue.source.as_ref().is_none_or(glib::Source::is_destroyed) && !queue.draining,
        )
    });
    if retiring {
        drain();
        return;
    }
    if !needs_source {
        return;
    }
    let owner = owner();
    let source = glib::idle_source_new(
        Some("native cleanup"),
        glib::Priority::DEFAULT_IDLE,
        move || {
            if owner.is_current_thread() {
                LOCAL.with_borrow_mut(|queue| {
                    queue.source.take();
                });
                drain();
            }
            glib::ControlFlow::Break
        },
    );
    source.attach(Some(&glib::MainContext::default()));
    LOCAL.with_borrow_mut(|queue| queue.source = Some(source));
}

fn drain() {
    if LOCAL.with_borrow_mut(|queue| std::mem::replace(&mut queue.draining, true)) {
        return;
    }
    loop {
        let work = LOCAL.with_borrow_mut(|queue| queue.pending.pop_front());
        let Some(work) = work else {
            break;
        };
        guard_ffi_boundary("native cleanup", work);
    }
    LOCAL.with_borrow_mut(|queue| queue.draining = false);
}

pub(crate) fn retire() {
    let Some((source, owner)) = LOCAL.with_borrow_mut(|queue| {
        if queue.retiring {
            return None;
        }
        queue.retiring = true;
        queue.draining = true;
        Some((queue.source.take(), queue.owner.clone()))
    }) else {
        return;
    };
    if let Some(source) = source {
        source.destroy();
    }
    if let Some(owner) = owner {
        let mut current = CURRENT_OWNER
            .lock()
            .expect("current release owner lock poisoned");
        if current
            .as_ref()
            .is_some_and(|current| Arc::ptr_eq(current, &owner))
        {
            current.take();
        }
        drop(current);
        owner.retire();
    }
    crate::ffi::closure::retire_callbacks();
    LOCAL.with_borrow_mut(|queue| queue.draining = false);
    drain();
}

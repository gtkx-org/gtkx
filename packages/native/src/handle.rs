mod boxed;
mod fundamental;
pub(crate) mod wrapper;

pub use boxed::{Boxed, BoxedFreeFn};
pub use fundamental::{Fundamental, RefFn, UnrefFn};

use std::ffi::c_void;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};

use glib::thread_guard::ThreadGuard;

use crate::messaging::Mailbox;

pub struct Handle {
    ptr: usize,
    size_hint: usize,
    owned_value: Option<ThreadGuard<Value>>,
    pending_gobject_ref: Option<Arc<AtomicBool>>,
}

impl std::fmt::Debug for Handle {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Handle")
            .field("ptr", &(self.ptr as *const c_void))
            .field("owned", &self.owned_value.is_some())
            .finish_non_exhaustive()
    }
}

impl From<Value> for Handle {
    fn from(value: Value) -> Self {
        let ptr = value.as_ptr() as usize;
        let size_hint = value.size_hint();
        Self {
            ptr,
            size_hint,
            owned_value: Some(ThreadGuard::new(value)),
            pending_gobject_ref: None,
        }
    }
}

impl Clone for Handle {
    fn clone(&self) -> Self {
        Self {
            ptr: self.ptr,
            size_hint: self.size_hint,
            owned_value: self
                .owned_value
                .as_ref()
                .map(|guard| ThreadGuard::new(guard.get_ref().clone())),
            pending_gobject_ref: self.pending_gobject_ref.clone(),
        }
    }
}

impl Handle {
    pub fn from_glib_borrow(ptr: *mut c_void) -> Self {
        Self {
            ptr: ptr as usize,
            size_hint: 0,
            owned_value: None,
            pending_gobject_ref: None,
        }
    }

    pub fn decoded_gobject(ptr: *mut c_void) -> Self {
        Self {
            ptr: ptr as usize,
            size_hint: GOBJECT_SIZE_HINT,
            owned_value: None,
            pending_gobject_ref: Some(Arc::new(AtomicBool::new(true))),
        }
    }

    pub fn take_pending_gobject_ref(&self) -> bool {
        self.pending_gobject_ref
            .as_ref()
            .is_some_and(|flag| flag.swap(false, Ordering::AcqRel))
    }

    pub fn as_ptr(&self) -> *mut c_void {
        self.ptr as *mut c_void
    }

    pub fn ptr_as_usize(&self) -> usize {
        self.ptr
    }
}

impl Drop for Handle {
    fn drop(&mut self) {
        if let Some(flag) = self.pending_gobject_ref.take()
            && Arc::strong_count(&flag) == 1
            && flag.swap(false, Ordering::AcqRel)
            && !Mailbox::global().is_not_running()
        {
            let gobject_ptr = self.ptr;
            glib::idle_add_once(move || unsafe {
                glib::gobject_ffi::g_object_unref(gobject_ptr as *mut glib::gobject_ffi::GObject);
            });
        }

        let Some(guard) = self.owned_value.take() else {
            return;
        };
        if guard.is_owner() {
            drop(guard);
        } else if Mailbox::global().is_not_running() {
            std::mem::forget(guard);
        } else {
            glib::idle_add_once(move || drop(guard));
        }
    }
}

#[derive(Debug, Clone)]
pub enum Value {
    Boxed(Boxed),
    Fundamental(Fundamental),
}

const GOBJECT_SIZE_HINT: usize = 512;

impl Value {
    pub fn as_ptr(&self) -> *mut c_void {
        match self {
            Self::Boxed(boxed) => boxed.as_ptr(),
            Self::Fundamental(fundamental) => fundamental.as_ptr(),
        }
    }

    pub fn size_hint(&self) -> usize {
        match self {
            Self::Boxed(_) => Boxed::SIZE_HINT,
            Self::Fundamental(_) => Fundamental::SIZE_HINT,
        }
    }
}

impl Handle {
    pub fn size_hint(&self) -> usize {
        self.size_hint
    }
}

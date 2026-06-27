mod boxed;
mod fundamental;
pub(crate) mod wrapper_registry;

pub use boxed::Boxed;
pub use fundamental::{Fundamental, RefFn, UnrefFn};

use std::ffi::c_void;
use std::mem::ManuallyDrop;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};

use glib::thread_guard::ThreadGuard;

use crate::messaging::Mailbox;

enum AnchoredValue {
    ThreadBound(ThreadGuard<Value>),
    Transferable(TransferableValue),
}

struct TransferableValue(ManuallyDrop<Value>);

// SAFETY: `TransferableValue` is only constructed in `AnchoredValue::new` when the runtime is
// initialized and the current thread is NOT the gtkx-glib main-context owner, i.e. the wrapped
// `Value` was created off the GLib thread and has never been bound to it. The value is moved
// (never shared) to the gtkx-glib thread for its eventual drop, so transferring sole ownership
// across the thread boundary touches the underlying GObject/boxed pointers only on the GLib thread.
#[allow(clippy::non_send_fields_in_send_ty)]
unsafe impl Send for TransferableValue {}

impl TransferableValue {
    #[cfg_attr(coverage_nightly, coverage(off))]
    fn get_ref(&self) -> &Value {
        &self.0
    }
}

impl Drop for TransferableValue {
    #[cfg_attr(coverage_nightly, coverage(off))]
    fn drop(&mut self) {
        // SAFETY: `self.0` was initialized via `ManuallyDrop::new` in the constructor and is never
        // taken out elsewhere, so this is the unique drop of the wrapped `Value`; it runs
        // exactly once when the `TransferableValue` is dropped.
        unsafe { ManuallyDrop::drop(&mut self.0) };
    }
}

impl AnchoredValue {
    #[cfg_attr(coverage_nightly, coverage(off))]
    fn new(value: Value) -> Self {
        let on_foreign_thread =
            Mailbox::global().is_initialized() && !glib::MainContext::default().is_owner();
        if on_foreign_thread {
            Self::Transferable(TransferableValue(ManuallyDrop::new(value)))
        } else {
            Self::ThreadBound(ThreadGuard::new(value))
        }
    }

    #[cfg_attr(coverage_nightly, coverage(off))]
    fn get_ref(&self) -> &Value {
        match self {
            Self::ThreadBound(guard) => guard.get_ref(),
            Self::Transferable(value) => value.get_ref(),
        }
    }

    #[cfg_attr(coverage_nightly, coverage(off))]
    fn droppable_here(&self) -> bool {
        match self {
            Self::ThreadBound(guard) => guard.is_owner(),
            Self::Transferable(_) => glib::MainContext::default().is_owner(),
        }
    }
}

pub struct Handle {
    ptr: usize,
    size_hint: usize,
    owned_value: Option<AnchoredValue>,
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
            owned_value: Some(AnchoredValue::new(value)),
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
                .map(|anchored| AnchoredValue::new(anchored.get_ref().clone())),
            pending_gobject_ref: self.pending_gobject_ref.clone(),
        }
    }
}

impl Handle {
    #[must_use]
    pub fn borrowed(ptr: *mut c_void) -> Self {
        Self {
            ptr: ptr as usize,
            size_hint: 0,
            owned_value: None,
            pending_gobject_ref: None,
        }
    }

    #[must_use]
    pub fn borrowed_gobject(ptr: *mut c_void) -> Self {
        Self {
            ptr: ptr as usize,
            size_hint: GOBJECT_SIZE_HINT,
            owned_value: None,
            pending_gobject_ref: None,
        }
    }

    #[must_use]
    pub fn decoded_gobject(ptr: *mut c_void) -> Self {
        Self {
            ptr: ptr as usize,
            size_hint: GOBJECT_SIZE_HINT,
            owned_value: None,
            pending_gobject_ref: Some(Arc::new(AtomicBool::new(true))),
        }
    }

    #[must_use]
    pub fn take_pending_gobject_ref(&self) -> bool {
        self.pending_gobject_ref
            .as_ref()
            .is_some_and(|flag| flag.swap(false, Ordering::AcqRel))
    }

    #[must_use]
    pub fn ptr(&self) -> *mut c_void {
        self.ptr as *mut c_void
    }

    #[must_use]
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
            let gobject_addr = self.ptr;
            glib::idle_add_once(move || {
                // SAFETY: the closure runs on the gtkx-glib thread (via `idle_add_once`). The
                // pending-gobject-ref flag was the sole remaining owner (strong count 1) and was
                // atomically claimed above, so this releases exactly the one reference taken when
                // the decoded GObject handle was created, on the thread that owns the object.
                unsafe {
                    glib::gobject_ffi::g_object_unref(
                        gobject_addr as *mut glib::gobject_ffi::GObject,
                    );
                }
            });
        }

        let Some(anchored) = self.owned_value.take() else {
            return;
        };
        if anchored.droppable_here() {
            drop(anchored);
        } else if Mailbox::global().is_not_running() {
            std::mem::forget(anchored);
        } else {
            glib::idle_add_once(move || drop(anchored));
        }
    }
}

#[derive(Debug, Clone)]
pub enum Value {
    Boxed(Boxed),
    Fundamental(Fundamental),
}

impl From<Value> for crate::ffi::value::Value {
    fn from(value: Value) -> Self {
        Self::Object(value.into())
    }
}

impl From<Boxed> for crate::ffi::value::Value {
    fn from(boxed: Boxed) -> Self {
        Value::Boxed(boxed).into()
    }
}

impl From<Fundamental> for crate::ffi::value::Value {
    fn from(fundamental: Fundamental) -> Self {
        Value::Fundamental(fundamental).into()
    }
}

const GOBJECT_SIZE_HINT: usize = 512;

impl Value {
    #[must_use]
    pub fn as_ptr(&self) -> *mut c_void {
        match self {
            Self::Boxed(boxed) => boxed.as_ptr(),
            Self::Fundamental(fundamental) => fundamental.as_ptr(),
        }
    }

    #[must_use]
    pub fn size_hint(&self) -> usize {
        match self {
            Self::Boxed(_) => Boxed::SIZE_HINT,
            Self::Fundamental(_) => Fundamental::SIZE_HINT,
        }
    }
}

impl Handle {
    #[must_use]
    pub fn size_hint(&self) -> usize {
        self.size_hint
    }
}

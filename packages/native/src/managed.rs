mod boxed;
mod fundamental;

pub use boxed::Boxed;
pub use fundamental::{Fundamental, RefFn, UnrefFn};

use std::ffi::c_void;
use std::mem::ManuallyDrop;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};

use glib::thread_guard::ThreadGuard;

use crate::dispatch::Mailbox;

enum AnchoredValue {
    ThreadBound(ThreadGuard<NativeValue>),
    Transferable(TransferableValue),
}

struct TransferableValue(ManuallyDrop<NativeValue>);

// SAFETY: `TransferableValue` is only constructed in `AnchoredValue::new` when the runtime is
// initialized and the current thread is NOT the gtkx-glib main-context owner, i.e. the wrapped
// `NativeValue` was created off the GLib thread and has never been bound to it. The value is moved
// (never shared) to the gtkx-glib thread for its eventual drop, so transferring sole ownership
// across the thread boundary touches the underlying GObject/boxed pointers only on the GLib thread.
#[allow(clippy::non_send_fields_in_send_ty)]
unsafe impl Send for TransferableValue {}

impl TransferableValue {
    #[cfg_attr(coverage_nightly, coverage(off))]
    fn get_ref(&self) -> &NativeValue {
        &self.0
    }
}

impl Drop for TransferableValue {
    #[cfg_attr(coverage_nightly, coverage(off))]
    fn drop(&mut self) {
        // SAFETY: `self.0` was initialized via `ManuallyDrop::new` in the constructor and is never
        // taken out elsewhere, so this is the unique drop of the wrapped `NativeValue`; it runs
        // exactly once when the `TransferableValue` is dropped.
        unsafe { ManuallyDrop::drop(&mut self.0) };
    }
}

impl AnchoredValue {
    #[cfg_attr(coverage_nightly, coverage(off))]
    fn new(value: NativeValue) -> Self {
        let on_foreign_thread =
            Mailbox::global().is_initialized() && !glib::MainContext::default().is_owner();
        if on_foreign_thread {
            Self::Transferable(TransferableValue(ManuallyDrop::new(value)))
        } else {
            Self::ThreadBound(ThreadGuard::new(value))
        }
    }

    #[cfg_attr(coverage_nightly, coverage(off))]
    fn get_ref(&self) -> &NativeValue {
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

pub struct NativeHandle {
    ptr: usize,
    size_hint: usize,
    inner: Option<AnchoredValue>,
    pending_gobject_ref: Option<Arc<AtomicBool>>,
}

impl std::fmt::Debug for NativeHandle {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("NativeHandle")
            .field("ptr", &(self.ptr as *const c_void))
            .field("owned", &self.inner.is_some())
            .finish_non_exhaustive()
    }
}

impl From<NativeValue> for NativeHandle {
    fn from(value: NativeValue) -> Self {
        let ptr = value.as_ptr() as usize;
        let size_hint = value.size_hint();
        Self {
            ptr,
            size_hint,
            inner: Some(AnchoredValue::new(value)),
            pending_gobject_ref: None,
        }
    }
}

impl Clone for NativeHandle {
    fn clone(&self) -> Self {
        Self {
            ptr: self.ptr,
            size_hint: self.size_hint,
            inner: self
                .inner
                .as_ref()
                .map(|anchored| AnchoredValue::new(anchored.get_ref().clone())),
            pending_gobject_ref: self.pending_gobject_ref.clone(),
        }
    }
}

impl NativeHandle {
    #[must_use]
    pub fn borrowed(ptr: *mut c_void) -> Self {
        Self {
            ptr: ptr as usize,
            size_hint: 0,
            inner: None,
            pending_gobject_ref: None,
        }
    }

    #[must_use]
    pub fn borrowed_gobject(ptr: *mut c_void) -> Self {
        Self {
            ptr: ptr as usize,
            size_hint: GOBJECT_SIZE_HINT,
            inner: None,
            pending_gobject_ref: None,
        }
    }

    #[must_use]
    pub fn decoded_gobject(ptr: *mut c_void) -> Self {
        Self {
            ptr: ptr as usize,
            size_hint: GOBJECT_SIZE_HINT,
            inner: None,
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

impl Drop for NativeHandle {
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

        let Some(wrapper) = self.inner.take() else {
            return;
        };
        if wrapper.droppable_here() {
            drop(wrapper);
        } else if Mailbox::global().is_not_running() {
            std::mem::forget(wrapper);
        } else {
            glib::idle_add_once(move || drop(wrapper));
        }
    }
}

#[derive(Debug, Clone)]
pub enum NativeValue {
    Boxed(Boxed),
    Fundamental(Fundamental),
}

const GOBJECT_SIZE_HINT: usize = 512;

impl NativeValue {
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

impl NativeHandle {
    #[must_use]
    pub fn size_hint(&self) -> usize {
        self.size_hint
    }
}

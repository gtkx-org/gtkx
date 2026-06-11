//! Managed object wrappers and reference tracking.
//!
//! This module provides owned wrappers for Boxed and Fundamental instances that
//! cross the FFI boundary. Each owned [`NativeHandle`] holds its underlying
//! [`NativeValue`] directly via [`glib::thread_guard::ThreadGuard`], so the
//! JavaScript-facing handle and the native value share one allocation.
//! `GObject` instances are not owned here: they cross as non-owning
//! [`NativeHandle::borrowed_gobject`] handles and their lifetime is governed by
//! a toggle reference (see [`crate::toggle_ref`]).
//!
//! ## Key Types
//!
//! - [`NativeValue`]: Enum wrapping a Boxed or Fundamental instance
//! - [`NativeHandle`]: Handle returned to JavaScript via [`napi::bindgen_prelude::External`],
//!   either owning a [`NativeValue`] or borrowing a raw pointer
//! - [`Boxed`]: `GObject` boxed type wrapper with copy/free semantics
//! - [`Fundamental`]: `GLib` fundamental type wrapper with ref/unref semantics
//!
//! ## Lifecycle (owned handles)
//!
//! 1. Native code creates a [`NativeValue`] on the `GLib` thread.
//! 2. [`NativeValue`] is wrapped in [`NativeHandle`] via `From`, capturing the
//!    pointer address and storing the value in a
//!    [`glib::thread_guard::ThreadGuard`] anchored to the `GLib` thread.
//! 3. [`NativeHandle`] is wrapped in `napi::bindgen_prelude::External` and returned to JavaScript.
//! 4. When JS garbage collects the external value, napi-rs calls the
//!    [`NativeHandle`]'s [`Drop`] impl, which routes the drop back to the
//!    `GLib` thread via `glib::idle_add_once`.
//! 5. On the `GLib` thread, the underlying boxed copy or fundamental unref is
//!    released.
//!
//! At shutdown ([`Mailbox::is_stopped`]) the handle's value is intentionally
//! leaked via [`std::mem::forget`] to avoid post-shutdown teardown crashes.

mod boxed;
mod fundamental;

pub use boxed::Boxed;
pub use fundamental::{Fundamental, RefFn, UnrefFn};

use std::ffi::c_void;
use std::mem::ManuallyDrop;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};

use gtk4::glib;
use gtk4::glib::thread_guard::ThreadGuard;

use crate::dispatch::Mailbox;

/// Anchor for an owned [`NativeValue`], chosen by the thread that decodes it.
///
/// A value decoded on the `GLib` thread (every FFI call result, and the test
/// process where no runtime exists) is thread-bound: access and drop stay on
/// the creating thread, and an off-thread handle drop routes the value back
/// via a `GLib` idle source. A value decoded on a foreign native thread — a
/// callback trampoline or signal closure invoked from a library thread pool —
/// cannot be thread-bound, because its creating thread is transient and never
/// sees the value again: it is transferable, handed off once to the JS/GLib
/// side, where the dispatch architecture serializes all further access.
enum AnchoredValue {
    ThreadBound(ThreadGuard<NativeValue>),
    Transferable(TransferableValue),
}

/// An owned [`NativeValue`] decoded on a foreign thread.
struct TransferableValue(ManuallyDrop<NativeValue>);

// SAFETY: The decoding thread moves the value into a JS-bound handle and
// never touches it again (single crossing), every subsequent access is
// serialized by the dispatch architecture (one JS thread, one GLib thread,
// drops routed through GLib idle sources), and the payload's release
// operations (g_boxed_free, g_free, fundamental unref functions) are
// thread-safe C calls.
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
        // SAFETY: Dropped exactly once, here.
        unsafe { ManuallyDrop::drop(&mut self.0) };
    }
}

/// The transferable arms require a running JS runtime plus a foreign native
/// thread, which a `cargo test` process has no way to stand up, so the anchor
/// selection and its per-variant accessors are excluded from coverage
/// instrumentation.
impl AnchoredValue {
    #[cfg_attr(coverage_nightly, coverage(off))]
    fn new(value: NativeValue) -> Self {
        let on_foreign_thread =
            Mailbox::global().is_started() && !glib::MainContext::default().is_owner();
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

    /// Whether the current thread may drop the value inline: the creating
    /// thread for a thread-bound value, the `GLib` thread for a transferable
    /// one.
    #[cfg_attr(coverage_nightly, coverage(off))]
    fn droppable_here(&self) -> bool {
        match self {
            Self::ThreadBound(guard) => guard.is_owner(),
            Self::Transferable(_) => glib::MainContext::default().is_owner(),
        }
    }
}

/// Owned handle for a managed native value.
///
/// Wraps either an owned [`NativeValue`] (constructed via `From<NativeValue>`)
/// or a borrowed pointer reference (constructed via [`NativeHandle::borrowed`]).
/// An owned handle is anchored through [`AnchoredValue`] and routes an
/// off-thread drop to the `GLib` thread automatically; a borrowed handle
/// carries only the pointer and is safe to clone or drop on any thread.
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
        let ptr = match &value {
            NativeValue::Boxed(boxed) => boxed.as_ptr() as usize,
            NativeValue::Fundamental(fundamental) => fundamental.as_ptr() as usize,
        };
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
    /// Clones the handle, duplicating the underlying [`NativeValue`] when owned.
    /// Clones share the pending-reference marker, so the decode protocol's one
    /// pending reference is consumed at most once across all clones.
    ///
    /// # Panics
    ///
    /// Panics if `self` carries a thread-bound owned value and the clone is
    /// performed on a thread other than the one that constructed the handle.
    /// Borrowed handles (created via [`NativeHandle::borrowed`]) carry no
    /// thread affinity and can be cloned freely.
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
    /// Constructs a non-owning handle that just carries a pointer address.
    ///
    /// Used when JavaScript already owns the underlying value via a live
    /// `napi::bindgen_prelude::External<NativeHandle>` and we only need the pointer
    /// for the duration of a single FFI call. A borrowed handle has no
    /// [`SendWrapper`] and is therefore safe to clone or drop on any thread.
    #[must_use]
    pub fn borrowed(ptr: *mut c_void) -> Self {
        Self {
            ptr: ptr as usize,
            size_hint: 0,
            inner: None,
            pending_gobject_ref: None,
        }
    }

    /// Constructs a non-owning handle for a `GObject` whose lifetime is
    /// governed by its toggle reference rather than this handle.
    ///
    /// The handle carries only the pointer — its [`Drop`] does nothing — so the
    /// object stays alive for exactly as long as its toggle ref and JavaScript
    /// wrapper do. It still reports the `GObject` external-memory hint to V8 so
    /// garbage-collection pressure stays proportional to the live wrapper count.
    #[must_use]
    pub fn borrowed_gobject(ptr: *mut c_void) -> Self {
        Self {
            ptr: ptr as usize,
            size_hint: GOBJECT_SIZE_HINT,
            inner: None,
            pending_gobject_ref: None,
        }
    }

    /// Constructs the handle the `GObject` decode protocol hands across the
    /// boundary: non-owning like [`Self::borrowed_gobject`], but marked as
    /// carrying the decode's one pending owned reference.
    ///
    /// The marker is consumed exactly once — by the wrapper install, by the
    /// existing-wrapper lookup, or by [`Drop`] when the handle never reaches
    /// JavaScript — and the consumer releases the pending reference. The
    /// pending reference pins the object across the crossing, so a concurrent
    /// wrapper teardown cannot finalize an object a handle still refers to.
    #[must_use]
    pub fn decoded_gobject(ptr: *mut c_void) -> Self {
        Self {
            ptr: ptr as usize,
            size_hint: GOBJECT_SIZE_HINT,
            inner: None,
            pending_gobject_ref: Some(Arc::new(AtomicBool::new(true))),
        }
    }

    /// Consumes the pending-reference marker, returning whether this call won
    /// the consumption. The winner owns the release (or hand-off) of the one
    /// pending `GObject` reference the decode left on the object.
    #[must_use]
    pub fn take_pending_gobject_ref(&self) -> bool {
        self.pending_gobject_ref
            .as_ref()
            .is_some_and(|flag| flag.swap(false, Ordering::AcqRel))
    }

    /// Returns the raw native pointer.
    ///
    /// The pointer is recorded at construction and is readable from any thread
    /// without engaging the [`SendWrapper`] thread check. May be null for
    /// borrowed handles wrapping a null pointer.
    #[must_use]
    pub fn ptr(&self) -> *mut c_void {
        self.ptr as *mut c_void
    }

    /// Returns the raw native pointer reinterpreted as a [`usize`].
    ///
    /// Used where the address must travel as a plain integer rather than a
    /// dereferenceable handle: the address-based field reads and writes in
    /// `module::field`, the numeric marshalling of pointer-valued arguments in
    /// `types::numeric`, and the property and `GType` lookups in
    /// `module::gobject` that capture an instance address to resolve on the
    /// `GLib` thread.
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
            && !Mailbox::global().is_stopped()
        {
            let gobject_addr = self.ptr;
            // SAFETY: The swapped flag held the one pending decode
            // reference, which pins the GObject until this idle source
            // releases it on the GLib thread.
            glib::idle_add_once(move || unsafe {
                glib::gobject_ffi::g_object_unref(gobject_addr as *mut glib::gobject_ffi::GObject);
            });
        }

        let Some(wrapper) = self.inner.take() else {
            return;
        };
        if wrapper.droppable_here() {
            drop(wrapper);
        } else if Mailbox::global().is_stopped() {
            std::mem::forget(wrapper);
        } else {
            glib::idle_add_once(move || drop(wrapper));
        }
    }
}

/// Managed value wrapper for owned FFI objects.
///
/// `GObject` instances are not represented here: their lifetime is governed by
/// a toggle reference (see [`crate::toggle_ref`]), and they cross the boundary
/// as non-owning [`NativeHandle::borrowed_gobject`] handles. `Boxed` and
/// `Fundamental` use custom wrappers because they require type-specific
/// lifecycle management:
/// - `Boxed`: Uses `g_boxed_copy`/`g_boxed_free` for GType-registered types,
///   or `g_malloc0`/`g_free` for plain structs without `GType`
/// - `Fundamental`: Uses custom ref/unref functions that must be looked up dynamically
#[derive(Debug, Clone)]
pub enum NativeValue {
    Boxed(Boxed),
    Fundamental(Fundamental),
}

/// Rough byte hint reported to V8 for each variant. The exact size of the
/// underlying `GLib` allocation is generally unknowable to us, but pressuring
/// the GC proportional to handle count is enough to keep ephemeral wrappers
/// (e.g. per-frame `PangoLayoutIter`s) from accumulating between collections.
const GOBJECT_SIZE_HINT: usize = 512;
const BOXED_SIZE_HINT: usize = 256;
const FUNDAMENTAL_SIZE_HINT: usize = 128;

impl NativeValue {
    /// Approximate external-memory size reported to V8 when this value is
    /// exposed as an `External`. Reversed on finalize.
    #[must_use]
    pub fn size_hint(&self) -> usize {
        match self {
            Self::Boxed(_) => BOXED_SIZE_HINT,
            Self::Fundamental(_) => FUNDAMENTAL_SIZE_HINT,
        }
    }
}

impl NativeHandle {
    /// Approximate external-memory size for this handle. Borrowed handles
    /// carry no native allocation of their own and report zero. The value is
    /// cached at construction so it can be read from any thread without
    /// engaging the [`SendWrapper`] thread check.
    #[must_use]
    pub fn size_hint(&self) -> usize {
        self.size_hint
    }
}

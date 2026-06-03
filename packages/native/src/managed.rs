//! Managed object wrappers and reference tracking.
//!
//! This module provides owned wrappers for Boxed and Fundamental instances that
//! cross the FFI boundary. Each owned [`NativeHandle`] holds its underlying
//! [`NativeValue`] directly via [`SendWrapper`], so the JavaScript-facing handle
//! and the native value share one allocation. `GObject` instances are not owned
//! here: they cross as non-owning [`NativeHandle::borrowed_gobject`] handles and
//! their lifetime is governed by a toggle reference (see [`crate::toggle_ref`]).
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
//!    pointer address and storing the value in a [`SendWrapper`] anchored to the
//!    `GLib` thread.
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

use gtk4::glib;
use send_wrapper::SendWrapper;

use crate::dispatch::Mailbox;

/// Owned handle for a managed native value.
///
/// Wraps either an owned [`NativeValue`] (constructed via `From<NativeValue>`)
/// or a borrowed pointer reference (constructed via [`NativeHandle::borrowed`]).
/// An owned handle is anchored to the `GLib` thread via [`SendWrapper`] and routes
/// its drop back to that thread automatically; a borrowed handle carries only
/// the pointer and is safe to clone or drop on any thread.
pub struct NativeHandle {
    ptr: usize,
    size_hint: usize,
    inner: Option<SendWrapper<NativeValue>>,
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
            inner: Some(SendWrapper::new(value)),
        }
    }
}

impl Clone for NativeHandle {
    /// Clones the handle, duplicating the underlying [`NativeValue`] when owned.
    ///
    /// # Panics
    ///
    /// Panics if `self` carries an owned value and the clone is performed on a
    /// thread other than the one that constructed the handle. Borrowed handles
    /// (created via [`NativeHandle::borrowed`]) carry no thread affinity and
    /// can be cloned freely.
    fn clone(&self) -> Self {
        Self {
            ptr: self.ptr,
            size_hint: self.size_hint,
            inner: self.inner.clone(),
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
        }
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
    /// Used by the JS-facing `getNativeId` to expose the pointer value as an
    /// object-identity token.
    #[must_use]
    pub fn ptr_as_usize(&self) -> usize {
        self.ptr
    }
}

impl Drop for NativeHandle {
    fn drop(&mut self) {
        let Some(wrapper) = self.inner.take() else {
            return;
        };
        if wrapper.valid() {
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

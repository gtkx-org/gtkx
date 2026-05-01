//! Managed object wrappers and reference tracking.
//!
//! This module provides wrappers for `GObject`, Boxed, and Fundamental instances
//! that need to cross the FFI boundary. Each [`NativeHandle`] owns its underlying
//! [`NativeValue`] directly via [`SendWrapper`], so the JavaScript-facing handle
//! and the native value share one allocation.
//!
//! ## Key Types
//!
//! - [`NativeValue`]: Enum wrapping `GObject`, Boxed, or Fundamental instances
//! - [`NativeHandle`]: Owned handle returned to JavaScript, implements [`Finalize`]
//! - [`Boxed`]: `GObject` boxed type wrapper with copy/free semantics
//! - [`Fundamental`]: `GLib` fundamental type wrapper with ref/unref semantics
//!
//! ## Lifecycle
//!
//! 1. Native code creates a [`NativeValue`] on the `GLib` thread.
//! 2. [`NativeValue`] is wrapped in [`NativeHandle`] via `From`, capturing the
//!    raw pointer and storing the value in a [`SendWrapper`] anchored to the
//!    `GLib` thread.
//! 3. [`NativeHandle`] is moved into a `JsBox` and returned to JavaScript.
//! 4. When JS garbage collects the box, [`Finalize::finalize`] takes ownership
//!    of the handle and routes its drop back to the `GLib` thread.
//! 5. The handle's [`Drop`] runs on the `GLib` thread, releasing the underlying
//!    `GObject` ref / boxed copy / fundamental unref.
//!
//! At shutdown ([`Mailbox::is_stopped`]) the handle's value is intentionally
//! leaked via [`std::mem::forget`] to avoid post-shutdown teardown crashes,
//! mirroring the previous `ManuallyDrop`-based handle map.

mod boxed;
mod fundamental;

pub use boxed::Boxed;
pub use fundamental::{Fundamental, RefFn, UnrefFn};

use std::ffi::c_void;

use gtk4::glib::{self, prelude::ObjectType as _};
use neon::prelude::*;
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
    ptr: *mut c_void,
    inner: Option<SendWrapper<NativeValue>>,
}

// SAFETY: `ptr` is treated as an opaque integer for cross-thread identity
// comparison; it is never dereferenced off the GLib thread. `inner` is either
// `None` (no thread affinity) or a `SendWrapper` whose runtime check enforces
// origin-thread access for the underlying [`NativeValue`].
unsafe impl Send for NativeHandle {}
// SAFETY: same justification as `Send` — shared references expose only the
// opaque `ptr` value and the `SendWrapper`'s own thread-checked accessors.
unsafe impl Sync for NativeHandle {}

impl std::fmt::Debug for NativeHandle {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("NativeHandle")
            .field("ptr", &self.ptr)
            .field("owned", &self.inner.is_some())
            .finish()
    }
}

impl From<NativeValue> for NativeHandle {
    fn from(value: NativeValue) -> Self {
        let ptr = match &value {
            NativeValue::GObject(obj) => obj.as_ptr() as *mut c_void,
            NativeValue::Boxed(boxed) => boxed.as_ptr(),
            NativeValue::Fundamental(fundamental) => fundamental.as_ptr(),
        };
        Self {
            ptr,
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
            inner: self.inner.clone(),
        }
    }
}

impl NativeHandle {
    /// Constructs a non-owning handle that just carries a raw pointer.
    ///
    /// Used when JavaScript already owns the underlying value via a live
    /// `JsBox<NativeHandle>` and we only need the pointer for the duration of
    /// a single FFI call. A borrowed handle has no [`SendWrapper`] and is
    /// therefore safe to clone or drop on any thread.
    #[must_use]
    pub fn borrowed(ptr: *mut c_void) -> Self {
        Self { ptr, inner: None }
    }

    /// Returns the raw native pointer.
    ///
    /// The pointer is recorded at construction and is readable from any thread
    /// without engaging the [`SendWrapper`] thread check. May be null for
    /// borrowed handles wrapping a null pointer.
    #[must_use]
    pub fn ptr(&self) -> *mut c_void {
        self.ptr
    }

    /// Returns the raw native pointer reinterpreted as a [`usize`].
    ///
    /// Used by the JS-facing `getNativeId` to expose the pointer value as an
    /// object-identity token.
    #[must_use]
    pub fn ptr_as_usize(&self) -> usize {
        self.ptr as usize
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

impl Finalize for NativeHandle {
    /// No-op: routing is handled by the custom [`Drop`] impl, which schedules
    /// off-origin drops back to the `GLib` thread and leaks via
    /// [`std::mem::forget`] when the mailbox is stopped.
    fn finalize<'a, C: Context<'a>>(self, _cx: &mut C) {}
}

/// Managed value wrapper for FFI objects.
///
/// `GObject` uses `glib::Object` directly since it already has built-in reference counting
/// via `g_object_ref`/`g_object_unref` that the Rust bindings handle automatically.
///
/// `Boxed` and `Fundamental` use custom wrappers because they require type-specific
/// lifecycle management:
/// - `Boxed`: Uses `g_boxed_copy`/`g_boxed_free` for GType-registered types,
///   or `g_malloc0`/`g_free` for plain structs without `GType`
/// - `Fundamental`: Uses custom ref/unref functions that must be looked up dynamically
#[derive(Debug, Clone)]
pub enum NativeValue {
    GObject(glib::Object),
    Boxed(Boxed),
    Fundamental(Fundamental),
}

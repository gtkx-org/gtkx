//! Managed object wrappers and reference tracking.
//!
//! This module provides wrappers for GObject, Boxed, and Fundamental instances
//! that need to cross the FFI boundary. Objects are stored in a thread-local map
//! and automatically cleaned up when their JavaScript handles are garbage collected.
//!
//! ## Key Types
//!
//! - [`NativeValue`]: Enum wrapping GObject, Boxed, or Fundamental instances
//! - [`NativeHandle`]: Newtype handle returned to JavaScript, implements [`Finalize`]
//! - [`Boxed`]: GObject boxed type wrapper with copy/free semantics
//! - [`Fundamental`]: GLib fundamental type wrapper with ref/unref semantics
//!
//! ## Lifecycle
//!
//! 1. Native code creates a value and wraps it in [`NativeValue`]
//! 2. [`NativeValue`] is converted to [`NativeHandle`] via `From`
//! 3. [`NativeHandle`] is returned to JavaScript as a boxed value
//! 4. When JS garbage collects the handle, [`Finalize::finalize`] schedules removal
//! 5. The GTK thread removes the object from the map, dropping the Rust wrapper
//!
//! This ensures proper reference counting for GObjects and proper freeing for Boxed types.

mod boxed;
mod fundamental;
mod owned_ptr;

pub use boxed::Boxed;
pub use fundamental::{Fundamental, RefFn, UnrefFn};
pub(crate) use owned_ptr::OwnedPtr;

use std::ffi::c_void;

use gtk4::glib::{self, object::ObjectType as _};
use neon::prelude::*;

use crate::{gtk_dispatch, state::GtkThreadState};

#[derive(Debug, Clone, Copy)]
pub struct NativeHandle(pub(crate) usize);

impl From<NativeValue> for NativeHandle {
    fn from(object: NativeValue) -> Self {
        GtkThreadState::with(|state| {
            let key = state.next_handle_id;
            state.next_handle_id = state.next_handle_id.wrapping_add(1);
            state.handle_map.insert(key, object);
            NativeHandle(key)
        })
    }
}

impl NativeHandle {
    #[must_use]
    pub fn get_ptr(&self) -> Option<*mut c_void> {
        GtkThreadState::with(|state| {
            state.handle_map.get(&self.0).map(|object| match object {
                NativeValue::GObject(obj) => obj.as_ptr() as *mut c_void,
                NativeValue::Boxed(boxed) => boxed.as_ptr(),
                NativeValue::Fundamental(fundamental) => fundamental.as_ptr(),
            })
        })
    }

    #[must_use]
    pub fn get_ptr_as_usize(&self) -> Option<usize> {
        self.get_ptr().map(|ptr| ptr as usize)
    }

    pub(crate) fn require_ptr(&self) -> anyhow::Result<*mut c_void> {
        self.get_ptr().ok_or_else(|| {
            anyhow::anyhow!("Object with handle {} has been garbage collected", self.0)
        })
    }

    pub(crate) fn require_non_null_ptr(&self) -> anyhow::Result<*mut c_void> {
        let ptr = self.require_ptr()?;
        if ptr.is_null() {
            anyhow::bail!("Object with handle {} has a null pointer", self.0);
        }
        Ok(ptr)
    }

    pub fn inner(&self) -> usize {
        self.0
    }
}

impl Finalize for NativeHandle {
    fn finalize<'a, C: Context<'a>>(self, _cx: &mut C) {
        gtk_dispatch::GtkDispatcher::global().schedule(move || {
            let removed = GtkThreadState::with(|state| state.handle_map.remove(&self.0));
            drop(removed);
        });
    }
}

/// Managed value wrapper for FFI objects.
///
/// `GObject` uses `glib::Object` directly since it already has built-in reference counting
/// via `g_object_ref`/`g_object_unref` that the Rust bindings handle automatically.
///
/// `Boxed` and `Fundamental` use custom wrappers because they require type-specific
/// lifecycle management:
/// - `Boxed`: Uses `g_boxed_copy`/`g_boxed_free` for GType-registered types,
///   or `g_malloc0`/`g_free` for plain structs without GType
/// - `Fundamental`: Uses custom ref/unref functions that must be looked up dynamically
#[derive(Debug, Clone)]
pub enum NativeValue {
    GObject(glib::Object),
    Boxed(Boxed),
    Fundamental(Fundamental),
}

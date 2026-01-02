//! Managed object wrappers and reference tracking.
//!
//! This module provides [`Object`] and [`ObjectId`] for tracking GObject, Boxed,
//! and GVariant instances across the FFI boundary. Objects are stored in a
//! thread-local map and automatically cleaned up when their JavaScript handles
//! are garbage collected.
//!
//! ## Key Types
//!
//! - [`Object`]: Enum wrapping GObject, Boxed, or GVariant instances
//! - [`ObjectId`]: Newtype handle returned to JavaScript, implements [`Finalize`]
//!
//! ## Lifecycle
//!
//! 1. Native code creates an `Object` and wraps it with [`ObjectId::new`]
//! 2. `ObjectId` is returned to JavaScript as a boxed value
//! 3. When JS garbage collects the handle, [`Finalize::finalize`] schedules removal
//! 4. The GTK thread removes the object from the map, dropping the Rust wrapper
//!
//! This ensures proper reference counting for GObjects and proper freeing for Boxed types.

use std::ffi::c_void;

use gtk4::glib::{self, object::ObjectType as _};
use neon::prelude::*;

use crate::{boxed::Boxed, gtk_dispatch, state::GtkThreadState, variant::GVariant};

#[derive(Debug, Clone)]
#[allow(clippy::enum_variant_names)]
pub enum Object {
    GObject(glib::Object),
    Boxed(Boxed),
    GVariant(GVariant),
    ParamSpec(glib::ParamSpec),
}

#[derive(Debug, Clone, Copy)]
pub struct ObjectId(pub usize);

impl From<Object> for ObjectId {
    fn from(object: Object) -> Self {
        GtkThreadState::with(|state| {
            let id = state.free_object_ids.pop().unwrap_or_else(|| {
                let id = state.next_object_id;
                state.next_object_id = state.next_object_id.wrapping_add(1);
                if state.next_object_id == 0 {
                    state.next_object_id = 1;
                }
                id
            });
            debug_assert!(
                !state.object_map.contains_key(&id),
                "ObjectId collision: ID {} already in use",
                id
            );
            state.object_map.insert(id, object);
            ObjectId(id)
        })
    }
}

impl ObjectId {
    pub fn as_ptr(&self) -> Option<*mut c_void> {
        GtkThreadState::with(|state| {
            state.object_map.get(&self.0).map(|object| match object {
                Object::GObject(obj) => obj.as_ptr() as *mut c_void,
                Object::Boxed(boxed) => boxed.as_ptr(),
                Object::GVariant(variant) => variant.as_ptr(),
                Object::ParamSpec(pspec) => pspec.as_ptr() as *mut c_void,
            })
        })
    }

    pub fn try_as_ptr(&self) -> Option<usize> {
        self.as_ptr().map(|ptr| ptr as usize)
    }

    pub fn require_ptr(&self) -> anyhow::Result<*mut c_void> {
        self.as_ptr()
            .ok_or_else(|| anyhow::anyhow!("Object with ID {} has been garbage collected", self.0))
    }

    pub fn require_non_null_ptr(&self) -> anyhow::Result<*mut c_void> {
        let ptr = self.require_ptr()?;
        if ptr.is_null() {
            anyhow::bail!("Object with ID {} has a null pointer", self.0);
        }
        Ok(ptr)
    }

    pub fn field_ptr(&self, offset: usize) -> anyhow::Result<*mut u8> {
        let ptr = self.require_non_null_ptr()?;
        Ok(unsafe { (ptr as *mut u8).add(offset) })
    }

    pub fn field_ptr_const(&self, offset: usize) -> anyhow::Result<*const u8> {
        let ptr = self.require_non_null_ptr()?;
        Ok(unsafe { (ptr as *const u8).add(offset) })
    }
}

impl AsRef<usize> for ObjectId {
    fn as_ref(&self) -> &usize {
        &self.0
    }
}

impl Finalize for ObjectId {
    fn finalize<'a, C: Context<'a>>(self, _cx: &mut C) {
        gtk_dispatch::schedule(move || {
            GtkThreadState::with(|state| {
                state.object_map.remove(&self.0);
                state.free_object_ids.push(self.0);
            });
        });
    }
}

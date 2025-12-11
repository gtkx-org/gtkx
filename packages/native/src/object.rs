//! Object identity and reference tracking for native GTK objects.
//!
//! This module provides the [`ObjectId`] type for tracking native objects
//! across the FFI boundary. Objects are stored in a thread-local map and
//! can be retrieved by their ID.

use std::ffi::c_void;

use gtk4::glib::{self, object::ObjectType as _};
use neon::prelude::*;

use crate::{boxed::Boxed, state::GtkThreadState};

/// A native object that can be tracked across the FFI boundary.
///
/// Wraps either a GObject instance or a boxed type (struct allocated on heap).
#[derive(Debug)]
pub enum Object {
    /// A GObject instance (reference-counted).
    GObject(glib::Object),
    /// A boxed type (copied or owned heap allocation).
    Boxed(Boxed),
}

impl Clone for Object {
    fn clone(&self) -> Self {
        match self {
            Object::GObject(obj) => Object::GObject(obj.clone()),
            Object::Boxed(boxed) => Object::Boxed(boxed.clone()),
        }
    }
}

/// A unique identifier for a native object.
///
/// ObjectIds are assigned when objects cross from native code to JavaScript.
/// The ID can be used to retrieve the underlying native pointer when making
/// FFI calls. The object is automatically removed from tracking when the
/// JavaScript wrapper is garbage collected.
#[derive(Debug, Clone, Copy)]
pub struct ObjectId(pub usize);

impl ObjectId {
    /// Creates a new ObjectId for the given object.
    ///
    /// Registers the object in the thread-local map and returns a unique ID.
    pub fn new(object: Object) -> Self {
        GtkThreadState::with(|state| {
            let id = state.next_object_id;
            state.next_object_id += 1;
            state.object_map.insert(id, object);
            ObjectId(id)
        })
    }

    /// Returns the raw pointer to this object, or `None` if garbage collected.
    pub fn as_ptr(&self) -> Option<*mut c_void> {
        GtkThreadState::with(|state| {
            state.object_map.get(&self.0).map(|object| match object {
                Object::GObject(obj) => obj.as_ptr() as *mut c_void,
                Object::Boxed(boxed) => *boxed.as_ref(),
            })
        })
    }

    /// Returns the raw pointer as a usize, or `None` if garbage collected.
    pub fn try_as_ptr(&self) -> Option<usize> {
        self.as_ptr().map(|ptr| ptr as usize)
    }
}

impl Finalize for ObjectId {
    fn finalize<'a, C: Context<'a>>(self, _cx: &mut C) {
        glib::idle_add_once(move || {
            GtkThreadState::with(|state| {
                state.object_map.remove(&self.0);
            });
        });
    }
}

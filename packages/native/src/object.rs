use std::ffi::c_void;

use gtk4::glib::{self, object::ObjectType as _};
use neon::prelude::*;

use crate::{boxed::Boxed, state::GtkThreadState};

#[derive(Debug)]
pub enum Object {
    GObject(glib::Object),
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

#[derive(Debug, Clone, Copy)]
pub struct ObjectId(pub usize);

impl ObjectId {
    pub fn new(object: Object) -> Self {
        GtkThreadState::with(|state| {
            let id = state.next_object_id;
            state.next_object_id += 1;
            state.object_map.insert(id, object);
            ObjectId(id)
        })
    }

    pub fn as_ptr(&self) -> *mut c_void {
        GtkThreadState::with(|state| {
            let object = state
                .object_map
                .get(&self.0)
                .expect("ObjectId references a non-existent object (possibly already garbage collected)");

            match object {
                Object::GObject(obj) => obj.as_ptr() as *mut c_void,
                Object::Boxed(boxed) => *boxed.as_ref(),
            }
        })
    }

    pub fn try_as_ptr(&self) -> Option<usize> {
        GtkThreadState::with(|state| {
            state.object_map.get(&self.0).map(|object| match object {
                Object::GObject(obj) => obj.as_ptr() as usize,
                Object::Boxed(boxed) => *boxed.as_ref() as usize,
            })
        })
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

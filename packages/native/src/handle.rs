mod boxed;
mod fundamental;
pub mod wrapper;

pub use boxed::{Boxed, BoxedFreeFn};
pub use fundamental::{Fundamental, RefFn, UnrefFn};

use std::cell::Cell;
use std::ffi::c_void;
use std::rc::Rc;

use glib::prelude::ObjectType as _;

const GOBJECT_SIZE_HINT: usize = 512;

pub enum Handle {
    Object {
        ptr: usize,
        owned: Rc<Cell<Option<glib::Object>>>,
    },
    Boxed(Boxed),
    Fundamental(Fundamental),
    Borrowed(usize),
}

impl std::fmt::Debug for Handle {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let (name, ptr) = match self {
            Self::Object { ptr, .. } => ("Object", *ptr),
            Self::Boxed(boxed) => ("Boxed", boxed.as_ptr() as usize),
            Self::Fundamental(fundamental) => ("Fundamental", fundamental.as_ptr() as usize),
            Self::Borrowed(ptr) => ("Borrowed", *ptr),
        };
        f.debug_struct("Handle")
            .field("kind", &name)
            .field("ptr", &(ptr as *const c_void))
            .finish_non_exhaustive()
    }
}

impl From<Boxed> for Handle {
    fn from(boxed: Boxed) -> Self {
        Self::Boxed(boxed)
    }
}

impl From<Fundamental> for Handle {
    fn from(fundamental: Fundamental) -> Self {
        Self::Fundamental(fundamental)
    }
}

impl Clone for Handle {
    fn clone(&self) -> Self {
        match self {
            Self::Object { ptr, owned } => Self::Object {
                ptr: *ptr,
                owned: Rc::clone(owned),
            },
            Self::Boxed(boxed) => Self::Boxed(boxed.clone()),
            Self::Fundamental(fundamental) => Self::Fundamental(fundamental.clone()),
            Self::Borrowed(ptr) => Self::Borrowed(*ptr),
        }
    }
}

impl Handle {
    pub fn from_glib_borrow(ptr: *mut c_void) -> Self {
        Self::Borrowed(ptr as usize)
    }

    pub fn decoded_gobject(object: glib::Object) -> Self {
        let ptr = object.as_ptr() as usize;
        Self::Object {
            ptr,
            owned: Rc::new(Cell::new(Some(object))),
        }
    }

    pub fn take_owned(&self) -> Option<glib::Object> {
        match self {
            Self::Object { owned, .. } => owned.take(),
            _ => None,
        }
    }

    pub fn as_ptr(&self) -> *mut c_void {
        self.ptr_as_usize() as *mut c_void
    }

    pub fn ptr_as_usize(&self) -> usize {
        match self {
            Self::Object { ptr, .. } | Self::Borrowed(ptr) => *ptr,
            Self::Boxed(boxed) => boxed.as_ptr() as usize,
            Self::Fundamental(fundamental) => fundamental.as_ptr() as usize,
        }
    }

    pub fn size_hint(&self) -> usize {
        match self {
            Self::Object { .. } => GOBJECT_SIZE_HINT,
            Self::Boxed(_) => Boxed::SIZE_HINT,
            Self::Fundamental(_) => Fundamental::SIZE_HINT,
            Self::Borrowed(_) => 0,
        }
    }
}

impl Drop for Handle {
    fn drop(&mut self) {
        let Self::Object { owned, .. } = self else {
            return;
        };
        if Rc::strong_count(owned) == 1
            && let Some(object) = owned.take()
        {
            glib::idle_add_local_once(move || drop(object));
        }
    }
}

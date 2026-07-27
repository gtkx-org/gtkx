mod boxed;
mod fundamental;

pub use boxed::{Boxed, BoxedFreeFn};
pub use fundamental::{Fundamental, RefFn, UnrefFn};

use std::cell::{Cell, RefCell};
use std::ffi::c_void;

use glib::prelude::ObjectType as _;

const GOBJECT_SIZE_HINT: usize = 512;
const STRUCT_SIZE_HINT: usize = 256;

#[derive(Default)]
pub struct FieldStore {
    allocations: RefCell<Vec<(usize, *mut c_void)>>,
}

impl std::fmt::Debug for FieldStore {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("FieldStore")
            .field("len", &self.allocations.borrow().len())
            .finish()
    }
}

impl FieldStore {
    /// # Safety
    ///
    /// `ptr` must be null or a `GLib`-allocated block whose ownership the caller transfers to this
    /// store, which `g_free`s it when it is displaced by a later write to the same `offset` or when
    /// the store is dropped. The block must not be reachable from anything else that frees it.
    pub unsafe fn adopt(&self, offset: usize, ptr: *mut c_void) {
        let mut allocations = self.allocations.borrow_mut();
        let Some(entry) = allocations.iter_mut().find(|(at, _)| *at == offset) else {
            allocations.push((offset, ptr));
            return;
        };
        let previous = std::mem::replace(&mut entry.1, ptr);
        drop(allocations);
        if !previous.is_null() {
            unsafe { glib::ffi::g_free(previous) };
        }
    }
}

impl Drop for FieldStore {
    fn drop(&mut self) {
        for (_, ptr) in self.allocations.get_mut().drain(..) {
            if !ptr.is_null() {
                unsafe { glib::ffi::g_free(ptr) };
            }
        }
    }
}

pub enum Handle {
    Object {
        ptr: *mut c_void,
        owned: Cell<Option<glib::Object>>,
    },
    Boxed(Boxed),
    Fundamental(Fundamental),
    Struct {
        ptr: *mut c_void,
        fields: FieldStore,
    },
    Borrowed(*mut c_void),
}

impl std::fmt::Debug for Handle {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let name = match self {
            Self::Object { .. } => "Object",
            Self::Boxed(_) => "Boxed",
            Self::Fundamental(_) => "Fundamental",
            Self::Struct { .. } => "Struct",
            Self::Borrowed(_) => "Borrowed",
        };
        f.debug_struct("Handle")
            .field("kind", &name)
            .field("ptr", &self.as_ptr())
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

impl Handle {
    pub fn from_glib_borrow(ptr: *mut c_void) -> Self {
        Self::Borrowed(ptr)
    }

    #[must_use]
    pub fn owned_struct(ptr: *mut c_void) -> Self {
        Self::Struct {
            ptr,
            fields: FieldStore::default(),
        }
    }

    #[must_use]
    pub fn field_store(&self) -> Option<&FieldStore> {
        match self {
            Self::Struct { fields, .. } => Some(fields),
            _ => None,
        }
    }

    #[must_use]
    pub fn decoded_gobject(object: glib::Object) -> Self {
        let ptr = object.as_ptr().cast::<c_void>();
        Self::Object {
            ptr,
            owned: Cell::new(Some(object)),
        }
    }

    pub fn take_owned(&self) -> Option<glib::Object> {
        match self {
            Self::Object { owned, .. } => owned.take(),
            _ => None,
        }
    }

    pub fn as_ptr(&self) -> *mut c_void {
        match self {
            Self::Object { ptr, .. } | Self::Struct { ptr, .. } | Self::Borrowed(ptr) => *ptr,
            Self::Boxed(boxed) => boxed.as_ptr(),
            Self::Fundamental(fundamental) => fundamental.as_ptr(),
        }
    }

    pub fn ptr_as_usize(&self) -> usize {
        self.as_ptr() as usize
    }

    pub fn size_hint(&self) -> usize {
        match self {
            Self::Object { .. } => GOBJECT_SIZE_HINT,
            Self::Boxed(_) => Boxed::SIZE_HINT,
            Self::Fundamental(_) => Fundamental::SIZE_HINT,
            Self::Struct { .. } => STRUCT_SIZE_HINT,
            Self::Borrowed(_) => 0,
        }
    }
}

impl Drop for Handle {
    fn drop(&mut self) {
        match self {
            Self::Object { owned, .. } => {
                if let Some(object) = owned.take() {
                    glib::idle_add_local_once(move || drop(object));
                }
            }
            Self::Struct { ptr, .. } => unsafe { glib::ffi::g_free(*ptr) },
            _ => {}
        }
    }
}

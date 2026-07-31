mod boxed;
mod fundamental;

use std::cell::{Cell, RefCell};
use std::ffi::c_void;

pub use boxed::{Boxed, BoxedFreeFn};
pub use fundamental::{Fundamental, RefFn, UnrefFn};
use glib::prelude::ObjectType as _;

use crate::ffi::PendingTransfer;

const GOBJECT_SIZE_HINT: usize = 512;
const STRUCT_SIZE_HINT: usize = 256;

#[derive(Default)]
pub struct FieldStore {
    allocations: RefCell<Vec<(usize, PendingTransfer)>>,
}

impl std::fmt::Debug for FieldStore {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("FieldStore")
            .field("len", &self.allocations.borrow().len())
            .finish()
    }
}

impl FieldStore {
    pub fn adopt(&self, offset: usize, transfer: PendingTransfer) {
        let mut allocations = self.allocations.borrow_mut();
        let Some(entry) = allocations.iter_mut().find(|(at, _)| *at == offset) else {
            allocations.push((offset, transfer));
            return;
        };
        let previous = std::mem::replace(&mut entry.1, transfer);
        drop(allocations);
        previous.release_now();
    }
}

impl Drop for FieldStore {
    fn drop(&mut self) {
        for (_, transfer) in self.allocations.get_mut().drain(..) {
            transfer.release_now();
        }
    }
}

enum HandleKind {
    Object {
        ptr: *mut c_void,
        owned: Cell<Option<glib::Object>>,
    },
    Boxed(Boxed),
    Fundamental(Fundamental),
    Struct(*mut c_void),
    Borrowed(*mut c_void),
}

pub struct Handle {
    kind: HandleKind,
    fields: FieldStore,
}

impl std::fmt::Debug for Handle {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let name = match self.kind {
            HandleKind::Object { .. } => "Object",
            HandleKind::Boxed(_) => "Boxed",
            HandleKind::Fundamental(_) => "Fundamental",
            HandleKind::Struct(_) => "Struct",
            HandleKind::Borrowed(_) => "Borrowed",
        };
        f.debug_struct("Handle")
            .field("kind", &name)
            .field("ptr", &self.as_ptr())
            .field("fields", &self.fields)
            .finish_non_exhaustive()
    }
}

impl From<HandleKind> for Handle {
    fn from(kind: HandleKind) -> Self {
        Self {
            kind,
            fields: FieldStore::default(),
        }
    }
}

impl From<Boxed> for Handle {
    fn from(boxed: Boxed) -> Self {
        HandleKind::Boxed(boxed).into()
    }
}

impl From<Fundamental> for Handle {
    fn from(fundamental: Fundamental) -> Self {
        HandleKind::Fundamental(fundamental).into()
    }
}

impl Handle {
    pub fn from_glib_borrow(ptr: *mut c_void) -> Self {
        HandleKind::Borrowed(ptr).into()
    }

    #[must_use]
    pub fn owned_struct(ptr: *mut c_void) -> Self {
        HandleKind::Struct(ptr).into()
    }

    #[must_use]
    pub fn field_store(&self) -> Option<&FieldStore> {
        matches!(self.kind, HandleKind::Struct(_)).then_some(&self.fields)
    }

    #[must_use]
    pub fn decoded_gobject(object: glib::Object) -> Self {
        let ptr = object.as_ptr().cast::<c_void>();
        HandleKind::Object {
            ptr,
            owned: Cell::new(Some(object)),
        }
        .into()
    }

    #[must_use]
    pub fn as_gobject_ptr(&self) -> Option<*mut glib::gobject_ffi::GObject> {
        let HandleKind::Object { ptr, .. } = self.kind else {
            return None;
        };

        (!ptr.is_null()).then(|| ptr.cast::<glib::gobject_ffi::GObject>())
    }

    pub fn take_owned(&self) -> Option<glib::Object> {
        match &self.kind {
            HandleKind::Object { owned, .. } => owned.take(),
            _ => None,
        }
    }

    pub fn as_ptr(&self) -> *mut c_void {
        match &self.kind {
            HandleKind::Object { ptr, .. }
            | HandleKind::Struct(ptr)
            | HandleKind::Borrowed(ptr) => *ptr,
            HandleKind::Boxed(boxed) => boxed.as_ptr(),
            HandleKind::Fundamental(fundamental) => fundamental.as_ptr(),
        }
    }

    pub fn ptr_as_usize(&self) -> usize {
        self.as_ptr() as usize
    }

    pub fn size_hint(&self) -> usize {
        match self.kind {
            HandleKind::Object { .. } => GOBJECT_SIZE_HINT,
            HandleKind::Boxed(_) => Boxed::SIZE_HINT,
            HandleKind::Fundamental(_) => Fundamental::SIZE_HINT,
            HandleKind::Struct(_) => STRUCT_SIZE_HINT,
            HandleKind::Borrowed(_) => 0,
        }
    }
}

impl Drop for HandleKind {
    fn drop(&mut self) {
        match self {
            Self::Object { owned, .. } => {
                if let Some(object) = owned.take() {
                    glib::idle_add_local_once(move || drop(object));
                }
            }
            Self::Struct(ptr) => unsafe { glib::ffi::g_free(*ptr) },
            _ => {}
        }
    }
}

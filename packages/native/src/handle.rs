mod boxed;
mod fundamental;
pub(crate) mod surface;

use std::cell::{Cell, RefCell};
use std::ffi::c_void;
use std::rc::Rc;

pub use boxed::{Boxed, BoxedFreeFn};
pub use fundamental::{Fundamental, RefFn, UnrefFn};
use glib::prelude::ObjectType as _;

use crate::ffi::PendingTransfer;

const GOBJECT_SIZE_HINT: usize = 512;
const STRUCT_SIZE_HINT: usize = 256;

pub const INVALIDATED_HANDLE: &str = "the instance a dispose or finalize override receives is only valid until the override returns, and memory a C caller lends to a callback only until that callback returns";

pub const NULL_HANDLE: &str =
    "the handle points at nothing, so there is no memory to reach through it";

thread_local! {
    static OPEN_BORROW_SCOPES: RefCell<Vec<Rc<RefCell<Vec<Handle>>>>> =
        const { RefCell::new(Vec::new()) };
}

/// Collects every handle built over memory somebody else owns while the scope is open, so a caller
/// that lends memory for the length of a single call can end all of those borrows at once when the
/// call returns. Scopes nest, and a handle joins the innermost one.
pub struct BorrowScope {
    borrows: Rc<RefCell<Vec<Handle>>>,
}

impl BorrowScope {
    #[must_use]
    pub fn open() -> Self {
        let scope = Self {
            borrows: Rc::new(RefCell::new(Vec::new())),
        };

        OPEN_BORROW_SCOPES.with_borrow_mut(|scopes| scopes.push(Rc::clone(&scope.borrows)));

        scope
    }

    /// Stops collecting and hands back the borrows taken while the scope was open, for the caller
    /// to invalidate once the memory behind them is gone.
    #[must_use]
    pub fn close(self) -> Vec<Handle> {
        self.borrows.take()
    }
}

impl Drop for BorrowScope {
    fn drop(&mut self) {
        OPEN_BORROW_SCOPES
            .with_borrow_mut(|scopes| scopes.retain(|open| !Rc::ptr_eq(open, &self.borrows)));
    }
}

fn record_borrow(handle: &Handle) {
    OPEN_BORROW_SCOPES.with_borrow(|scopes| {
        if let Some(scope) = scopes.last() {
            scope.borrow_mut().push(handle.clone());
        }
    });
}

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
        ptr: Cell<*mut c_void>,
        owned: Cell<Option<glib::Object>>,
    },
    Boxed(Boxed),
    Fundamental(Fundamental),
    Struct(*mut c_void),
    Borrowed(*mut c_void),
    Field {
        owner: Handle,
        offset: usize,
    },
}

struct HandleInner {
    kind: HandleKind,
    fields: FieldStore,
    invalidated: Cell<bool>,
}

/// A shared reference to one native instance. Cloning shares the same instance, so a value that
/// lives inside another one, such as a struct field read in place, can hold its owner alive for as
/// long as JavaScript can still reach the field.
#[derive(Clone)]
pub struct Handle {
    inner: Rc<HandleInner>,
}

impl std::fmt::Debug for Handle {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let name = match self.inner.kind {
            HandleKind::Object { .. } => "Object",
            HandleKind::Boxed(_) => "Boxed",
            HandleKind::Fundamental(_) => "Fundamental",
            HandleKind::Struct(_) => "Struct",
            HandleKind::Borrowed(_) => "Borrowed",
            HandleKind::Field { .. } => "Field",
        };
        f.debug_struct("Handle")
            .field("kind", &name)
            .field("ptr", &self.as_ptr())
            .field("fields", &self.inner.fields)
            .finish_non_exhaustive()
    }
}

impl From<HandleKind> for Handle {
    fn from(kind: HandleKind) -> Self {
        Self {
            inner: Rc::new(HandleInner {
                kind,
                fields: FieldStore::default(),
                invalidated: Cell::new(false),
            }),
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
    /// A handle over memory that belongs to whoever handed the pointer over. Built inside a
    /// [`BorrowScope`], it joins that scope, so the borrow ends when the scope's owner says so.
    pub fn from_glib_borrow(ptr: *mut c_void) -> Self {
        let handle: Self = HandleKind::Borrowed(ptr).into();

        record_borrow(&handle);

        handle
    }

    #[must_use]
    pub fn owned_struct(ptr: *mut c_void) -> Self {
        HandleKind::Struct(ptr).into()
    }

    /// A handle over the `offset` bytes into `owner`, aliasing the owner's memory instead of
    /// copying it, and holding the owner alive for as long as the field handle exists.
    #[must_use]
    pub fn field(owner: &Self, offset: usize) -> Self {
        HandleKind::Field {
            owner: owner.clone(),
            offset,
        }
        .into()
    }

    /// The store that adopts allocations written into this handle's fields, paired with the byte
    /// offset this handle sits at inside it.
    #[must_use]
    pub fn field_store(&self) -> Option<(&FieldStore, usize)> {
        match &self.inner.kind {
            HandleKind::Struct(_) => Some((&self.inner.fields, 0)),
            HandleKind::Field { owner, offset } => {
                let (store, base) = owner.field_store()?;

                Some((store, base + offset))
            }
            _ => None,
        }
    }

    #[must_use]
    pub fn decoded_gobject(object: glib::Object) -> Self {
        let ptr = object.as_ptr().cast::<c_void>();
        HandleKind::Object {
            ptr: Cell::new(ptr),
            owned: Cell::new(Some(object)),
        }
        .into()
    }

    /// A handle over a `GObject` that owns no reference to it, for a pointer the caller only keeps
    /// alive for the duration of one call, such as the instance a class vtable slot receives while
    /// `GObject` is tearing it down and taking a reference is no longer allowed. Built inside a
    /// [`BorrowScope`], it joins that scope, so nothing reaches the instance once the call returns.
    #[must_use]
    pub fn borrowed_gobject(gobject_ptr: *mut glib::gobject_ffi::GObject) -> Self {
        let handle: Self = HandleKind::Object {
            ptr: Cell::new(gobject_ptr.cast::<c_void>()),
            owned: Cell::new(None),
        }
        .into();

        record_borrow(&handle);

        handle
    }

    /// Ends the handle's reference to its instance, so every later read or write through it, and
    /// through any field aliasing it, is rejected instead of touching memory whose validity has
    /// run out. Call it on every handle a [`BorrowScope`] hands back once the lender takes its
    /// memory away.
    pub fn invalidate(&self) {
        self.inner.invalidated.set(true);

        if let HandleKind::Object { ptr, .. } = &self.inner.kind {
            ptr.set(std::ptr::null_mut());
        }
    }

    #[must_use]
    pub fn is_invalidated(&self) -> bool {
        if self.inner.invalidated.get() {
            return true;
        }

        match &self.inner.kind {
            HandleKind::Object { ptr, .. } => ptr.get().is_null(),
            HandleKind::Field { owner, .. } => owner.is_invalidated(),
            _ => false,
        }
    }

    #[must_use]
    pub fn as_gobject_ptr(&self) -> Option<*mut glib::gobject_ffi::GObject> {
        let HandleKind::Object { ptr, .. } = &self.inner.kind else {
            return None;
        };

        let ptr = ptr.get();

        (!ptr.is_null()).then(|| ptr.cast::<glib::gobject_ffi::GObject>())
    }

    /// The pointer a fundamental handle references, or `None` once its borrow has ended. An
    /// invalidated handle keeps the pointer it was built over, so the check is what stops a reader
    /// from reaching memory a C caller only lent for the length of one invocation.
    #[must_use]
    pub fn as_fundamental_ptr(&self) -> Option<*mut c_void> {
        if self.is_invalidated() {
            return None;
        }

        let HandleKind::Fundamental(fundamental) = &self.inner.kind else {
            return None;
        };

        let ptr = fundamental.as_ptr();

        (!ptr.is_null()).then_some(ptr)
    }

    /// The pointer a fundamental handle references when the handle holds its own reference to the
    /// instance, or `None` for a handle that merely borrows one. Only an owned pointer names the
    /// same instance for the handle's whole lifetime, which is what makes it usable as an identity
    /// key.
    #[must_use]
    pub fn as_owned_fundamental_ptr(&self) -> Option<*mut c_void> {
        if self.is_invalidated() {
            return None;
        }

        let HandleKind::Fundamental(fundamental) = &self.inner.kind else {
            return None;
        };

        if !fundamental.is_owned() {
            return None;
        }

        let ptr = fundamental.as_ptr();

        (!ptr.is_null()).then_some(ptr)
    }

    /// Hands the owned reference over to the caller, which becomes responsible for releasing it.
    #[must_use]
    pub fn take_owned(&self) -> Option<glib::Object> {
        match &self.inner.kind {
            HandleKind::Object { owned, .. } => owned.take(),
            _ => None,
        }
    }

    /// Releases the reference the handle owns, for a caller that wants the handle to stop holding
    /// its instance alive rather than to take the instance over.
    pub fn release_owned(&self) {
        if let Some(object) = self.take_owned() {
            surface::release(object);
        }
    }

    #[must_use]
    pub fn as_ptr(&self) -> *mut c_void {
        if self.is_invalidated() {
            return std::ptr::null_mut();
        }

        match &self.inner.kind {
            HandleKind::Object { ptr, .. } => ptr.get(),
            HandleKind::Struct(ptr) | HandleKind::Borrowed(ptr) => *ptr,
            HandleKind::Boxed(boxed) => boxed.as_ptr(),
            HandleKind::Fundamental(fundamental) => fundamental.as_ptr(),
            HandleKind::Field { owner, offset } => {
                let owner_ptr = owner.as_ptr();

                if owner_ptr.is_null() {
                    owner_ptr
                } else {
                    owner_ptr.wrapping_byte_add(*offset)
                }
            }
        }
    }

    #[must_use]
    pub fn ptr_as_usize(&self) -> usize {
        self.as_ptr() as usize
    }

    #[must_use]
    pub fn size_hint(&self) -> usize {
        match self.inner.kind {
            HandleKind::Object { .. } => GOBJECT_SIZE_HINT,
            HandleKind::Boxed(_) => Boxed::SIZE_HINT,
            HandleKind::Fundamental(_) => Fundamental::SIZE_HINT,
            HandleKind::Struct(_) => STRUCT_SIZE_HINT,
            HandleKind::Borrowed(_) | HandleKind::Field { .. } => 0,
        }
    }
}

impl Drop for HandleKind {
    fn drop(&mut self) {
        match self {
            Self::Object { owned, .. } => {
                if let Some(object) = owned.take() {
                    glib::idle_add_local_once(move || surface::release(object));
                }
            }
            Self::Struct(ptr) => unsafe { glib::ffi::g_free(*ptr) },
            _ => {}
        }
    }
}

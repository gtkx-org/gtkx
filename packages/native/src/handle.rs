mod boxed;
mod fundamental;
mod lease;
pub(crate) mod surface;

use std::cell::{Cell, RefCell};
use std::ffi::c_void;
use std::rc::Rc;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};

pub use boxed::{Boxed, BoxedFreeFn};
pub use fundamental::{Fundamental, RefFn, UnrefFn};
use glib::prelude::{ObjectExt as _, ObjectType as _};
pub(crate) use lease::LeaseScope;

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
    #[must_use]
    pub(crate) fn take(&self, offset: usize) -> Option<PendingTransfer> {
        let mut allocations = self.allocations.borrow_mut();
        let index = allocations.iter().position(|(at, _)| *at == offset)?;

        Some(allocations.swap_remove(index).1)
    }

    pub fn adopt(&self, offset: usize, transfer: PendingTransfer) {
        let mut allocations = self.allocations.borrow_mut();
        let Some(entry) = allocations.iter_mut().find(|(at, _)| *at == offset) else {
            allocations.push((offset, transfer));
            return;
        };
        let previous = std::mem::replace(&mut entry.1, transfer);
        drop(allocations);
        drop(previous);
    }
}

/// What a handle references, so a codec can reject a value of the wrong shape before its pointer
/// reaches C. `Opaque` is a handle over memory whose shape the handle does not record — a borrowed
/// pointer, or a field aliasing its owner — and matches anything.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HandleClass {
    Object,
    Boxed,
    Fundamental,
    Struct,
    Opaque,
    Function,
}

struct ObjectLifetime {
    ended: Arc<AtomicBool>,
}

impl ObjectLifetime {
    fn track(object: &glib::Object) -> Arc<AtomicBool> {
        let key = glib::Quark::from_static_str(glib::gstr!("gtkx-object-lifetime"));
        if let Some(lifetime) = unsafe { object.qdata::<Self>(key) } {
            return Arc::clone(&unsafe { lifetime.as_ref() }.ended);
        }

        let ended = Arc::new(AtomicBool::new(false));
        unsafe {
            object.set_qdata(
                key,
                Self {
                    ended: Arc::clone(&ended),
                },
            );
        }

        ended
    }
}

impl Drop for ObjectLifetime {
    fn drop(&mut self) {
        self.ended.store(true, Ordering::Release);
    }
}

enum HandleKind {
    Object {
        ptr: Cell<*mut c_void>,
        owned: Cell<Option<glib::Object>>,
        lent: bool,
        lifetime: Option<Arc<AtomicBool>>,
        weak: glib::WeakRef<glib::Object>,
        wrapper: RefCell<std::rc::Weak<crate::value::wrapper::WrapperHandle>>,
    },
    Boxed(Boxed),
    Fundamental(Fundamental),
    Struct {
        ptr: *mut c_void,
        free_fn: Option<BoxedFreeFn>,
    },
    Borrowed(*mut c_void),
    Static(*mut c_void),
    CallbackData {
        ptr: *mut c_void,
        destroy: BoxedFreeFn,
    },
    Pointer {
        ptr: *mut c_void,
        owner: Handle,
    },
    Function {
        ptr: *mut c_void,
        owner: Option<Handle>,
        once: bool,
        lent: bool,
    },
    Field {
        owner: Handle,
        offset: usize,
    },
}

struct HandleInner {
    kind: HandleKind,
    fields: FieldStore,
    invalidated: Cell<bool>,
    allocated_bytes: Cell<Option<usize>>,
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
            HandleKind::Struct { .. } => "Struct",
            HandleKind::Borrowed(_) => "Borrowed",
            HandleKind::Static(_) => "Static",
            HandleKind::CallbackData { .. } => "CallbackData",
            HandleKind::Pointer { .. } => "Pointer",
            HandleKind::Function { .. } => "Function",
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
                allocated_bytes: Cell::new(None),
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
    #[must_use]
    pub fn callback_data(ptr: *mut c_void, destroy: BoxedFreeFn) -> Self {
        HandleKind::CallbackData { ptr, destroy }.into()
    }

    #[must_use]
    pub fn function(ptr: *mut c_void, owner: Option<Handle>, once: bool, lent: bool) -> Self {
        let handle: Self = HandleKind::Function {
            ptr,
            owner,
            once,
            lent,
        }
        .into();
        if lent {
            record_borrow(&handle);
        }
        handle
    }

    #[must_use]
    pub fn pointer(ptr: *mut c_void, owner: &Handle) -> Self {
        HandleKind::Pointer {
            ptr,
            owner: owner.clone(),
        }
        .into()
    }

    pub fn function_ptr(&self) -> anyhow::Result<*mut c_void> {
        self.retain_lease()?;
        anyhow::ensure!(!self.is_invalidated(), "{INVALIDATED_HANDLE}");
        let HandleKind::Function { ptr, .. } = self.inner.kind else {
            anyhow::bail!("The handle does not reference a native function");
        };
        anyhow::ensure!(!ptr.is_null(), "{NULL_HANDLE}");
        Ok(ptr)
    }

    #[must_use]
    pub fn is_process_static(&self) -> bool {
        match &self.inner.kind {
            HandleKind::Static(_) => true,
            HandleKind::Function {
                owner,
                once: false,
                lent: false,
                ..
            } => owner.as_ref().is_none_or(Handle::is_process_static),
            HandleKind::Field { owner, .. } | HandleKind::Pointer { owner, .. } => {
                owner.is_process_static()
            }
            _ => false,
        }
    }

    pub fn retain_for_async(&self) -> anyhow::Result<Self> {
        anyhow::ensure!(!self.is_invalidated(), "{INVALIDATED_HANDLE}");
        let retained = match &self.inner.kind {
            HandleKind::Object { lent: false, .. } => Self::decoded_gobject(
                self.acquire_lease()?
                    .ok_or_else(|| anyhow::anyhow!("{INVALIDATED_HANDLE}"))?,
            ),
            HandleKind::Object { lent: true, .. }
            | HandleKind::Borrowed(_)
            | HandleKind::Function { lent: true, .. }
            | HandleKind::Function { once: true, .. } => {
                anyhow::bail!("A borrowed native handle cannot escape into an asynchronous call");
            }
            HandleKind::Fundamental(fundamental) if !fundamental.is_owned() => {
                anyhow::bail!(
                    "A borrowed fundamental handle cannot escape into an asynchronous call"
                );
            }
            HandleKind::Field { owner, offset } => {
                Self::field(&owner.retain_for_async()?, *offset, self.allocated_bytes())
            }
            HandleKind::Pointer { owner, ptr } => Self::pointer(*ptr, &owner.retain_for_async()?),
            HandleKind::Function { owner, ptr, .. } => Self::function(
                *ptr,
                owner.as_ref().map(Handle::retain_for_async).transpose()?,
                false,
                false,
            ),
            _ => self.clone(),
        };
        Ok(retained)
    }

    pub fn begin_function_call(&self) -> anyhow::Result<*mut c_void> {
        let ptr = self.function_ptr()?;
        if matches!(self.inner.kind, HandleKind::Function { once: true, .. }) {
            self.invalidate();
        }
        Ok(ptr)
    }

    /// A handle over memory that belongs to whoever handed the pointer over. Built inside a
    /// [`BorrowScope`], it joins that scope, so the borrow ends when the scope's owner says so.
    pub fn from_glib_borrow(ptr: *mut c_void) -> Self {
        let handle: Self = HandleKind::Borrowed(ptr).into();

        record_borrow(&handle);

        handle
    }

    #[must_use]
    pub fn owned_struct(ptr: *mut c_void) -> Self {
        Self::owned_struct_with_free_fn(ptr, None)
    }

    /// Owns a plain struct allocation released by `free_fn`, falling back to `g_free` when the
    /// struct declares no free function of its own.
    #[must_use]
    pub fn owned_struct_with_free_fn(ptr: *mut c_void, free_fn: Option<BoxedFreeFn>) -> Self {
        HandleKind::Struct { ptr, free_fn }.into()
    }

    /// Records how many bytes the handle's own allocation holds, which only the caller that
    /// allocated it knows. A handle over memory C returned carries no count, so a bulk operation
    /// over it cannot be bounds checked.
    #[must_use]
    pub fn with_allocated_bytes(self, bytes: usize) -> Self {
        self.inner.allocated_bytes.set(Some(bytes));

        self
    }

    #[must_use]
    pub fn allocated_bytes(&self) -> Option<usize> {
        self.inner.allocated_bytes.get()
    }

    pub(crate) fn check_range(&self, offset: usize, size: usize) -> anyhow::Result<()> {
        let end = offset
            .checked_add(size)
            .ok_or_else(|| anyhow::anyhow!("memory range exceeds the address space"))?;

        if let Some(available) = self.allocated_bytes() {
            anyhow::ensure!(
                end <= available,
                "memory range {offset}..{end} exceeds the handle's {available} bytes"
            );
        }

        Ok(())
    }

    /// A handle over memory that stays alive for the rest of the process, such as a registered
    /// type's class struct. Nothing owns the memory through the handle, and no borrow scope ever
    /// ends the borrow.
    #[must_use]
    pub fn process_static(ptr: *mut c_void) -> Self {
        HandleKind::Static(ptr).into()
    }

    /// A handle over the `offset` bytes into `owner`, aliasing the owner's memory instead of
    /// copying it, and holding the owner alive for as long as the field handle exists.
    #[must_use]
    pub fn field(owner: &Self, offset: usize, size: Option<usize>) -> Self {
        let extent = size.or_else(|| owner.allocated_bytes().map(|bytes| bytes - offset));
        let handle: Self = HandleKind::Field {
            owner: owner.clone(),
            offset,
        }
        .into();

        match extent {
            Some(size) => handle.with_allocated_bytes(size),
            None => handle,
        }
    }

    /// The store that adopts allocations written into this handle's fields, paired with the byte
    /// offset this handle sits at inside it.
    #[must_use]
    pub fn field_store(&self) -> Option<(&FieldStore, usize)> {
        match &self.inner.kind {
            HandleKind::Struct { .. } => Some((&self.inner.fields, 0)),
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
        let lifetime = ObjectLifetime::track(&object);
        let weak = object.downgrade();
        HandleKind::Object {
            ptr: Cell::new(ptr),
            owned: Cell::new(Some(object)),
            lent: false,
            lifetime: Some(lifetime),
            weak,
            wrapper: RefCell::new(std::rc::Weak::new()),
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
            lent: true,
            lifetime: None,
            weak: glib::WeakRef::new(),
            wrapper: RefCell::new(std::rc::Weak::new()),
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
            HandleKind::Object { ptr, lifetime, .. } => {
                ptr.get().is_null()
                    || lifetime
                        .as_ref()
                        .is_some_and(|ended| ended.load(Ordering::Acquire))
            }
            HandleKind::Field { owner, .. } | HandleKind::Pointer { owner, .. } => {
                owner.is_invalidated()
            }
            HandleKind::Function { owner, .. } => {
                owner.as_ref().is_some_and(Handle::is_invalidated)
            }
            _ => false,
        }
    }

    /// What kind of instance the handle references, for a codec deciding whether the value it was
    /// handed is one it can marshal at all.
    #[must_use]
    pub fn class(&self) -> HandleClass {
        match &self.inner.kind {
            HandleKind::Object { .. } => HandleClass::Object,
            HandleKind::Boxed(_) => HandleClass::Boxed,
            HandleKind::Fundamental(_) => HandleClass::Fundamental,
            HandleKind::Struct { .. } => HandleClass::Struct,
            HandleKind::Borrowed(_)
            | HandleKind::Static(_)
            | HandleKind::Field { .. }
            | HandleKind::Pointer { .. }
            | HandleKind::CallbackData { .. } => HandleClass::Opaque,
            HandleKind::Function { .. } => HandleClass::Function,
        }
    }

    /// The `GType` a boxed handle was built with, or `None` for a handle that records none.
    #[must_use]
    pub fn boxed_type(&self) -> Option<glib::Type> {
        match &self.inner.kind {
            HandleKind::Boxed(boxed) => boxed.type_(),
            _ => None,
        }
    }

    /// The release function a fundamental handle holds, which names the fundamental family its
    /// instance belongs to without reading anything through the pointer.
    #[must_use]
    pub fn fundamental_unref_fn(&self) -> Option<UnrefFn> {
        match &self.inner.kind {
            HandleKind::Fundamental(fundamental) => fundamental.unref_fn(),
            _ => None,
        }
    }

    #[must_use]
    pub fn as_gobject_ptr(&self) -> Option<*mut glib::gobject_ffi::GObject> {
        if self.is_invalidated() {
            return None;
        }

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

    pub(crate) fn track_wrapper(&self, wrapper: &Rc<crate::value::wrapper::WrapperHandle>) {
        if let HandleKind::Object { wrapper: slot, .. } = &self.inner.kind {
            slot.replace(Rc::downgrade(wrapper));
        }
    }

    pub(crate) fn acquire_lease(&self) -> anyhow::Result<Option<glib::Object>> {
        anyhow::ensure!(!self.is_invalidated(), "{INVALIDATED_HANDLE}");
        match &self.inner.kind {
            HandleKind::Object { lent: true, .. } => Ok(None),
            HandleKind::Object {
                ptr,
                owned,
                weak,
                wrapper,
                ..
            } => {
                let held = owned.take();
                let acquired = held.clone();
                owned.set(held);
                if let Some(object) = acquired.or_else(|| weak.upgrade()) {
                    return Ok(Some(object));
                }
                if wrapper
                    .borrow()
                    .upgrade()
                    .is_some_and(|wrapper| wrapper.is_reachable())
                {
                    use glib::translate::FromGlibPtrNone as _;
                    return Ok(Some(unsafe {
                        glib::Object::from_glib_none(ptr.get().cast::<glib::gobject_ffi::GObject>())
                    }));
                }
                anyhow::bail!("{INVALIDATED_HANDLE}")
            }
            HandleKind::Field { owner, .. }
            | HandleKind::Pointer { owner, .. }
            | HandleKind::Function {
                owner: Some(owner), ..
            } => owner.acquire_lease(),
            _ => Ok(None),
        }
    }

    pub(crate) fn retain_lease(&self) -> anyhow::Result<()> {
        if let Some(object) = self.acquire_lease()? {
            LeaseScope::retain(object)?;
        }
        Ok(())
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
            HandleKind::Struct { ptr, .. }
            | HandleKind::Borrowed(ptr)
            | HandleKind::Static(ptr)
            | HandleKind::Pointer { ptr, .. }
            | HandleKind::Function { ptr, .. }
            | HandleKind::CallbackData { ptr, .. } => *ptr,
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
    pub fn size_hint(&self) -> usize {
        match self.inner.kind {
            HandleKind::Object { .. } => GOBJECT_SIZE_HINT,
            HandleKind::Boxed(_) => Boxed::SIZE_HINT,
            HandleKind::Fundamental(_) => Fundamental::SIZE_HINT,
            HandleKind::Struct { .. } => STRUCT_SIZE_HINT,
            HandleKind::Borrowed(_)
            | HandleKind::Static(_)
            | HandleKind::Field { .. }
            | HandleKind::Pointer { .. }
            | HandleKind::Function { .. }
            | HandleKind::CallbackData { .. } => 0,
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
            Self::CallbackData { ptr, destroy } => unsafe { destroy(*ptr) },
            Self::Struct { ptr, free_fn } => {
                if ptr.is_null() {
                    return;
                }
                unsafe {
                    match free_fn {
                        Some(free_fn) => free_fn(*ptr),
                        None => glib::ffi::g_free(*ptr),
                    }
                }
            }
            _ => {}
        }
    }
}

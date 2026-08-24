use std::cell::{Cell, RefCell};
use std::collections::HashMap;
use std::ffi::c_void;
use std::rc::{Rc, Weak as RcWeak};
use std::sync::atomic::{AtomicU8, Ordering};
use std::sync::{Arc, Mutex, OnceLock, PoisonError, Weak as ArcWeak};

use super::Handle;

pub(crate) type LeaseReleaseFn = unsafe extern "C" fn(*mut c_void, *mut c_void);
pub(crate) type LeaseGetUserDataFn =
    unsafe extern "C" fn(*mut c_void, *const c_void) -> *mut c_void;
pub(crate) type LeaseDestroyFn = unsafe extern "C" fn(*mut c_void);
pub(crate) type LeaseSetUserDataFn =
    unsafe extern "C" fn(*mut c_void, *const c_void, *mut c_void, Option<LeaseDestroyFn>) -> i32;

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub(crate) struct LeaseKind {
    shared_library: String,
    release_fn_name: String,
    get_user_data_fn_name: Option<String>,
    set_user_data_fn_name: Option<String>,
}

static LEASE_IDENTITIES: OnceLock<Mutex<HashMap<LeaseKind, ArcWeak<LeaseIdentity>>>> =
    OnceLock::new();

impl LeaseKind {
    pub(crate) fn new(
        shared_library: String,
        release_fn_name: String,
        get_user_data_fn_name: Option<String>,
        set_user_data_fn_name: Option<String>,
    ) -> anyhow::Result<Self> {
        anyhow::ensure!(!shared_library.is_empty(), "A lease needs a shared library");
        anyhow::ensure!(
            !release_fn_name.is_empty(),
            "A lease needs a release function"
        );
        match (&get_user_data_fn_name, &set_user_data_fn_name) {
            (None, None) => {}
            (Some(get), Some(set)) => {
                anyhow::ensure!(
                    !get.is_empty() && !set.is_empty(),
                    "Lease user-data function names must not be empty"
                );
            }
            _ => anyhow::bail!("A lease needs both user-data functions or neither"),
        }

        Ok(Self {
            shared_library,
            release_fn_name,
            get_user_data_fn_name,
            set_user_data_fn_name,
        })
    }

    pub(crate) fn shared_library(&self) -> &str {
        &self.shared_library
    }

    pub(crate) fn release_fn_name(&self) -> &str {
        &self.release_fn_name
    }

    pub(crate) fn get_user_data_fn_name(&self) -> Option<&str> {
        self.get_user_data_fn_name.as_deref()
    }

    pub(crate) fn set_user_data_fn_name(&self) -> Option<&str> {
        self.set_user_data_fn_name.as_deref()
    }

    pub(crate) fn identity(&self) -> Option<Arc<LeaseIdentity>> {
        self.get_user_data_fn_name.as_ref()?;
        let mut identities = LEASE_IDENTITIES
            .get_or_init(|| Mutex::new(HashMap::new()))
            .lock()
            .unwrap_or_else(PoisonError::into_inner);
        if let Some(identity) = identities.get(self).and_then(ArcWeak::upgrade) {
            return Some(identity);
        }

        let identity = Arc::new(LeaseIdentity { key: Box::new(0) });
        identities.insert(self.clone(), Arc::downgrade(&identity));
        Some(identity)
    }
}

pub(crate) struct LeaseIdentity {
    key: Box<usize>,
}

impl LeaseIdentity {
    fn key_ptr(&self) -> *const c_void {
        std::ptr::from_ref(self.key.as_ref()).cast()
    }
}

#[repr(u8)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum LeaseComponentState {
    Available,
    OwnerActive,
    ResultActive,
    Ended,
}

struct LeaseComponent {
    identity: Arc<LeaseIdentity>,
    state: AtomicU8,
}

impl LeaseComponent {
    fn new(identity: Arc<LeaseIdentity>) -> Self {
        Self {
            identity,
            state: AtomicU8::new(LeaseComponentState::Available as u8),
        }
    }

    fn state(&self) -> LeaseComponentState {
        match self.state.load(Ordering::Acquire) {
            value if value == LeaseComponentState::Available as u8 => {
                LeaseComponentState::Available
            }
            value if value == LeaseComponentState::OwnerActive as u8 => {
                LeaseComponentState::OwnerActive
            }
            value if value == LeaseComponentState::ResultActive as u8 => {
                LeaseComponentState::ResultActive
            }
            value if value == LeaseComponentState::Ended as u8 => LeaseComponentState::Ended,
            _ => unreachable!("lease component states are only written by LeaseComponent"),
        }
    }

    fn ensure_available(&self) -> anyhow::Result<()> {
        anyhow::ensure!(
            self.state() == LeaseComponentState::Available,
            "The value's lease component is not available"
        );
        Ok(())
    }

    fn ensure_accessible(&self) -> anyhow::Result<()> {
        match self.state() {
            LeaseComponentState::Available | LeaseComponentState::ResultActive => Ok(()),
            LeaseComponentState::OwnerActive => {
                anyhow::bail!("The lease owner cannot be used while leased")
            }
            LeaseComponentState::Ended => {
                anyhow::bail!("The value belongs to an ended lease result")
            }
        }
    }

    fn activate(&self, state: LeaseComponentState) -> anyhow::Result<()> {
        anyhow::ensure!(
            matches!(
                state,
                LeaseComponentState::OwnerActive | LeaseComponentState::ResultActive
            ),
            "A lease component can only be activated as an owner or result"
        );
        self.state
            .compare_exchange(
                LeaseComponentState::Available as u8,
                state as u8,
                Ordering::AcqRel,
                Ordering::Acquire,
            )
            .map_err(|_| anyhow::anyhow!("The value's lease component is not available"))?;
        Ok(())
    }

    fn make_available(&self) {
        self.state
            .store(LeaseComponentState::Available as u8, Ordering::Release);
    }

    fn end(&self) {
        self.state
            .store(LeaseComponentState::Ended as u8, Ordering::Release);
    }
}

struct LeaseMembership {
    component: Arc<LeaseComponent>,
}

unsafe extern "C" fn destroy_lease_membership(data: *mut c_void) {
    if !data.is_null() {
        drop(unsafe { Box::from_raw(data.cast::<LeaseMembership>()) });
    }
}

#[derive(Clone)]
pub(crate) struct LeaseIdentityApi {
    identity: Arc<LeaseIdentity>,
    get_user_data: LeaseGetUserDataFn,
    set_user_data: LeaseSetUserDataFn,
}

impl LeaseIdentityApi {
    pub(crate) fn new(
        identity: Arc<LeaseIdentity>,
        get_user_data: LeaseGetUserDataFn,
        set_user_data: LeaseSetUserDataFn,
    ) -> Self {
        Self {
            identity,
            get_user_data,
            set_user_data,
        }
    }

    fn component(&self, ptr: *mut c_void) -> anyhow::Result<Option<Arc<LeaseComponent>>> {
        if ptr.is_null() {
            return Ok(None);
        }
        let data = unsafe { (self.get_user_data)(ptr, self.identity.key_ptr()) };
        if data.is_null() {
            return Ok(None);
        }
        let membership = unsafe { &*data.cast::<LeaseMembership>() };
        anyhow::ensure!(
            Arc::ptr_eq(&membership.component.identity, &self.identity),
            "A lease user-data slot contains a membership from another kind"
        );
        Ok(Some(Arc::clone(&membership.component)))
    }

    fn attach_component(
        &self,
        ptr: *mut c_void,
        component: &Arc<LeaseComponent>,
    ) -> anyhow::Result<()> {
        anyhow::ensure!(!ptr.is_null(), "A lease component value must not be null");
        anyhow::ensure!(
            Arc::ptr_eq(&component.identity, &self.identity),
            "A lease component belongs to another kind"
        );
        let membership = Box::new(LeaseMembership {
            component: Arc::clone(component),
        });
        let data = Box::into_raw(membership).cast::<c_void>();
        let status = unsafe {
            (self.set_user_data)(
                ptr,
                self.identity.key_ptr(),
                data,
                Some(destroy_lease_membership),
            )
        };
        if status != 0 {
            drop(unsafe { Box::from_raw(data.cast::<LeaseMembership>()) });
            anyhow::bail!("The native value rejected its lease user data")
        }
        Ok(())
    }

    fn component_or_attach(&self, ptr: *mut c_void) -> anyhow::Result<Arc<LeaseComponent>> {
        if let Some(component) = self.component(ptr)? {
            return Ok(component);
        }
        let component = Arc::new(LeaseComponent::new(Arc::clone(&self.identity)));
        self.attach_component(ptr, &component)?;
        Ok(component)
    }

    pub(crate) fn link(
        &self,
        owner_ptr: *mut c_void,
        alias_ptr: *mut c_void,
    ) -> anyhow::Result<()> {
        anyhow::ensure!(!owner_ptr.is_null(), "A lease alias owner must not be null");
        anyhow::ensure!(!alias_ptr.is_null(), "A lease alias value must not be null");
        let owner_component = self.component_or_attach(owner_ptr)?;
        if let Some(alias_component) = self.component(alias_ptr)? {
            anyhow::ensure!(
                Arc::ptr_eq(&owner_component, &alias_component),
                "The lease alias already belongs to another component"
            );
            return Ok(());
        }
        self.attach_component(alias_ptr, &owner_component)
    }
}

type RegistryKey = (LeaseKind, usize);

thread_local! {
    static ACTIVE_LEASES: RefCell<HashMap<RegistryKey, RcWeak<LeaseInner>>> =
        RefCell::new(HashMap::new());
}

struct LeaseInner {
    kind: LeaseKind,
    owner: RefCell<Option<Handle>>,
    owner_ptr: *mut c_void,
    value_ptr: *mut c_void,
    release: LeaseReleaseFn,
    owner_component: Option<Arc<LeaseComponent>>,
    value_component: Option<Arc<LeaseComponent>>,
    active: Cell<bool>,
}

#[derive(Clone)]
pub(crate) struct Lease {
    inner: Rc<LeaseInner>,
}

impl std::fmt::Debug for Lease {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Lease")
            .field("kind", &self.inner.kind)
            .field("owner_ptr", &self.owner_ptr())
            .field("value_ptr", &self.inner.value_ptr)
            .field("active", &self.is_active())
            .finish()
    }
}

impl Lease {
    fn registry_key(kind: &LeaseKind, ptr: *mut c_void) -> RegistryKey {
        (kind.clone(), ptr as usize)
    }

    fn registered_inner(kind: &LeaseKind, ptr: *mut c_void) -> Option<Rc<LeaseInner>> {
        if ptr.is_null() {
            return None;
        }

        let key = Self::registry_key(kind, ptr);
        let weak = ACTIVE_LEASES.with_borrow(|leases| leases.get(&key).cloned());
        let active = weak
            .and_then(|lease| lease.upgrade())
            .filter(|lease| lease.active.get());

        if active.is_none() {
            ACTIVE_LEASES.with_borrow_mut(|leases| {
                leases.remove(&key);
            });
        }

        active
    }

    fn register(inner: &Rc<LeaseInner>, ptr: *mut c_void) {
        let key = Self::registry_key(&inner.kind, ptr);
        ACTIVE_LEASES.with_borrow_mut(|leases| {
            leases.insert(key, Rc::downgrade(inner));
        });
    }

    fn unregister_ptr(inner: &Rc<LeaseInner>, ptr: *mut c_void) {
        let key = Self::registry_key(&inner.kind, ptr);
        ACTIVE_LEASES.with_borrow_mut(|leases| {
            let should_remove = leases
                .get(&key)
                .is_some_and(|registered| RcWeak::ptr_eq(registered, &Rc::downgrade(inner)));
            if should_remove {
                leases.remove(&key);
            }
        });
    }

    fn unregister(&self) {
        Self::unregister_ptr(&self.inner, self.owner_ptr());
        Self::unregister_ptr(&self.inner, self.inner.value_ptr);
    }

    fn finish_components(inner: &LeaseInner) {
        if let Some(component) = &inner.owner_component {
            component.make_available();
        }
        if let Some(component) = &inner.value_component {
            component.end();
        }
    }

    pub(crate) fn new(
        kind: LeaseKind,
        owner: Handle,
        value_ptr: *mut c_void,
        release: LeaseReleaseFn,
        identity: Option<&LeaseIdentityApi>,
    ) -> anyhow::Result<Self> {
        let owner_ptr = owner.as_ptr();
        anyhow::ensure!(
            !owner_ptr.is_null(),
            "A lease owner must refer to a live value"
        );
        anyhow::ensure!(!value_ptr.is_null(), "A leased value must not be null");
        anyhow::ensure!(
            Self::registered_inner(&kind, owner_ptr).is_none(),
            "The lease owner already participates in an active lease"
        );
        anyhow::ensure!(
            Self::registered_inner(&kind, value_ptr).is_none(),
            "The leased value already participates in an active lease"
        );

        let (owner_component, value_component) = if let Some(identity) = identity {
            let owner_component = identity.component_or_attach(owner_ptr)?;
            let value_component = identity.component_or_attach(value_ptr)?;
            anyhow::ensure!(
                !Arc::ptr_eq(&owner_component, &value_component),
                "A lease owner and result cannot belong to the same alias component"
            );
            owner_component.ensure_available()?;
            value_component.ensure_available()?;
            owner_component.activate(LeaseComponentState::OwnerActive)?;
            if let Err(error) = value_component.activate(LeaseComponentState::ResultActive) {
                owner_component.make_available();
                return Err(error);
            }
            (Some(owner_component), Some(value_component))
        } else {
            (None, None)
        };

        let inner = Rc::new(LeaseInner {
            kind,
            owner: RefCell::new(Some(owner)),
            owner_ptr,
            value_ptr,
            release,
            owner_component,
            value_component,
            active: Cell::new(true),
        });
        Self::register(&inner, owner_ptr);
        if value_ptr != owner_ptr {
            Self::register(&inner, value_ptr);
        }

        Ok(Self { inner })
    }

    pub(crate) fn find(kind: &LeaseKind, value_ptr: *mut c_void) -> Option<Self> {
        Self::registered_inner(kind, value_ptr).map(|inner| Self { inner })
    }

    pub(crate) fn ensure_available(
        kind: &LeaseKind,
        ptr: *mut c_void,
        identity: Option<&LeaseIdentityApi>,
    ) -> anyhow::Result<()> {
        if let Some(component) = identity.and_then(|identity| identity.component(ptr).transpose()) {
            component?.ensure_available()?;
        }
        anyhow::ensure!(
            Self::registered_inner(kind, ptr).is_none(),
            "The value participates in an active lease"
        );
        Ok(())
    }

    pub(crate) fn ensure_accessible(
        kind: &LeaseKind,
        ptr: *mut c_void,
        identity: Option<&LeaseIdentityApi>,
    ) -> anyhow::Result<()> {
        if let Some(component) = identity.and_then(|identity| identity.component(ptr).transpose()) {
            component?.ensure_accessible()?;
        }
        let owner_is_leased =
            Self::registered_inner(kind, ptr).is_some_and(|lease| lease.owner_ptr == ptr);
        anyhow::ensure!(
            !owner_is_leased,
            "The lease owner cannot be used while leased"
        );

        Ok(())
    }

    pub(crate) fn kind(&self) -> &LeaseKind {
        &self.inner.kind
    }

    pub(crate) fn owner_ptr(&self) -> *mut c_void {
        self.inner.owner_ptr
    }

    pub(crate) fn value_ptr(&self) -> *mut c_void {
        if self.is_active() {
            self.inner.value_ptr
        } else {
            std::ptr::null_mut()
        }
    }

    pub(crate) fn is_active(&self) -> bool {
        self.inner.active.get()
    }

    pub(crate) fn end(&self) {
        if self.inner.active.replace(false) {
            self.unregister();
            Self::finish_components(&self.inner);
            self.inner.owner.borrow_mut().take();
        }
    }
}

impl Drop for LeaseInner {
    fn drop(&mut self) {
        if !self.active.replace(false) {
            return;
        }

        let owner_ptr = self.owner_ptr;
        let value_ptr = self.value_ptr;
        let kind = self.kind.clone();
        ACTIVE_LEASES.with_borrow_mut(|leases| {
            leases.remove(&Lease::registry_key(&kind, owner_ptr));
            leases.remove(&Lease::registry_key(&kind, value_ptr));
        });
        Lease::finish_components(self);

        if !owner_ptr.is_null() && !value_ptr.is_null() {
            unsafe { (self.release)(owner_ptr, value_ptr) };
        }
    }
}

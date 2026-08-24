use std::cell::{Cell, RefCell};
use std::collections::{HashMap, HashSet};
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

        let identity = Arc::new(LeaseIdentity {
            kind: self.clone(),
            key: Box::new(0),
        });
        identities.insert(self.clone(), Arc::downgrade(&identity));
        Some(identity)
    }
}

pub(crate) struct LeaseIdentity {
    kind: LeaseKind,
    key: Box<usize>,
}

impl LeaseIdentity {
    fn key_ptr(&self) -> *const c_void {
        std::ptr::from_ref(self.key.as_ref()).cast()
    }
}

impl Drop for LeaseIdentity {
    fn drop(&mut self) {
        let Some(identities) = LEASE_IDENTITIES.get() else {
            return;
        };
        let mut identities = identities.lock().unwrap_or_else(PoisonError::into_inner);
        let should_remove = identities
            .get(&self.kind)
            .is_some_and(|identity| std::ptr::eq(identity.as_ptr(), std::ptr::from_ref(self)));
        if should_remove {
            identities.remove(&self.kind);
        }
    }
}

#[repr(u8)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum LeaseComponentState {
    Available,
    OwnerActive,
    ResultActive,
    Releasing,
    Ended,
}

struct LeaseComponent {
    identity: Arc<LeaseIdentity>,
    state: AtomicU8,
    memberships: Mutex<HashMap<usize, usize>>,
}

impl LeaseComponent {
    fn new(identity: Arc<LeaseIdentity>) -> Self {
        Self {
            identity,
            state: AtomicU8::new(LeaseComponentState::Available as u8),
            memberships: Mutex::new(HashMap::new()),
        }
    }

    fn register_membership(&self, ptr: *mut c_void, membership: *mut c_void) {
        self.memberships
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .insert(ptr as usize, membership as usize);
    }

    fn unregister_membership(&self, ptr: usize, membership: usize) -> bool {
        let mut memberships = self
            .memberships
            .lock()
            .unwrap_or_else(PoisonError::into_inner);
        let should_remove = memberships
            .get(&ptr)
            .is_some_and(|registered| *registered == membership);
        if should_remove {
            memberships.remove(&ptr);
        }

        should_remove
    }

    fn member_ptrs(&self) -> Vec<usize> {
        self.memberships
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .keys()
            .copied()
            .collect()
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
            value if value == LeaseComponentState::Releasing as u8 => {
                LeaseComponentState::Releasing
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
            LeaseComponentState::Releasing => {
                anyhow::bail!("The leased value cannot be used while its lease is ending")
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

    fn begin_release(&self) -> anyhow::Result<()> {
        self.state
            .compare_exchange(
                LeaseComponentState::ResultActive as u8,
                LeaseComponentState::Releasing as u8,
                Ordering::AcqRel,
                Ordering::Acquire,
            )
            .map_err(|_| anyhow::anyhow!("The lease result is not active"))?;
        Ok(())
    }

    fn begin_drop_release(&self) {
        self.state
            .store(LeaseComponentState::Releasing as u8, Ordering::Release);
    }

    fn rollback_release(&self) {
        self.state
            .store(LeaseComponentState::ResultActive as u8, Ordering::Release);
    }
}

struct LeaseMembership {
    component: Arc<LeaseComponent>,
    ptr: usize,
}

unsafe extern "C" fn destroy_lease_membership(data: *mut c_void) {
    if !data.is_null() {
        let membership = unsafe { Box::from_raw(data.cast::<LeaseMembership>()) };
        let was_current = membership
            .component
            .unregister_membership(membership.ptr, data as usize);
        if was_current
            && let Some(registration) = LeaseRegistration::find(
                &membership.component.identity.kind,
                membership.ptr as *mut c_void,
            )
        {
            registration.mark_destroying(membership.ptr);
        }
        drop(membership);
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
            ptr: ptr as usize,
        });
        let data = Box::into_raw(membership).cast::<c_void>();
        component.register_membership(ptr, data);
        let status = unsafe {
            (self.set_user_data)(
                ptr,
                self.identity.key_ptr(),
                data,
                Some(destroy_lease_membership),
            )
        };
        if status != 0 {
            component.unregister_membership(ptr as usize, data as usize);
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
        let registration = LeaseRegistration::find(&self.identity.kind, owner_ptr);
        let alias_registration = if let Some(registration) = &registration {
            registration.ensure_accessible(owner_ptr)?;
            Some(registration.register_alias(owner_ptr, alias_ptr)?)
        } else {
            None
        };
        let owner_component = self.component_or_attach(owner_ptr)?;
        if let Some(alias_component) = self.component(alias_ptr)? {
            anyhow::ensure!(
                Arc::ptr_eq(&owner_component, &alias_component),
                "The lease alias already belongs to another component"
            );
        } else {
            self.attach_component(alias_ptr, &owner_component)?;
        }
        if let Some(alias_registration) = alias_registration {
            alias_registration.commit();
        }
        Ok(())
    }
}

type RegistryKey = (LeaseKind, usize);

static LEASE_REGISTRATIONS: OnceLock<Mutex<HashMap<RegistryKey, ArcWeak<LeaseRegistration>>>> =
    OnceLock::new();

#[repr(u8)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum LeaseRegistrationState {
    Initializing,
    Active,
    Releasing,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum LeasePointerRole {
    Owner,
    Result,
    Destroying,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct LeasePointerRegistration {
    role: LeasePointerRole,
    is_pending_alias: bool,
}

struct LeaseRegistration {
    kind: LeaseKind,
    pointers: Mutex<HashMap<usize, LeasePointerRegistration>>,
    state: AtomicU8,
}

struct LeaseAliasRegistration {
    registration: Arc<LeaseRegistration>,
    ptr: usize,
    should_rollback_pointer: bool,
    should_rollback_registry: bool,
}

impl LeaseAliasRegistration {
    fn commit(mut self) {
        self.registration.commit_alias(self.ptr);
        self.should_rollback_pointer = false;
        self.should_rollback_registry = false;
    }
}

impl Drop for LeaseAliasRegistration {
    fn drop(&mut self) {
        if self.should_rollback_pointer || self.should_rollback_registry {
            self.registration.rollback_alias(
                self.ptr,
                self.should_rollback_pointer,
                self.should_rollback_registry,
            );
        }
    }
}

impl LeaseRegistration {
    fn registry() -> &'static Mutex<HashMap<RegistryKey, ArcWeak<Self>>> {
        LEASE_REGISTRATIONS.get_or_init(|| Mutex::new(HashMap::new()))
    }

    fn reserve(
        kind: &LeaseKind,
        owner_ptr: *mut c_void,
        value_ptr: *mut c_void,
    ) -> anyhow::Result<Arc<Self>> {
        let owner_key = Lease::registry_key(kind, owner_ptr);
        let value_key = Lease::registry_key(kind, value_ptr);
        let mut registrations = Self::registry()
            .lock()
            .unwrap_or_else(PoisonError::into_inner);

        for key in [&owner_key, &value_key] {
            if registrations.get(key).and_then(ArcWeak::upgrade).is_some() {
                anyhow::bail!("The value participates in an active lease")
            }
            registrations.remove(key);
        }

        let registration = Arc::new(Self {
            kind: kind.clone(),
            pointers: Mutex::new(HashMap::from([
                (
                    owner_ptr as usize,
                    LeasePointerRegistration {
                        role: LeasePointerRole::Owner,
                        is_pending_alias: false,
                    },
                ),
                (
                    value_ptr as usize,
                    LeasePointerRegistration {
                        role: LeasePointerRole::Result,
                        is_pending_alias: false,
                    },
                ),
            ])),
            state: AtomicU8::new(LeaseRegistrationState::Initializing as u8),
        });
        registrations.insert(owner_key, Arc::downgrade(&registration));
        registrations.insert(value_key, Arc::downgrade(&registration));

        Ok(registration)
    }

    fn find(kind: &LeaseKind, ptr: *mut c_void) -> Option<Arc<Self>> {
        if ptr.is_null() {
            return None;
        }

        let key = Lease::registry_key(kind, ptr);
        let mut registrations = Self::registry()
            .lock()
            .unwrap_or_else(PoisonError::into_inner);
        let registration = registrations.get(&key).and_then(ArcWeak::upgrade);
        if registration.is_none() {
            registrations.remove(&key);
        }

        registration
    }

    fn state(&self) -> LeaseRegistrationState {
        match self.state.load(Ordering::Acquire) {
            value if value == LeaseRegistrationState::Initializing as u8 => {
                LeaseRegistrationState::Initializing
            }
            value if value == LeaseRegistrationState::Active as u8 => {
                LeaseRegistrationState::Active
            }
            value if value == LeaseRegistrationState::Releasing as u8 => {
                LeaseRegistrationState::Releasing
            }
            _ => unreachable!("lease registration states are only written by LeaseRegistration"),
        }
    }

    fn activate(&self) {
        self.state
            .store(LeaseRegistrationState::Active as u8, Ordering::Release);
    }

    fn begin_release(&self) -> anyhow::Result<()> {
        let _registrations = Self::registry()
            .lock()
            .unwrap_or_else(PoisonError::into_inner);
        self.state
            .compare_exchange(
                LeaseRegistrationState::Active as u8,
                LeaseRegistrationState::Releasing as u8,
                Ordering::AcqRel,
                Ordering::Acquire,
            )
            .map_err(|_| anyhow::anyhow!("The lease is already ending"))?;
        Ok(())
    }

    fn begin_drop_release(&self) {
        let _registrations = Self::registry()
            .lock()
            .unwrap_or_else(PoisonError::into_inner);
        self.state
            .store(LeaseRegistrationState::Releasing as u8, Ordering::Release);
    }

    fn rollback_release(&self) {
        let _registrations = Self::registry()
            .lock()
            .unwrap_or_else(PoisonError::into_inner);
        self.state
            .store(LeaseRegistrationState::Active as u8, Ordering::Release);
    }

    fn register_initial_ptrs(
        self: &Arc<Self>,
        role: LeasePointerRole,
        pointers: impl IntoIterator<Item = usize>,
    ) -> anyhow::Result<()> {
        anyhow::ensure!(
            self.state() == LeaseRegistrationState::Initializing,
            "A lease can only register its initial aliases while initializing"
        );
        self.register_ptrs(role, pointers)
    }

    fn register_alias(
        self: &Arc<Self>,
        owner_ptr: *mut c_void,
        alias_ptr: *mut c_void,
    ) -> anyhow::Result<LeaseAliasRegistration> {
        anyhow::ensure!(!alias_ptr.is_null(), "A lease alias value must not be null");
        let mut registrations = Self::registry()
            .lock()
            .unwrap_or_else(PoisonError::into_inner);
        anyhow::ensure!(
            self.state() == LeaseRegistrationState::Active,
            "A lease alias cannot be linked while its lease is ending"
        );
        let role = self
            .pointers
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .get(&(owner_ptr as usize))
            .copied()
            .ok_or_else(|| anyhow::anyhow!("A lease alias owner is not registered"))?;
        anyhow::ensure!(
            role.role == LeasePointerRole::Result,
            "Only an active lease result can gain another alias"
        );
        let ptr = alias_ptr as usize;
        let key = (self.kind.clone(), ptr);
        let was_registered =
            if let Some(existing) = registrations.get(&key).and_then(ArcWeak::upgrade) {
                anyhow::ensure!(
                    Arc::ptr_eq(&existing, self),
                    "A lease alias participates in another active lease"
                );
                true
            } else {
                false
            };

        let mut registered_ptrs = self.pointers.lock().unwrap_or_else(PoisonError::into_inner);
        let existing = registered_ptrs.get(&ptr).copied();
        if let Some(existing) = existing {
            anyhow::ensure!(
                existing.role == role.role,
                "A lease alias cannot belong to both lease components"
            );
        } else {
            registered_ptrs.insert(
                ptr,
                LeasePointerRegistration {
                    role: role.role,
                    is_pending_alias: true,
                },
            );
        }
        registrations.insert(key, Arc::downgrade(self));

        Ok(LeaseAliasRegistration {
            registration: Arc::clone(self),
            ptr,
            should_rollback_pointer: existing.is_none(),
            should_rollback_registry: !was_registered,
        })
    }

    fn commit_alias(&self, ptr: usize) {
        if let Some(registration) = self
            .pointers
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .get_mut(&ptr)
        {
            registration.is_pending_alias = false;
        }
    }

    fn rollback_alias(
        &self,
        ptr: usize,
        should_remove_pointer: bool,
        should_remove_registry: bool,
    ) {
        let mut registrations = Self::registry()
            .lock()
            .unwrap_or_else(PoisonError::into_inner);
        let mut registered_ptrs = self.pointers.lock().unwrap_or_else(PoisonError::into_inner);
        let did_remove_pointer = should_remove_pointer
            && registered_ptrs
                .get(&ptr)
                .is_some_and(|registration| registration.is_pending_alias);
        if did_remove_pointer {
            registered_ptrs.remove(&ptr);
        }
        if !should_remove_registry || (should_remove_pointer && !did_remove_pointer) {
            return;
        }
        let key = (self.kind.clone(), ptr);
        let should_remove = registrations
            .get(&key)
            .is_some_and(|registered| std::ptr::eq(registered.as_ptr(), std::ptr::from_ref(self)));
        if should_remove {
            registrations.remove(&key);
        }
    }

    fn register_ptrs(
        self: &Arc<Self>,
        role: LeasePointerRole,
        pointers: impl IntoIterator<Item = usize>,
    ) -> anyhow::Result<()> {
        let mut registrations = Self::registry()
            .lock()
            .unwrap_or_else(PoisonError::into_inner);
        self.register_ptrs_locked(&mut registrations, role, pointers)
    }

    fn register_ptrs_locked(
        self: &Arc<Self>,
        registrations: &mut HashMap<RegistryKey, ArcWeak<Self>>,
        role: LeasePointerRole,
        pointers: impl IntoIterator<Item = usize>,
    ) -> anyhow::Result<()> {
        let pointers = pointers.into_iter().collect::<HashSet<_>>();
        for ptr in &pointers {
            let key = (self.kind.clone(), *ptr);
            if let Some(existing) = registrations.get(&key).and_then(ArcWeak::upgrade) {
                anyhow::ensure!(
                    Arc::ptr_eq(&existing, self),
                    "A lease alias participates in another active lease"
                );
            }
        }

        let mut registered_ptrs = self.pointers.lock().unwrap_or_else(PoisonError::into_inner);
        for ptr in pointers {
            if let Some(existing) = registered_ptrs.get(&ptr) {
                anyhow::ensure!(
                    existing.role == role,
                    "A lease alias cannot belong to both lease components"
                );
            }
            registrations.insert((self.kind.clone(), ptr), Arc::downgrade(self));
            registered_ptrs.insert(
                ptr,
                LeasePointerRegistration {
                    role,
                    is_pending_alias: false,
                },
            );
        }

        Ok(())
    }

    fn ensure_accessible(&self, ptr: *mut c_void) -> anyhow::Result<()> {
        let role = self
            .pointers
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .get(&(ptr as usize))
            .map(|registration| registration.role);
        match self.state() {
            LeaseRegistrationState::Initializing => {
                anyhow::bail!("The value's lease is still being initialized")
            }
            LeaseRegistrationState::Releasing => {
                anyhow::bail!("The value's lease is ending")
            }
            LeaseRegistrationState::Active if matches!(role, Some(LeasePointerRole::Owner)) => {
                anyhow::bail!("The lease owner cannot be used while leased")
            }
            LeaseRegistrationState::Active
                if matches!(role, Some(LeasePointerRole::Destroying)) =>
            {
                anyhow::bail!("The leased value is being destroyed")
            }
            LeaseRegistrationState::Active => Ok(()),
        }
    }

    fn mark_destroying(&self, ptr: usize) {
        if let Some(role) = self
            .pointers
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .get_mut(&ptr)
        {
            role.role = LeasePointerRole::Destroying;
        }
    }

    fn unregister(&self) {
        let Some(registrations) = LEASE_REGISTRATIONS.get() else {
            return;
        };
        let mut registrations = registrations.lock().unwrap_or_else(PoisonError::into_inner);
        let pointers =
            std::mem::take(&mut *self.pointers.lock().unwrap_or_else(PoisonError::into_inner));
        for ptr in pointers.into_keys() {
            let key = (self.kind.clone(), ptr);
            let should_remove = registrations.get(&key).is_some_and(|registered| {
                std::ptr::eq(registered.as_ptr(), std::ptr::from_ref(self))
            });
            if should_remove {
                registrations.remove(&key);
            }
        }
    }
}

impl Drop for LeaseRegistration {
    fn drop(&mut self) {
        self.unregister();
    }
}

thread_local! {
    static ACTIVE_LEASES: RefCell<HashMap<RegistryKey, RcWeak<LeaseInner>>> =
        RefCell::new(HashMap::new());
}

struct LeaseInner {
    kind: LeaseKind,
    owner: Cell<Option<Handle>>,
    owner_ptr: *mut c_void,
    value_ptr: *mut c_void,
    release: LeaseReleaseFn,
    owner_component: Option<Arc<LeaseComponent>>,
    value_component: Option<Arc<LeaseComponent>>,
    registration: Arc<LeaseRegistration>,
    active: Cell<bool>,
}

#[derive(Clone)]
pub(crate) struct Lease {
    inner: Rc<LeaseInner>,
}

pub(crate) struct LeaseReleaseGuard {
    lease: Lease,
    committed: bool,
}

struct LeaseRetirement {
    owner_component: Option<Arc<LeaseComponent>>,
    value_component: Option<Arc<LeaseComponent>>,
    registration: Arc<LeaseRegistration>,
}

impl LeaseRetirement {
    fn new(inner: &LeaseInner) -> Self {
        Self {
            owner_component: inner.owner_component.clone(),
            value_component: inner.value_component.clone(),
            registration: Arc::clone(&inner.registration),
        }
    }
}

impl Drop for LeaseRetirement {
    fn drop(&mut self) {
        if let Some(component) = &self.owner_component {
            component.make_available();
        }
        if let Some(component) = &self.value_component {
            component.end();
        }
        self.registration.unregister();
    }
}

impl LeaseReleaseGuard {
    pub(crate) fn commit(mut self) {
        self.lease.inner.active.set(false);
        self.committed = true;
        self.lease.retire_released();
    }
}

impl Drop for LeaseReleaseGuard {
    fn drop(&mut self) {
        if self.committed {
            return;
        }
        self.lease.inner.registration.rollback_release();
        if let Some(component) = &self.lease.inner.value_component {
            component.rollback_release();
        }
    }
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

    fn begin_release(&self) -> anyhow::Result<LeaseReleaseGuard> {
        if let Some(component) = &self.inner.value_component {
            component.begin_release()?;
        }
        if let Err(error) = self.inner.registration.begin_release() {
            if let Some(component) = &self.inner.value_component {
                component.rollback_release();
            }
            return Err(error);
        }

        Ok(LeaseReleaseGuard {
            lease: self.clone(),
            committed: false,
        })
    }

    fn retire_released(&self) {
        let retirement = LeaseRetirement::new(&self.inner);
        let owner = self.inner.owner.take();
        self.unregister();
        drop(owner);
        drop(retirement);
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
            owner_ptr != value_ptr,
            "A lease owner and result must differ"
        );
        anyhow::ensure!(
            Self::registered_inner(&kind, owner_ptr).is_none(),
            "The lease owner already participates in an active lease"
        );
        anyhow::ensure!(
            Self::registered_inner(&kind, value_ptr).is_none(),
            "The leased value already participates in an active lease"
        );
        let registration = LeaseRegistration::reserve(&kind, owner_ptr, value_ptr)?;

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
            let owner_ptrs = registration
                .register_initial_ptrs(LeasePointerRole::Owner, owner_component.member_ptrs());
            let result_ptrs = registration
                .register_initial_ptrs(LeasePointerRole::Result, value_component.member_ptrs());
            if let Err(error) = owner_ptrs.and(result_ptrs) {
                owner_component.make_available();
                value_component.make_available();
                return Err(error);
            }
            (Some(owner_component), Some(value_component))
        } else {
            (None, None)
        };

        registration.activate();

        let inner = Rc::new(LeaseInner {
            kind,
            owner: Cell::new(Some(owner)),
            owner_ptr,
            value_ptr,
            release,
            owner_component,
            value_component,
            registration,
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
        anyhow::ensure!(
            LeaseRegistration::find(kind, ptr).is_none(),
            "The value participates in an active lease"
        );
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
        if let Some(registration) = LeaseRegistration::find(kind, ptr) {
            registration.ensure_accessible(ptr)?;
        }
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

    pub(crate) fn prepare_release(&self) -> anyhow::Result<LeaseReleaseGuard> {
        anyhow::ensure!(self.is_active(), "The lease has already ended");
        self.begin_release()
    }
}

impl Drop for LeaseInner {
    fn drop(&mut self) {
        if !self.active.get() {
            return;
        }

        if let Some(component) = &self.value_component {
            component.begin_drop_release();
        }
        self.registration.begin_drop_release();
        self.active.set(false);

        let owner_ptr = self.owner_ptr;
        let value_ptr = self.value_ptr;
        let retirement = LeaseRetirement::new(self);
        let owner = self.owner.take();

        if !owner_ptr.is_null() && !value_ptr.is_null() {
            unsafe { (self.release)(owner_ptr, value_ptr) };
        }
        ACTIVE_LEASES.with_borrow_mut(|leases| {
            for ptr in [owner_ptr, value_ptr] {
                let key = Lease::registry_key(&self.kind, ptr);
                let should_remove = leases
                    .get(&key)
                    .is_some_and(|lease| std::ptr::eq(lease.as_ptr(), std::ptr::from_ref(self)));
                if should_remove {
                    leases.remove(&key);
                }
            }
        });
        drop(owner);
        drop(retirement);
    }
}

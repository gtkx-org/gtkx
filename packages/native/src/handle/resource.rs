use std::cell::Cell;
use std::ffi::c_void;
use std::rc::Rc;

pub(crate) type ResourceReleaseFn = unsafe extern "C" fn(*mut c_void);

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct ResourceKind {
    shared_library: String,
    release_fn_name: String,
}

impl ResourceKind {
    pub(crate) fn new(shared_library: String, release_fn_name: String) -> anyhow::Result<Self> {
        anyhow::ensure!(
            !shared_library.is_empty(),
            "A resource needs a shared library"
        );
        anyhow::ensure!(
            !release_fn_name.is_empty(),
            "A resource needs a release function"
        );

        Ok(Self {
            shared_library,
            release_fn_name,
        })
    }

    pub(crate) fn shared_library(&self) -> &str {
        &self.shared_library
    }

    pub(crate) fn release_fn_name(&self) -> &str {
        &self.release_fn_name
    }
}

struct ResourceInner {
    kind: ResourceKind,
    ptr: Cell<*mut c_void>,
    release: ResourceReleaseFn,
}

#[derive(Clone)]
pub(crate) struct Resource {
    inner: Rc<ResourceInner>,
}

impl std::fmt::Debug for Resource {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Resource")
            .field("kind", &self.inner.kind)
            .field("ptr", &self.as_ptr())
            .finish()
    }
}

impl Resource {
    pub(crate) fn new(kind: ResourceKind, ptr: *mut c_void, release: ResourceReleaseFn) -> Self {
        Self {
            inner: Rc::new(ResourceInner {
                kind,
                ptr: Cell::new(ptr),
                release,
            }),
        }
    }

    pub(crate) fn kind(&self) -> &ResourceKind {
        &self.inner.kind
    }

    pub(crate) fn as_ptr(&self) -> *mut c_void {
        self.inner.ptr.get()
    }

    pub(crate) fn is_active(&self) -> bool {
        !self.as_ptr().is_null()
    }

    pub(crate) fn release_now(&self) {
        let ptr = self.inner.ptr.replace(std::ptr::null_mut());
        if !ptr.is_null() {
            unsafe { (self.inner.release)(ptr) };
        }
    }

    pub(crate) fn commit_end(&self) {
        self.inner.ptr.set(std::ptr::null_mut());
    }
}

impl Drop for ResourceInner {
    fn drop(&mut self) {
        let ptr = self.ptr.replace(std::ptr::null_mut());
        if !ptr.is_null() {
            unsafe { (self.release)(ptr) };
        }
    }
}

#[must_use = "an armed resource rollback releases its output unless committed"]
pub(crate) struct ResourceRollback {
    resource: Resource,
    armed: bool,
}

impl ResourceRollback {
    pub(crate) fn new(resource: Resource) -> Self {
        Self {
            resource,
            armed: true,
        }
    }

    pub(crate) fn commit(&mut self) {
        self.armed = false;
    }
}

impl Drop for ResourceRollback {
    fn drop(&mut self) {
        if self.armed {
            self.resource.release_now();
        }
    }
}

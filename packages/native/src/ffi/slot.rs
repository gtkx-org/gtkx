use std::ffi::c_void;

#[derive(Debug, Clone, Copy)]
pub struct Slot(*mut c_void);

impl Slot {
    /// # Safety
    ///
    /// `ptr` must point to a writable memory location holding a single machine word (a C
    /// out-parameter, `GValue` field, or libffi return slot), and that location must stay live and
    /// exclusively owned by the caller for as long as the returned `Slot` is used. `Slot` is
    /// `Copy` and carries no lifetime, so nothing enforces that outside this contract.
    pub unsafe fn new(ptr: *mut c_void) -> Self {
        Self(ptr)
    }

    /// # Safety
    ///
    /// The slot must still satisfy the contract of `Slot::new`. Storing a pointer overwrites
    /// whatever the slot held without releasing it, so the caller owns the leak or double-free
    /// consequences of discarding a previous owned value.
    pub unsafe fn store(self, value: *mut c_void) {
        unsafe { self.0.cast::<*mut c_void>().write_unaligned(value) };
    }

    /// # Safety
    ///
    /// The slot must still satisfy the contract of `Slot::new` and must already have been
    /// initialized with a machine word; reading an uninitialized slot is undefined behavior.
    #[must_use]
    pub unsafe fn load(self) -> *mut c_void {
        unsafe { self.0.cast::<*mut c_void>().read_unaligned() }
    }

    /// # Safety
    ///
    /// Combines the requirements of `Slot::load` and `Slot::store`: the slot must be initialized
    /// before the call, and the caller takes over ownership of the returned previous pointer.
    pub unsafe fn swap(self, value: *mut c_void) -> *mut c_void {
        let previous = unsafe { self.load() };
        unsafe { self.store(value) };
        previous
    }

    #[must_use]
    pub fn as_ptr(self) -> *mut c_void {
        self.0
    }
}

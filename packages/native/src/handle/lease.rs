use std::cell::RefCell;
use std::collections::HashMap;
use std::ffi::c_void;

enum Lease {
    Object(glib::Object),
    Record(RecordLease),
}

#[derive(Debug)]
pub(crate) struct RecordLease(super::Handle);

impl RecordLease {
    pub(super) fn new(record: &super::Handle) -> Self {
        let active = &record.inner.active_record_leases;
        active.set(active.get() + 1);
        Self(record.clone())
    }
}

impl Drop for RecordLease {
    fn drop(&mut self) {
        let active = &self.0.inner.active_record_leases;
        active.set(active.get() - 1);
    }
}

thread_local! {
    static LEASES: RefCell<Vec<Vec<Lease>>> = const { RefCell::new(Vec::new()) };
    static CONVERSION_SOURCES: RefCell<HashMap<usize, usize>> = RefCell::default();
}

pub(crate) struct ConversionLease(*mut c_void);

impl ConversionLease {
    pub(crate) fn new(ptr: *mut c_void) -> Self {
        CONVERSION_SOURCES
            .with_borrow_mut(|sources| *sources.entry(ptr as usize).or_default() += 1);
        Self(ptr)
    }

    pub(crate) fn is_active(ptr: *mut c_void) -> bool {
        CONVERSION_SOURCES.with_borrow(|sources| sources.contains_key(&(ptr as usize)))
    }
}

impl Drop for ConversionLease {
    fn drop(&mut self) {
        CONVERSION_SOURCES.with_borrow_mut(|sources| {
            if let std::collections::hash_map::Entry::Occupied(mut entry) =
                sources.entry(self.0 as usize)
            {
                *entry.get_mut() -= 1;
                if *entry.get() == 0 {
                    entry.remove();
                }
            }
        });
    }
}

pub(crate) struct LeaseScope;

impl LeaseScope {
    pub(crate) fn open() -> Self {
        LEASES.with_borrow_mut(|scopes| scopes.push(Vec::new()));
        Self
    }

    pub(crate) fn retain(object: glib::Object) -> anyhow::Result<()> {
        LEASES.with_borrow_mut(|scopes| {
            let scope = scopes
                .last_mut()
                .ok_or_else(|| anyhow::anyhow!("Object access requires an operation scope"))?;
            scope.push(Lease::Object(object));
            Ok(())
        })
    }

    pub(crate) fn retain_record(record: RecordLease) -> anyhow::Result<()> {
        LEASES.with_borrow_mut(|scopes| {
            let scope = scopes
                .last_mut()
                .ok_or_else(|| anyhow::anyhow!("Record access requires an operation scope"))?;
            scope.push(Lease::Record(record));
            Ok(())
        })
    }
}

impl Drop for LeaseScope {
    fn drop(&mut self) {
        let leases = LEASES.with_borrow_mut(Vec::pop);
        for lease in leases.into_iter().flatten() {
            match lease {
                Lease::Object(object) => super::surface::release(object),
                Lease::Record(record) => drop(record),
            }
        }
    }
}

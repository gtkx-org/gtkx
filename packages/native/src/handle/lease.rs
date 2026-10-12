use std::cell::RefCell;

enum Lease {
    Object(glib::Object),
    Record(RecordLease),
}

#[derive(Debug)]
pub(crate) struct RecordLease {
    _owner: super::Handle,
}

impl RecordLease {
    pub(super) fn new(record: &super::Handle) -> Self {
        Self {
            _owner: record.clone(),
        }
    }
}

thread_local! {
    static LEASES: RefCell<Vec<Vec<Lease>>> = const { RefCell::new(Vec::new()) };
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

use std::cell::RefCell;

thread_local! {
    static LEASES: RefCell<Vec<Vec<glib::Object>>> = const { RefCell::new(Vec::new()) };
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
            scope.push(object);
            Ok(())
        })
    }
}

impl Drop for LeaseScope {
    fn drop(&mut self) {
        let leases = LEASES.with_borrow_mut(Vec::pop);
        for object in leases.into_iter().flatten() {
            super::surface::release(object);
        }
    }
}

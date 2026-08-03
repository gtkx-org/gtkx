use std::cell::RefCell;

use napi::sys;

use crate::host::node_env;

struct PendingWrapper {
    gtype: glib::ffi::GType,
    wrapper: sys::napi_value,
    associate: sys::napi_value,
    instance: *mut glib::gobject_ffi::GObject,
}

pub struct PendingGuard {
    depth: usize,
}

thread_local! {
    static PENDING: RefCell<Vec<PendingWrapper>> = const { RefCell::new(Vec::new()) };
}

/// # Safety
///
/// `wrapper` and `associate` must stay reachable from a handle scope that outlives the returned
/// guard, and the guard must be dropped on the thread that pushed it.
#[must_use]
pub unsafe fn push(
    gtype: glib::ffi::GType,
    wrapper: sys::napi_value,
    associate: sys::napi_value,
) -> PendingGuard {
    PENDING.with_borrow_mut(|pending| {
        let depth = pending.len();
        pending.push(PendingWrapper {
            gtype,
            wrapper,
            associate,
            instance: std::ptr::null_mut(),
        });
        PendingGuard { depth }
    })
}

#[must_use]
pub fn claim(
    instance: *mut glib::gobject_ffi::GObject,
    leaf_gtype: glib::ffi::GType,
) -> Option<(sys::napi_value, sys::napi_value)> {
    if !node_env::is_installed_on_current_thread() {
        return None;
    }

    PENDING.with_borrow_mut(|pending| {
        let entry = pending.last_mut()?;

        if !entry.instance.is_null() || entry.gtype != leaf_gtype {
            return None;
        }

        entry.instance = instance;
        Some((entry.wrapper, entry.associate))
    })
}

impl PendingGuard {
    #[must_use]
    pub fn claimed_instance(&self) -> Option<*mut glib::gobject_ffi::GObject> {
        PENDING.with_borrow(|pending| {
            let entry = pending.get(self.depth)?;

            (!entry.instance.is_null()).then_some(entry.instance)
        })
    }
}

impl Drop for PendingGuard {
    fn drop(&mut self) {
        PENDING.with_borrow_mut(|pending| pending.truncate(self.depth));
    }
}

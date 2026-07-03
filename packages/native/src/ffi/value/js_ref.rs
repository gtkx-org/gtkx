use std::cell::RefCell;
use std::collections::HashMap;
use std::sync::Arc;
use std::sync::atomic::{AtomicU64, Ordering};

use napi::Env;
use napi::bindgen_prelude::*;
use napi::sys;

use crate::messaging::Mailbox;

struct JsRef {
    raw: sys::napi_ref,
    env: sys::napi_env,
}

impl std::fmt::Debug for JsRef {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("JsRef").finish_non_exhaustive()
    }
}

impl Drop for JsRef {
    fn drop(&mut self) {
        if Mailbox::global().is_not_running() {
            return;
        }
        let status = unsafe { sys::napi_delete_reference(self.env, self.raw) };
        debug_assert_eq!(status, sys::Status::napi_ok);
    }
}

impl JsRef {
    fn from_js_value<'a, V: JsValue<'a>>(env: &Env, value: &V) -> napi::Result<Self> {
        let raw_value = value.raw();
        let mut raw_ref = std::ptr::null_mut();
        let status = unsafe { sys::napi_create_reference(env.raw(), raw_value, 1, &mut raw_ref) };
        check_status!(status, "Failed to create reference")?;
        Ok(Self {
            raw: raw_ref,
            env: env.raw(),
        })
    }

    fn get_raw(&self, env: &Env) -> napi::Result<sys::napi_value> {
        let mut raw_value = std::ptr::null_mut();
        let status = unsafe { sys::napi_get_reference_value(env.raw(), self.raw, &mut raw_value) };
        check_status!(status, "Failed to get reference value")?;
        Ok(raw_value)
    }

    fn get<T: FromNapiValue>(&self, env: &Env) -> napi::Result<T> {
        let raw_value = self.get_raw(env)?;
        unsafe { T::from_napi_value(env.raw(), raw_value) }
    }
}

static NEXT_ID: AtomicU64 = AtomicU64::new(1);

thread_local! {
    static REGISTRY: RefCell<HashMap<u64, JsRef>> = RefCell::new(HashMap::new());
}

fn register(js_ref: JsRef) -> u64 {
    let id = NEXT_ID.fetch_add(1, Ordering::Relaxed);
    REGISTRY.with_borrow_mut(|entries| entries.insert(id, js_ref));
    id
}

fn with_registered<R>(id: u64, read: impl FnOnce(&JsRef) -> R) -> Option<R> {
    REGISTRY.with_borrow(|entries| entries.get(&id).map(read))
}

pub(crate) fn release_registered_js_ref(id: u64) {
    REGISTRY.with_borrow_mut(|entries| entries.remove(&id));
}

fn schedule_release(id: u64) {
    if glib::MainContext::default().is_owner() {
        if !Mailbox::global().is_not_running() {
            Mailbox::global().schedule_js_reference_release(id);
        }
    } else {
        release_registered_js_ref(id);
    }
}

struct JsHandleInner {
    id: u64,
}

impl Drop for JsHandleInner {
    fn drop(&mut self) {
        schedule_release(self.id);
    }
}

#[derive(Clone)]
pub struct JsHandle(Arc<JsHandleInner>);

impl std::fmt::Debug for JsHandle {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("JsHandle").finish_non_exhaustive()
    }
}

impl JsHandle {
    pub fn from_js_value<'a, V: JsValue<'a>>(env: &Env, value: &V) -> napi::Result<Self> {
        let js_ref = JsRef::from_js_value(env, value)?;
        let id = register(js_ref);
        Ok(Self(Arc::new(JsHandleInner { id })))
    }

    pub fn get<T: FromNapiValue>(&self, env: &Env) -> napi::Result<T> {
        with_registered(self.0.id, |js_ref| js_ref.get(env)).unwrap_or_else(|| {
            Err(napi::Error::new(
                napi::Status::GenericFailure,
                "JS reference is no longer registered",
            ))
        })
    }

    pub fn ref_count(&self) -> usize {
        Arc::strong_count(&self.0)
    }
}

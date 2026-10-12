use std::cell::{Cell, OnceCell, RefCell};
use std::collections::HashMap;
use std::rc::{Rc, Weak};

use napi::bindgen_prelude::*;
use napi_derive::napi;

use crate::api::type_from_bigint;
use crate::handle::{BoxedFreeFn, Handle};
use crate::host::callback_error::CallbackErrorScope;
use crate::host::node_env;
use crate::value::ClosureHandle;

mod cairo_path;

pub use cairo_path::RecordConverterOptions;

thread_local! {
    static RESOLVERS: RefCell<HashMap<usize, Vec<Weak<ResolverCallback>>>> = RefCell::new(HashMap::new());
}

#[derive(Debug)]
struct ResolverCallback {
    env: sys::napi_env,
    callback: RefCell<Option<ClosureHandle>>,
    resolving: Cell<bool>,
}

struct ResolvingGuard<'a>(&'a Cell<bool>);

impl Drop for ResolvingGuard<'_> {
    fn drop(&mut self) {
        self.0.set(false);
    }
}

impl ResolverCallback {
    fn new<'env, V: JsValue<'env>>(env: &Env, resolve: &V) -> Result<Rc<Self>> {
        let callback = Rc::new(Self {
            env: env.raw(),
            callback: RefCell::new(Some(ClosureHandle::from_js_value(env, resolve)?)),
            resolving: Cell::new(false),
        });
        let key = env.raw() as usize;
        RESOLVERS.with_borrow_mut(|environments| {
            if let std::collections::hash_map::Entry::Vacant(entry) = environments.entry(key) {
                env.add_env_cleanup_hook(key, |key| {
                    let callbacks = RESOLVERS.with_borrow_mut(|entries| entries.remove(&key));
                    for callback in callbacks
                        .into_iter()
                        .flatten()
                        .filter_map(|weak| weak.upgrade())
                    {
                        callback.callback.borrow_mut().take();
                    }
                })?;
                entry.insert(Vec::new());
            }
            if let Some(callbacks) = environments.get_mut(&key) {
                if callbacks.len() % 64 == 0 {
                    callbacks.retain(|weak| weak.strong_count() > 0);
                }
                callbacks.push(Rc::downgrade(&callback));
            }
            Ok::<_, Error>(())
        })?;
        Ok(callback)
    }

    fn call<T: FromNapiValue>(&self) -> anyhow::Result<T> {
        let env = node_env::try_env().ok_or_else(|| {
            anyhow::anyhow!("A lifecycle resolver requires its active Node environment")
        })?;
        anyhow::ensure!(
            env.raw() == self.env,
            "A lifecycle resolver belongs to a different Node environment"
        );
        anyhow::ensure!(
            !self.resolving.replace(true),
            "A lifecycle resolver cannot recursively resolve itself"
        );
        let _resolving = ResolvingGuard(&self.resolving);
        let resolve = self
            .callback
            .borrow()
            .as_ref()
            .ok_or_else(|| anyhow::anyhow!("The lifecycle resolver environment has been released"))?
            .get::<Function<'_, (), T>>(&env)?;
        resolve.call(()).map_err(|error| {
            let message = error.to_string();
            CallbackErrorScope::deliver(env, error);
            anyhow::anyhow!(message)
        })
    }
}

#[derive(Debug)]
struct LazyResolver<T> {
    callback: Rc<ResolverCallback>,
    resolved: OnceCell<T>,
}

/// A runtime-supplied `GType` lookup, activated only when a codec needs its declared type.
/// Registered types are cached; an unregistered name remains eligible for later resolution.
#[derive(Debug, Clone)]
pub struct TypeResolver(Rc<LazyResolver<glib::Type>>);

impl TypeResolver {
    pub(crate) fn get(&self) -> anyhow::Result<Option<glib::Type>> {
        if let Some(type_) = self.0.resolved.get() {
            return Ok(Some(*type_));
        }
        let value: BigInt = self.0.callback.call()?;
        let (negative, value_number, lossless) = value.get_u64();
        anyhow::ensure!(
            !negative && lossless,
            "A lifecycle GType must be an unsigned 64-bit bigint"
        );
        if value_number == 0 {
            return Ok(None);
        }
        let type_ = type_from_bigint(&value, "lifecycle resolver")?;
        let _ = self.0.resolved.set(type_);
        Ok(Some(type_))
    }
}

impl FromNapiValue for TypeResolver {
    unsafe fn from_napi_value(env: sys::napi_env, value: sys::napi_value) -> Result<Self> {
        let external = unsafe { <&External<Self>>::from_napi_value(env, value)? };
        Ok((**external).clone())
    }
}

/// A runtime-supplied native operation backed by a permanently mapped library. The resolver
/// retains the executable handle; native destructors use its resolved pointer without JavaScript.
#[derive(Debug, Clone)]
pub struct FunctionResolver(Rc<LazyResolver<Handle>>);

impl FunctionResolver {
    /// # Safety
    ///
    /// `T` must be a function pointer with the exported operation's exact calling convention and
    /// signature. Accepted handles retain process-lifetime libraries, so the returned function
    /// remains executable after the resolver or its Node environment has been released.
    pub(crate) unsafe fn get<T: Copy>(&self) -> anyhow::Result<T> {
        if self.0.resolved.get().is_none() {
            let handle: &External<Handle> = self.0.callback.call()?;
            handle.lifecycle_function_ptr()?;
            let _ = self.0.resolved.set((**handle).clone());
        }
        let handle = self
            .0
            .resolved
            .get()
            .ok_or_else(|| anyhow::anyhow!("The lifecycle function could not be retained"))?;
        let ptr = handle.lifecycle_function_ptr()?;
        anyhow::ensure!(
            size_of::<T>() == size_of_val(&ptr),
            "A lifecycle operation must have function-pointer storage"
        );
        Ok(unsafe { std::mem::transmute_copy(&ptr) })
    }
}

impl FromNapiValue for FunctionResolver {
    unsafe fn from_napi_value(env: sys::napi_env, value: sys::napi_value) -> Result<Self> {
        let external = unsafe { <&External<Self>>::from_napi_value(env, value)? };
        Ok((**external).clone())
    }
}

/// Retains a lazy runtime `GType` lookup without invoking it during signature compilation.
#[allow(clippy::needless_pass_by_value)]
#[napi(catch_unwind)]
pub fn create_type_resolver(
    env: Env,
    resolve: Function<'_, (), BigInt>,
) -> Result<External<TypeResolver>> {
    Ok(External::new(TypeResolver(Rc::new(LazyResolver {
        callback: ResolverCallback::new(&env, &resolve)?,
        resolved: OnceCell::new(),
    }))))
}

/// Retains a lazy runtime lifecycle lookup without invoking it during signature compilation.
#[napi(catch_unwind)]
pub fn create_function_resolver(
    env: Env,
    #[napi(ts_arg_type = "() => ExternalObject<Handle>")] resolve: Function<'_, (), Unknown<'_>>,
) -> Result<External<FunctionResolver>> {
    Ok(External::new(FunctionResolver(Rc::new(LazyResolver {
        callback: ResolverCallback::new(&env, &resolve)?,
        resolved: OnceCell::new(),
    }))))
}

/// A native record copy strategy retaining its library-backed lifecycle operations.
#[derive(Debug, Clone)]
pub struct RecordConverter(Rc<cairo_path::CairoPathCopy>);

impl RecordConverter {
    pub(crate) fn copy(
        &self,
        ptr: *mut std::ffi::c_void,
        free: BoxedFreeFn,
    ) -> anyhow::Result<*mut std::ffi::c_void> {
        self.0.copy(ptr, free)
    }
}

impl FromNapiValue for RecordConverter {
    unsafe fn from_napi_value(env: sys::napi_env, value: sys::napi_value) -> Result<Self> {
        let external = unsafe { <&External<Self>>::from_napi_value(env, value)? };
        Ok((**external).clone())
    }
}

/// Compiles a native record copy strategy without resolving its lifecycle operations yet.
#[napi(catch_unwind)]
pub fn create_record_converter(
    options: RecordConverterOptions,
) -> Result<External<RecordConverter>> {
    Ok(External::new(RecordConverter(Rc::new(
        cairo_path::CairoPathCopy::new(options)?,
    ))))
}

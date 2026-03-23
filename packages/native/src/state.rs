//! GTK thread-local state and native library management.
//!
//! This module manages the thread-local state for the GTK thread, composed of
//! focused single-responsibility types:
//!
//! - [`HandleMap`]: Maps handle IDs to managed [`NativeValue`] instances
//! - [`LibraryCache`]: Caches dynamically loaded native libraries
//! - [`FundamentalFnCache`]: Caches ref/unref function pointers for fundamental types
//! - [`GtkThreadState`]: Thin coordinator composing the above, accessed via [`GtkThreadState::with`]
//! - [`GtkThread`]: Singleton for GTK thread lifecycle management

use std::cell::RefCell;
use std::collections::{HashMap, hash_map::Entry};
use std::ffi::c_void;
use std::mem::ManuallyDrop;
use std::sync::{Mutex, OnceLock};
use std::thread::JoinHandle;

use gtk4::gio::ApplicationHoldGuard;
use libloading::os::unix::{Library, RTLD_GLOBAL, RTLD_NOW};

use crate::managed::{NativeValue, RefFn, UnrefFn};

thread_local! {
    static GTK_THREAD_STATE: RefCell<GtkThreadState> = RefCell::new(GtkThreadState::default());
}

#[derive(Debug)]
pub struct GtkThread {
    handle: Mutex<Option<JoinHandle<()>>>,
}

static GTK_THREAD: OnceLock<GtkThread> = OnceLock::new();

impl GtkThread {
    pub fn global() -> &'static Self {
        GTK_THREAD.get_or_init(|| GtkThread {
            handle: Mutex::new(None),
        })
    }

    pub fn set_handle(&self, handle: JoinHandle<()>) {
        self.handle
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
            .replace(handle);
    }

    pub fn join(&self) {
        let handle = self
            .handle
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
            .take();

        if let Some(handle) = handle
            && let Err(payload) = handle.join()
        {
            let msg = payload
                .downcast_ref::<&str>()
                .copied()
                .or_else(|| payload.downcast_ref::<String>().map(String::as_str))
                .unwrap_or("unknown panic");
            gtkx_warn!("GTK thread panicked: {msg}");
        }
    }
}

pub struct HandleMap {
    /// Wrapped in ManuallyDrop because dropping GLib objects after GTK cleanup
    /// can crash — e.g., WebKit objects have complex cleanup that depends on
    /// the main loop. Objects are reclaimed at process exit.
    map: ManuallyDrop<HashMap<usize, NativeValue>>,
    next_id: usize,
}

impl std::fmt::Debug for HandleMap {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("HandleMap")
            .field("len", &self.map.len())
            .finish()
    }
}

impl HandleMap {
    fn new() -> Self {
        Self {
            map: ManuallyDrop::new(HashMap::new()),
            next_id: 1,
        }
    }

    pub fn insert(&mut self, value: NativeValue) -> usize {
        let key = self.next_id;
        self.next_id = self.next_id.wrapping_add(1);
        self.map.insert(key, value);
        key
    }

    pub fn remove(&mut self, id: usize) -> Option<NativeValue> {
        self.map.remove(&id)
    }

    #[must_use]
    pub fn get(&self, id: usize) -> Option<&NativeValue> {
        self.map.get(&id)
    }

    #[must_use]
    pub fn get_ptr(&self, id: usize) -> Option<*mut c_void> {
        self.get(id).map(|object| match object {
            NativeValue::GObject(obj) => gtk4::glib::object::ObjectType::as_ptr(obj) as *mut c_void,
            NativeValue::Boxed(boxed) => boxed.as_ptr(),
            NativeValue::Fundamental(fundamental) => fundamental.as_ptr(),
        })
    }

    #[must_use]
    pub fn len(&self) -> usize {
        self.map.len()
    }

    #[must_use]
    pub fn is_empty(&self) -> bool {
        self.map.is_empty()
    }
}

pub struct LibraryCache {
    /// Wrapped in ManuallyDrop because libraries like WebKit spawn threads with
    /// TLS destructors — calling dlclose() while those threads exist causes
    /// segfaults. Libraries are reclaimed at process exit.
    libraries: ManuallyDrop<HashMap<String, Library>>,
}

impl std::fmt::Debug for LibraryCache {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("LibraryCache")
            .field("len", &self.libraries.len())
            .finish()
    }
}

impl LibraryCache {
    fn new() -> Self {
        Self {
            libraries: ManuallyDrop::new(HashMap::new()),
        }
    }

    pub fn get_or_load(&mut self, name: &str) -> anyhow::Result<&Library> {
        match self.libraries.entry(name.to_string()) {
            Entry::Occupied(entry) => Ok(entry.into_mut()),
            Entry::Vacant(entry) => {
                let lib_names: Vec<&str> = name.split(',').collect();
                let mut last_error = None;

                for lib_name in &lib_names {
                    // SAFETY: Loading a shared library with RTLD_NOW | RTLD_GLOBAL
                    // is safe as long as the library path is valid
                    match unsafe { Library::open(Some(*lib_name), RTLD_NOW | RTLD_GLOBAL) } {
                        Ok(lib) => {
                            return Ok(entry.insert(lib));
                        }
                        Err(err) => {
                            last_error = Some(err);
                        }
                    }
                }

                match last_error {
                    Some(err) => anyhow::bail!("Failed to load library '{}': {}", name, err),
                    None => {
                        anyhow::bail!("Failed to load library '{}': no libraries specified", name)
                    }
                }
            }
        }
    }

    pub fn resolve_gtype(
        &mut self,
        lib_name: &str,
        get_type_fn_name: &str,
    ) -> anyhow::Result<gtk4::glib::Type> {
        use gtk4::glib::translate::FromGlib as _;

        let lib = self.get_or_load(lib_name)?;

        type GetTypeFn = unsafe extern "C" fn() -> gtk4::glib::ffi::GType;

        let func = unsafe {
            lib.get::<GetTypeFn>(get_type_fn_name.as_bytes())
                .map_err(|e| {
                    anyhow::anyhow!("Failed to find symbol '{}': {}", get_type_fn_name, e)
                })?
        };

        let gtype_raw = unsafe { func() };
        Ok(unsafe { gtk4::glib::Type::from_glib(gtype_raw) })
    }

    #[must_use]
    pub fn len(&self) -> usize {
        self.libraries.len()
    }

    #[must_use]
    pub fn is_empty(&self) -> bool {
        self.libraries.is_empty()
    }
}

pub struct FundamentalFnCache {
    cache: HashMap<(String, String), (Option<RefFn>, Option<UnrefFn>)>,
}

impl std::fmt::Debug for FundamentalFnCache {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("FundamentalFnCache")
            .field("len", &self.cache.len())
            .finish()
    }
}

impl FundamentalFnCache {
    fn new() -> Self {
        Self {
            cache: HashMap::new(),
        }
    }

    pub fn lookup(
        &mut self,
        libs: &mut LibraryCache,
        library_name: &str,
        ref_func: &str,
        unref_func: &str,
    ) -> anyhow::Result<(Option<RefFn>, Option<UnrefFn>)> {
        let key = (ref_func.to_owned(), unref_func.to_owned());
        if let Some(cached) = self.cache.get(&key) {
            return Ok(*cached);
        }

        let library = libs.get_or_load(library_name)?;

        let ref_fn = unsafe {
            library
                .get::<RefFn>(ref_func.as_bytes())
                .ok()
                .map(|sym| *sym)
        };

        let unref_fn = unsafe {
            library
                .get::<UnrefFn>(unref_func.as_bytes())
                .ok()
                .map(|sym| *sym)
        };

        let result = (ref_fn, unref_fn);
        self.cache.insert(key, result);
        Ok(result)
    }
}

pub struct GtkThreadState {
    pub app_hold_guard: Option<ApplicationHoldGuard>,
    pub handles: HandleMap,
    pub libs: LibraryCache,
    pub fundamental_fns: FundamentalFnCache,
}

impl Default for GtkThreadState {
    fn default() -> Self {
        Self {
            app_hold_guard: None,
            handles: HandleMap::new(),
            libs: LibraryCache::new(),
            fundamental_fns: FundamentalFnCache::new(),
        }
    }
}

impl std::fmt::Debug for GtkThreadState {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("GtkThreadState")
            .field("handles_len", &self.handles.len())
            .field("libraries_len", &self.libs.len())
            .finish()
    }
}

impl GtkThreadState {
    pub fn with<F, R>(f: F) -> R
    where
        F: FnOnce(&mut GtkThreadState) -> R,
    {
        GTK_THREAD_STATE.with_borrow_mut(f)
    }

    pub fn lookup_fundamental_fns(
        &mut self,
        library_name: &str,
        ref_func: &str,
        unref_func: &str,
    ) -> anyhow::Result<(Option<RefFn>, Option<UnrefFn>)> {
        self.fundamental_fns
            .lookup(&mut self.libs, library_name, ref_func, unref_func)
    }

    pub fn gtype_from_lib(
        &mut self,
        lib_name: &str,
        get_type_fn_name: &str,
    ) -> anyhow::Result<gtk4::glib::Type> {
        self.libs.resolve_gtype(lib_name, get_type_fn_name)
    }

    pub fn library(&mut self, name: &str) -> anyhow::Result<&Library> {
        self.libs.get_or_load(name)
    }
}

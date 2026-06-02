//! `GLib` thread-local state and native library management.
//!
//! This module manages the thread-local state for the `GLib` thread, composed of
//! focused single-responsibility types:
//!
//! - [`LibraryCache`]: Caches dynamically loaded native libraries
//! - [`FundamentalFnCache`]: Caches ref/unref function pointers for fundamental types
//! - [`GlibThreadState`]: Thin coordinator composing the above, accessed via [`GlibThreadState::with`]
//! - [`GlibThread`]: Singleton for `GLib` thread lifecycle management

use std::cell::RefCell;
use std::collections::HashMap;
use std::mem::ManuallyDrop;
use std::sync::{Mutex, OnceLock};
use std::thread::JoinHandle;

use libloading::os::unix::{Library, RTLD_GLOBAL, RTLD_NOW};

use crate::managed::{RefFn, UnrefFn};
use crate::panic_handler::format_panic_payload;

thread_local! {
    static GLIB_THREAD_STATE: RefCell<GlibThreadState> = RefCell::new(GlibThreadState::default());
}

#[derive(Debug)]
pub struct GlibThread {
    handle: Mutex<Option<JoinHandle<()>>>,
}

static GLIB_THREAD: OnceLock<GlibThread> = OnceLock::new();

impl GlibThread {
    pub fn global() -> &'static Self {
        GLIB_THREAD.get_or_init(|| Self {
            handle: Mutex::new(None),
        })
    }

    pub fn set_handle(&self, handle: JoinHandle<()>) {
        self.handle
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
            .replace(handle);
    }

    pub fn join(&self) -> Option<String> {
        let handle = self
            .handle
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
            .take();

        if let Some(handle) = handle
            && let Err(payload) = handle.join()
        {
            return Some(format_panic_payload(&*payload));
        }
        None
    }
}

pub struct LibraryCache {
    /// Wrapped in `ManuallyDrop` because libraries like `WebKit` spawn threads with
    /// TLS destructors — calling `dlclose()` while those threads exist causes
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
        if !self.libraries.contains_key(name) {
            let library = Self::load(name)?;
            self.libraries.insert(name.to_owned(), library);
        }
        Ok(&self.libraries[name])
    }

    fn load(name: &str) -> anyhow::Result<Library> {
        let mut last_error = None;

        for lib_name in name.split(',') {
            // SAFETY: Loading a shared library with RTLD_NOW | RTLD_GLOBAL
            // is safe as long as the library path is valid.
            match unsafe { Library::open(Some(lib_name), RTLD_NOW | RTLD_GLOBAL) } {
                Ok(lib) => return Ok(lib),
                Err(err) => last_error = Some(err),
            }
        }

        let err = last_error.expect("str::split always yields at least one candidate");
        anyhow::bail!("Failed to load library '{name}': {err}")
    }

    pub fn resolve_gtype(
        &mut self,
        lib_name: &str,
        get_type_fn_name: &str,
    ) -> anyhow::Result<gtk4::glib::Type> {
        use gtk4::glib::translate::FromGlib as _;

        type GetTypeFn = unsafe extern "C" fn() -> gtk4::glib::ffi::GType;

        let lib = self.get_or_load(lib_name)?;

        let func = unsafe {
            lib.get::<GetTypeFn>(get_type_fn_name.as_bytes())
                .map_err(|e| anyhow::anyhow!("Failed to find symbol '{get_type_fn_name}': {e}"))?
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

type FundamentalFns = (Option<RefFn>, Option<UnrefFn>);

pub struct FundamentalFnCache {
    cache: HashMap<String, HashMap<String, FundamentalFns>>,
}

impl std::fmt::Debug for FundamentalFnCache {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let len: usize = self.cache.values().map(HashMap::len).sum();
        f.debug_struct("FundamentalFnCache")
            .field("len", &len)
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
    ) -> anyhow::Result<FundamentalFns> {
        if let Some(cached) = self
            .cache
            .get(ref_func)
            .and_then(|by_unref| by_unref.get(unref_func))
        {
            return Ok(*cached);
        }

        let library = libs.get_or_load(library_name)?;

        let ref_fn = if ref_func.is_empty() {
            None
        } else {
            Some(unsafe {
                *library
                    .get::<RefFn>(ref_func.as_bytes())
                    .map_err(|e| anyhow::anyhow!("Failed to find ref symbol '{ref_func}': {e}"))?
            })
        };

        let unref_fn = if unref_func.is_empty() {
            None
        } else {
            Some(unsafe {
                *library.get::<UnrefFn>(unref_func.as_bytes()).map_err(|e| {
                    anyhow::anyhow!("Failed to find unref symbol '{unref_func}': {e}")
                })?
            })
        };

        if ref_fn.is_none() && unref_fn.is_some() {
            anyhow::bail!(
                "Fundamental type declares unref '{unref_func}' without a ref function; a wrapper built from it would release a reference it never took"
            );
        }

        let result = (ref_fn, unref_fn);
        self.cache
            .entry(ref_func.to_owned())
            .or_default()
            .insert(unref_func.to_owned(), result);
        Ok(result)
    }
}

pub struct GlibThreadState {
    pub libs: LibraryCache,
    pub fundamental_fns: FundamentalFnCache,
}

impl Default for GlibThreadState {
    fn default() -> Self {
        Self {
            libs: LibraryCache::new(),
            fundamental_fns: FundamentalFnCache::new(),
        }
    }
}

impl std::fmt::Debug for GlibThreadState {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("GlibThreadState")
            .field("libraries_len", &self.libs.len())
            .finish_non_exhaustive()
    }
}

impl GlibThreadState {
    pub fn with<F, R>(f: F) -> R
    where
        F: FnOnce(&mut Self) -> R,
    {
        GLIB_THREAD_STATE.with_borrow_mut(f)
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

    pub fn resolve_gtype(
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

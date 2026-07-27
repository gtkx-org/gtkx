use std::collections::HashMap;
use std::sync::{Mutex, OnceLock, PoisonError};

use libloading::os::unix::{Library, RTLD_GLOBAL, RTLD_NOW};

use crate::handle::{RefFn, UnrefFn};

type GetTypeFn = unsafe extern "C" fn() -> glib::ffi::GType;

/// The cache is process-global rather than per-thread because everything it hands out is
/// process-global: `dlopen` handles, the raw symbol pointers callers copy out, and the types
/// `invoke_and_cache_type` registers, which `GLib` never unregisters. A `static` is never
/// dropped, so no `dlclose` can run while another library's worker threads still execute its code.
static FFI_CACHE: OnceLock<Mutex<FfiCache>> = OnceLock::new();

pub struct LibraryCache {
    libraries: HashMap<String, Library>,
    types: HashMap<String, HashMap<String, glib::Type>>,
}

impl std::fmt::Debug for LibraryCache {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("LibraryCache")
            .field("len", &self.libraries.len())
            .finish_non_exhaustive()
    }
}

impl LibraryCache {
    fn new() -> Self {
        Self {
            libraries: HashMap::new(),
            types: HashMap::new(),
        }
    }

    pub fn get_or_load(&mut self, library_name: &str) -> anyhow::Result<&Library> {
        if !self.libraries.contains_key(library_name) {
            let library = Self::load(library_name)?;
            self.libraries.insert(library_name.to_owned(), library);
        }
        Ok(&self.libraries[library_name])
    }

    fn load(library_name: &str) -> anyhow::Result<Library> {
        let mut last_error = None;

        for lib_name in library_name.split(',') {
            match unsafe { Library::open(Some(lib_name), RTLD_NOW | RTLD_GLOBAL) } {
                Ok(lib) => return Ok(lib),
                Err(err) => last_error = Some(err),
            }
        }

        let err = last_error.expect("str::split always yields at least one candidate");
        anyhow::bail!("Failed to load library '{library_name}': {err}")
    }

    /// # Safety
    ///
    /// `T` must be layout- and ABI-compatible with the type the symbol is actually exported with:
    /// a function pointer whose calling convention and signature match the C declaration, or a
    /// pointer to the exported object. The returned value carries no lifetime tying it to the
    /// library, so it is only usable while the library stays mapped; the cache holding the
    /// `Library` is a `static` that is never dropped, so that holds for the life of the process.
    pub unsafe fn resolve_symbol<T: Copy>(
        &mut self,
        library_name: &str,
        symbol_name: &str,
    ) -> anyhow::Result<T> {
        let library = self.get_or_load(library_name)?;
        let symbol = unsafe { library.get::<T>(symbol_name.as_bytes()) }
            .map_err(|e| anyhow::anyhow!("Failed to find symbol '{symbol_name}': {e}"))?;
        Ok(*symbol)
    }

    pub fn resolve_type(
        &mut self,
        library_name: &str,
        get_type_fn_name: &str,
    ) -> anyhow::Result<glib::Type> {
        self.resolve_type_with(library_name, get_type_fn_name, |cache| {
            unsafe { cache.resolve_symbol::<GetTypeFn>(library_name, get_type_fn_name) }.map(Some)
        })
    }

    pub fn resolve_type_optional(
        &mut self,
        library_name: &str,
        get_type_fn_name: &str,
    ) -> anyhow::Result<glib::Type> {
        self.resolve_type_with(library_name, get_type_fn_name, |cache| {
            let library = cache.get_or_load(library_name)?;
            let symbol = unsafe { library.get::<GetTypeFn>(get_type_fn_name.as_bytes()) };
            Ok(symbol.ok().map(|symbol| *symbol))
        })
    }

    fn resolve_type_with(
        &mut self,
        library_name: &str,
        get_type_fn_name: &str,
        lookup: impl FnOnce(&mut Self) -> anyhow::Result<Option<GetTypeFn>>,
    ) -> anyhow::Result<glib::Type> {
        if let Some(cached) = self.cached_type(library_name, get_type_fn_name) {
            return Ok(cached);
        }
        let Some(get_type_fn) = lookup(self)? else {
            return Ok(glib::Type::INVALID);
        };
        Ok(self.invoke_and_cache_type(library_name, get_type_fn_name, get_type_fn))
    }

    fn cached_type(&self, library_name: &str, get_type_fn_name: &str) -> Option<glib::Type> {
        self.types
            .get(library_name)
            .and_then(|by_fn| by_fn.get(get_type_fn_name))
            .copied()
    }

    fn invoke_and_cache_type(
        &mut self,
        library_name: &str,
        get_type_fn_name: &str,
        get_type_fn: GetTypeFn,
    ) -> glib::Type {
        use glib::translate::FromGlib as _;
        let raw_type = unsafe { get_type_fn() };
        let type_ = unsafe { glib::Type::from_glib(raw_type) };
        self.types
            .entry(library_name.to_owned())
            .or_default()
            .insert(get_type_fn_name.to_owned(), type_);
        type_
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
    cache: HashMap<String, HashMap<String, HashMap<String, FundamentalFns>>>,
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
        ref_fn_name: &str,
        unref_fn_name: &str,
    ) -> anyhow::Result<FundamentalFns> {
        if let Some(cached) = self
            .cache
            .get(library_name)
            .and_then(|by_ref| by_ref.get(ref_fn_name))
            .and_then(|by_unref| by_unref.get(unref_fn_name))
        {
            return Ok(*cached);
        }

        let ref_fn = if ref_fn_name.is_empty() {
            None
        } else {
            Some(unsafe { libs.resolve_symbol::<RefFn>(library_name, ref_fn_name) }?)
        };

        let unref_fn = if unref_fn_name.is_empty() {
            None
        } else {
            Some(unsafe { libs.resolve_symbol::<UnrefFn>(library_name, unref_fn_name) }?)
        };

        if ref_fn.is_none() && unref_fn.is_some() {
            anyhow::bail!(
                "Fundamental type declares unref '{unref_fn_name}' without a ref function; a wrapper built from it would release a reference it never took"
            );
        }

        let result = (ref_fn, unref_fn);
        self.cache
            .entry(library_name.to_owned())
            .or_default()
            .entry(ref_fn_name.to_owned())
            .or_default()
            .insert(unref_fn_name.to_owned(), result);
        Ok(result)
    }
}

pub struct FfiCache {
    pub libs: LibraryCache,
    pub fundamental_fns: FundamentalFnCache,
}

impl Default for FfiCache {
    fn default() -> Self {
        Self {
            libs: LibraryCache::new(),
            fundamental_fns: FundamentalFnCache::new(),
        }
    }
}

impl std::fmt::Debug for FfiCache {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("FfiCache")
            .field("libraries_len", &self.libs.len())
            .finish_non_exhaustive()
    }
}

impl FfiCache {
    pub fn with<F, R>(f: F) -> R
    where
        F: FnOnce(&mut Self) -> R,
    {
        let mut cache = FFI_CACHE
            .get_or_init(|| Mutex::new(Self::default()))
            .lock()
            .unwrap_or_else(PoisonError::into_inner);

        f(&mut cache)
    }

    pub fn lookup_fundamental_fns(
        &mut self,
        library_name: &str,
        ref_fn_name: &str,
        unref_fn_name: &str,
    ) -> anyhow::Result<(Option<RefFn>, Option<UnrefFn>)> {
        self.fundamental_fns
            .lookup(&mut self.libs, library_name, ref_fn_name, unref_fn_name)
    }

    /// # Safety
    ///
    /// Same contract as `LibraryCache::resolve_symbol`: `T` must be layout- and ABI-compatible
    /// with the type the symbol is actually exported with, and the value stays usable only while
    /// the library remains mapped.
    pub unsafe fn resolve_symbol<T: Copy>(
        &mut self,
        library_name: &str,
        symbol_name: &str,
    ) -> anyhow::Result<T> {
        unsafe { self.libs.resolve_symbol(library_name, symbol_name) }
    }

    pub fn resolve_type(
        &mut self,
        library_name: &str,
        get_type_fn_name: &str,
    ) -> anyhow::Result<glib::Type> {
        self.libs.resolve_type(library_name, get_type_fn_name)
    }

    pub fn resolve_type_optional(
        &mut self,
        library_name: &str,
        get_type_fn_name: &str,
    ) -> anyhow::Result<glib::Type> {
        self.libs
            .resolve_type_optional(library_name, get_type_fn_name)
    }

    pub fn library(&mut self, library_name: &str) -> anyhow::Result<&Library> {
        self.libs.get_or_load(library_name)
    }
}

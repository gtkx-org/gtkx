use std::cell::RefCell;
use std::collections::HashMap;
use std::mem::ManuallyDrop;
use std::rc::Rc;

use libffi::middle::Cif;
use libloading::os::unix::{Library, RTLD_GLOBAL, RTLD_NOW};

use crate::handle::{RefFn, UnrefFn};

thread_local! {
    static GLIB_THREAD_STATE: RefCell<GlibThreadState> = RefCell::new(GlibThreadState::default());
}

pub struct LibraryCache {
    libraries: ManuallyDrop<HashMap<String, Library>>,
    gtypes: HashMap<String, HashMap<String, glib::Type>>,
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
            libraries: ManuallyDrop::new(HashMap::new()),
            gtypes: HashMap::new(),
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
    ) -> anyhow::Result<glib::Type> {
        use glib::translate::FromGlib as _;

        type GetTypeFn = unsafe extern "C" fn() -> glib::ffi::GType;

        if let Some(cached) = self
            .gtypes
            .get(lib_name)
            .and_then(|by_fn| by_fn.get(get_type_fn_name))
        {
            return Ok(*cached);
        }

        let lib = self.get_or_load(lib_name)?;

        let symbol = unsafe {
            lib.get::<GetTypeFn>(get_type_fn_name.as_bytes())
                .map_err(|e| anyhow::anyhow!("Failed to find symbol '{get_type_fn_name}': {e}"))?
        };

        let raw_gtype = unsafe { symbol() };
        let gtype = unsafe { glib::Type::from_glib(raw_gtype) };
        self.gtypes
            .entry(lib_name.to_owned())
            .or_default()
            .insert(get_type_fn_name.to_owned(), gtype);
        Ok(gtype)
    }

    pub fn len(&self) -> usize {
        self.libraries.len()
    }

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

        let library = libs.get_or_load(library_name)?;

        let ref_fn = if ref_fn_name.is_empty() {
            None
        } else {
            Some(unsafe {
                *library.get::<RefFn>(ref_fn_name.as_bytes()).map_err(|e| {
                    anyhow::anyhow!("Failed to find ref symbol '{ref_fn_name}': {e}")
                })?
            })
        };

        let unref_fn = if unref_fn_name.is_empty() {
            None
        } else {
            Some(unsafe {
                *library
                    .get::<UnrefFn>(unref_fn_name.as_bytes())
                    .map_err(|e| {
                        anyhow::anyhow!("Failed to find unref symbol '{unref_fn_name}': {e}")
                    })?
            })
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

pub struct GlibThreadState {
    pub libs: LibraryCache,
    pub fundamental_fns: FundamentalFnCache,
    cifs: HashMap<u64, Rc<Cif>>,
}

impl Default for GlibThreadState {
    fn default() -> Self {
        Self {
            libs: LibraryCache::new(),
            fundamental_fns: FundamentalFnCache::new(),
            cifs: HashMap::new(),
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
        ref_fn_name: &str,
        unref_fn_name: &str,
    ) -> anyhow::Result<(Option<RefFn>, Option<UnrefFn>)> {
        self.fundamental_fns
            .lookup(&mut self.libs, library_name, ref_fn_name, unref_fn_name)
    }

    pub fn resolve_gtype(
        &mut self,
        lib_name: &str,
        get_type_fn_name: &str,
    ) -> anyhow::Result<glib::Type> {
        self.libs.resolve_gtype(lib_name, get_type_fn_name)
    }

    pub fn library(&mut self, name: &str) -> anyhow::Result<&Library> {
        self.libs.get_or_load(name)
    }

    /// Returns the libffi [`Cif`] for the call descriptor identified by `id`,
    /// building it with `build` on first use and memoizing it thereafter.
    ///
    /// The `Cif` is a pure function of a descriptor's argument and return types,
    /// so it is stable for the descriptor's lifetime. Caching it here — on the
    /// single GLib thread that performs every call — avoids rebuilding the
    /// libffi type array and re-preparing the CIF on every invocation, and keeps
    /// the non-`Send` `Cif` off the shared descriptor.
    pub fn cached_cif(&mut self, id: u64, build: impl FnOnce() -> Cif) -> Rc<Cif> {
        if let Some(cif) = self.cifs.get(&id) {
            return Rc::clone(cif);
        }
        let cif = Rc::new(build());
        self.cifs.insert(id, Rc::clone(&cif));
        cif
    }
}

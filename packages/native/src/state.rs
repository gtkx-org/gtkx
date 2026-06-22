use std::cell::RefCell;
use std::collections::HashMap;
use std::mem::ManuallyDrop;
use std::sync::OnceLock;
use std::thread::JoinHandle;

use libloading::os::unix::{Library, RTLD_GLOBAL, RTLD_NOW};
use parking_lot::Mutex;

use crate::error_reporter::NativeErrorReporter;
use crate::managed::{RefFn, UnrefFn};
use crate::panic_handler::format_panic_payload;

thread_local! {
    static GLIB_THREAD_STATE: RefCell<GlibThreadState> = RefCell::new(GlibThreadState::default());
}

#[derive(Debug, Default)]
pub struct GlibThread {
    handle: Mutex<Option<JoinHandle<()>>>,
}

static GLIB_THREAD: OnceLock<GlibThread> = OnceLock::new();

impl GlibThread {
    pub fn global() -> &'static Self {
        GLIB_THREAD.get_or_init(Self::default)
    }

    pub fn set_handle(&self, handle: JoinHandle<()>) {
        let previous = self.handle.lock().replace(handle);
        if previous.is_some() {
            NativeErrorReporter::global()
                .report_str("GLib thread handle replaced while a previous thread was unjoined");
        }
    }

    pub fn join(&self) -> Option<String> {
        let handle = self.handle.lock().take();

        if let Some(handle) = handle
            && let Err(payload) = handle.join()
        {
            return Some(format_panic_payload(&*payload));
        }
        None
    }
}

pub struct LibraryCache {
    libraries: ManuallyDrop<HashMap<String, Library>>,
    gtypes: HashMap<(String, String), glib::Type>,
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
            // SAFETY: `lib_name` is a caller-provided shared-object name; `Library::open` runs the
            // library's initializers, which is sound for the GTK/GObject libraries this loads on
            // the gtkx-glib thread. Any load failure is returned as an error rather than UB.
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

        let key = (lib_name.to_owned(), get_type_fn_name.to_owned());
        if let Some(cached) = self.gtypes.get(&key) {
            return Ok(*cached);
        }

        let lib = self.get_or_load(lib_name)?;

        // SAFETY: `lib` is a loaded GObject-introspected library; `get` resolves the named symbol
        // and the declared `GetTypeFn` signature matches a GObject `*_get_type` C function.
        let func = unsafe {
            lib.get::<GetTypeFn>(get_type_fn_name.as_bytes())
                .map_err(|e| anyhow::anyhow!("Failed to find symbol '{get_type_fn_name}': {e}"))?
        };

        // SAFETY: `func` is the resolved `*_get_type` symbol with no parameters; calling it on the
        // gtkx-glib thread returns the registered GType, idempotently registering it if needed.
        let gtype_raw = unsafe { func() };
        // SAFETY: `gtype_raw` is a valid `GType` returned by a `*_get_type` function.
        let gtype = unsafe { glib::Type::from_glib(gtype_raw) };
        self.gtypes.insert(key, gtype);
        Ok(gtype)
    }

    #[must_use]
    pub fn len(&self) -> usize {
        self.libraries.len()
    }

    #[cfg(feature = "test-support")]
    #[must_use]
    pub fn is_empty(&self) -> bool {
        self.libraries.is_empty()
    }
}

type FundamentalFns = (Option<RefFn>, Option<UnrefFn>);

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
struct FundamentalFnKey {
    library_name: String,
    ref_func: String,
    unref_func: String,
}

impl FundamentalFnKey {
    fn new(library_name: &str, ref_func: &str, unref_func: &str) -> Self {
        Self {
            library_name: library_name.to_owned(),
            ref_func: ref_func.to_owned(),
            unref_func: unref_func.to_owned(),
        }
    }
}

pub struct FundamentalFnCache {
    cache: HashMap<FundamentalFnKey, FundamentalFns>,
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
    ) -> anyhow::Result<FundamentalFns> {
        let key = FundamentalFnKey::new(library_name, ref_func, unref_func);
        if let Some(cached) = self.cache.get(&key) {
            return Ok(*cached);
        }

        let library = libs.get_or_load(library_name)?;

        let ref_fn = if ref_func.is_empty() {
            None
        } else {
            // SAFETY: `library` is a loaded library; `get` resolves the named ref symbol whose C
            // signature matches the declared `RefFn`, and the deref copies out the function pointer.
            Some(unsafe {
                *library
                    .get::<RefFn>(ref_func.as_bytes())
                    .map_err(|e| anyhow::anyhow!("Failed to find ref symbol '{ref_func}': {e}"))?
            })
        };

        let unref_fn = if unref_func.is_empty() {
            None
        } else {
            // SAFETY: `library` is a loaded library; `get` resolves the named unref symbol whose C
            // signature matches the declared `UnrefFn`, and the deref copies out the function pointer.
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
        self.cache.insert(key, result);
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
    ) -> anyhow::Result<glib::Type> {
        self.libs.resolve_gtype(lib_name, get_type_fn_name)
    }

    pub fn library(&mut self, name: &str) -> anyhow::Result<&Library> {
        self.libs.get_or_load(name)
    }
}

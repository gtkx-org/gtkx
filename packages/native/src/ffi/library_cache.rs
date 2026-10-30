use std::collections::HashMap;
use std::sync::{Arc, Mutex, OnceLock, PoisonError};

use libloading::os::unix::{Library, RTLD_GLOBAL, RTLD_NOW};

static LIBRARIES: OnceLock<Mutex<HashMap<String, Arc<Library>>>> = OnceLock::new();

fn with_libraries<T>(use_cache: impl FnOnce(&mut HashMap<String, Arc<Library>>) -> T) -> T {
    let mut libraries = LIBRARIES
        .get_or_init(|| Mutex::new(HashMap::new()))
        .lock()
        .unwrap_or_else(PoisonError::into_inner);
    use_cache(&mut libraries)
}

/// Owns one loaded library. The process-wide cache also retains the library so GLib-registered
/// types and native callbacks remain executable after JavaScript releases its handle.
#[derive(Debug)]
pub struct LibraryHandle {
    library: Arc<Library>,
}

impl LibraryHandle {
    pub fn open(candidate: &str) -> anyhow::Result<Self> {
        anyhow::ensure!(
            !candidate.contains('\0'),
            "Invalid library name: NUL bytes are not allowed"
        );
        if let Some(library) = with_libraries(|libraries| libraries.get(candidate).cloned()) {
            return Ok(Self { library });
        }
        let loaded = unsafe { Library::open(Some(candidate), RTLD_NOW | RTLD_GLOBAL) }?;
        let library = with_libraries(|libraries| {
            Arc::clone(
                libraries
                    .entry(candidate.to_owned())
                    .or_insert_with(|| Arc::new(loaded)),
            )
        });
        Ok(Self { library })
    }

    #[must_use]
    pub fn owner(&self) -> Arc<Library> {
        Arc::clone(&self.library)
    }

    /// # Safety
    ///
    /// `T` must match the exported symbol's layout and ABI. The process-wide cache keeps the
    /// library mapped, and callers must retain an owner whenever storing an executable pointer.
    pub unsafe fn resolve_symbol<T: Copy>(
        &self,
        symbol_name: &str,
        optional: bool,
    ) -> anyhow::Result<Option<T>> {
        anyhow::ensure!(
            !symbol_name.contains('\0'),
            "Invalid symbol name: NUL bytes are not allowed"
        );
        match unsafe { self.library.get::<T>(symbol_name.as_bytes()) } {
            Ok(symbol) => Ok(Some(*symbol)),
            Err(libloading::Error::DlSym { .. } | libloading::Error::DlSymUnknown) if optional => {
                Ok(None)
            }
            Err(error) => anyhow::bail!("Failed to find symbol '{symbol_name}': {error}"),
        }
    }
}

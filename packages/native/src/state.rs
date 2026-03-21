//! GTK thread-local state and native library management.
//!
//! This module manages the thread-local state for the GTK thread, including
//! the object map, library cache, and application hold guard.
//!
//! ## Key Types
//!
//! - [`GtkThreadState`]: Thread-local state container accessed via [`GtkThreadState::with`]
//! - [`GtkThread`]: Singleton for GTK thread lifecycle management
//!
//! ## State Contents
//!
//! - `handle_map`: Maps handle IDs to managed [`NativeValue`] instances
//! - `next_handle_id`: Counter for generating unique handle IDs
//! - `libraries`: Cache of dynamically loaded native libraries
//! - `app_hold_guard`: Keeps the GTK application alive while running

use std::cell::RefCell;
use std::collections::{HashMap, hash_map::Entry};
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
        if let Ok(mut guard) = self.handle.lock()
            && let Some(handle) = guard.take()
        {
            let _ = handle.join();
        }
    }
}

pub struct GtkThreadState {
    pub app_hold_guard: Option<ApplicationHoldGuard>,
    /// Native object handles. Wrapped in ManuallyDrop because dropping GLib objects
    /// after GTK cleanup can crash - e.g., WebKit objects have complex cleanup
    /// that depends on the main loop. Objects are reclaimed at process exit.
    pub handle_map: ManuallyDrop<HashMap<usize, NativeValue>>,
    pub next_handle_id: usize,
    /// Dynamically loaded libraries. Wrapped in ManuallyDrop because libraries
    /// like WebKit spawn threads with TLS destructors - calling dlclose() while
    /// those threads exist causes segfaults. Libraries are reclaimed at process exit.
    pub libraries: ManuallyDrop<HashMap<String, Library>>,
    fundamental_fn_cache: HashMap<String, (Option<RefFn>, Option<UnrefFn>)>,
}

impl Default for GtkThreadState {
    fn default() -> Self {
        GtkThreadState {
            handle_map: ManuallyDrop::new(HashMap::new()),
            next_handle_id: 1,
            libraries: ManuallyDrop::new(HashMap::new()),
            app_hold_guard: None,
            fundamental_fn_cache: HashMap::new(),
        }
    }
}

impl std::fmt::Debug for GtkThreadState {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("GtkThreadState")
            .field("handle_map_len", &self.handle_map.len())
            .field("next_handle_id", &self.next_handle_id)
            .field("libraries_len", &self.libraries.len())
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
        if let Some(cached) = self.fundamental_fn_cache.get(ref_func) {
            return Ok(*cached);
        }

        let library = self.library(library_name)?;

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
        self.fundamental_fn_cache
            .insert(ref_func.to_owned(), result);
        Ok(result)
    }

    pub fn library(&mut self, name: &str) -> anyhow::Result<&Library> {
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
}

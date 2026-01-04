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
use std::sync::{Mutex, OnceLock};
use std::thread::JoinHandle;

use gtk4::gio::ApplicationHoldGuard;
use libloading::os::unix::{Library, RTLD_GLOBAL, RTLD_NOW};

use crate::managed::NativeValue;

thread_local! {
    static GTK_THREAD_STATE: RefCell<GtkThreadState> = RefCell::new(GtkThreadState::default());
}

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
            .expect("GTK thread handle mutex poisoned")
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
    pub handle_map: HashMap<usize, NativeValue>,
    pub next_handle_id: usize,
    pub libraries: HashMap<String, Library>,
}

impl Default for GtkThreadState {
    fn default() -> Self {
        GtkThreadState {
            handle_map: HashMap::new(),
            next_handle_id: 1,
            libraries: HashMap::new(),
            app_hold_guard: None,
        }
    }
}

impl GtkThreadState {
    pub fn with<F, R>(f: F) -> R
    where
        F: FnOnce(&mut GtkThreadState) -> R,
    {
        GTK_THREAD_STATE.with(|state| f(&mut state.borrow_mut()))
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

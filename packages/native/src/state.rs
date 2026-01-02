//! GTK thread-local state and native library management.
//!
//! This module manages the thread-local state for the GTK thread, including
//! the object map, library cache, and application hold guard.
//!
//! ## Key Types
//!
//! - [`GtkThreadState`]: Thread-local state container accessed via [`GtkThreadState::with`]
//!
//! ## State Contents
//!
//! - `object_map`: Maps object IDs to managed [`Object`] instances
//! - `next_object_id`: Counter for generating unique object IDs
//! - `free_object_ids`: Recycled object IDs available for reuse
//! - `libraries`: Cache of dynamically loaded native libraries
//! - `app_hold_guard`: Keeps the GTK application alive while running
//!
//! ## Thread Management
//!
//! - [`set_gtk_thread_handle`]: Stores the GTK thread handle for later joining
//! - [`join_gtk_thread`]: Waits for the GTK thread to complete during shutdown

use std::{
    cell::RefCell,
    collections::{HashMap, hash_map::Entry},
    mem::ManuallyDrop,
    sync::{Mutex, OnceLock},
    thread::JoinHandle,
};

use gtk4::gio::ApplicationHoldGuard;
use libloading::os::unix::{Library, RTLD_GLOBAL, RTLD_NOW};

use crate::object::Object;

static GTK_THREAD_HANDLE: OnceLock<Mutex<Option<JoinHandle<()>>>> = OnceLock::new();

pub fn set_gtk_thread_handle(handle: JoinHandle<()>) {
    GTK_THREAD_HANDLE
        .get_or_init(|| Mutex::new(None))
        .lock()
        .expect("GTK thread handle mutex poisoned")
        .replace(handle);
}

pub fn join_gtk_thread() {
    if let Some(mutex) = GTK_THREAD_HANDLE.get()
        && let Ok(mut guard) = mutex.lock()
        && let Some(handle) = guard.take()
    {
        let _ = handle.join();
    }
}

pub struct GtkThreadState {
    pub object_map: ManuallyDrop<HashMap<usize, Object>>,
    pub next_object_id: usize,
    pub free_object_ids: Vec<usize>,
    pub libraries: ManuallyDrop<HashMap<String, Library>>,
    pub app_hold_guard: Option<ApplicationHoldGuard>,
}

impl Default for GtkThreadState {
    fn default() -> Self {
        GtkThreadState {
            object_map: ManuallyDrop::new(HashMap::new()),
            next_object_id: 1,
            free_object_ids: Vec::new(),
            libraries: ManuallyDrop::new(HashMap::new()),
            app_hold_guard: None,
        }
    }
}

impl GtkThreadState {
    pub fn with<F, R>(f: F) -> R
    where
        F: FnOnce(&mut GtkThreadState) -> R,
    {
        thread_local! {
            static STATE: RefCell<GtkThreadState> = RefCell::new(GtkThreadState::default());
        }

        STATE.with(|state| f(&mut state.borrow_mut()))
    }

    pub fn get_library(&mut self, name: &str) -> anyhow::Result<&Library> {
        match self.libraries.entry(name.to_string()) {
            Entry::Occupied(entry) => Ok(entry.into_mut()),
            Entry::Vacant(entry) => {
                let lib_names: Vec<&str> = name.split(',').collect();
                let mut last_error = None;

                for lib_name in &lib_names {
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


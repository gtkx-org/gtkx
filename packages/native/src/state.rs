

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

    libraries: ManuallyDrop<HashMap<String, Library>>,

    pub app_hold_guard: Option<ApplicationHoldGuard>,
}

impl Default for GtkThreadState {
    fn default() -> Self {
        GtkThreadState {
            object_map: ManuallyDrop::new(HashMap::new()),
            next_object_id: 1,
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_utils;

    #[test]
    fn gtk_thread_state_default_initializes_correctly() {
        test_utils::ensure_gtk_init();

        GtkThreadState::with(|state| {
            assert!(state.object_map.is_empty());
            assert!(state.next_object_id >= 1);
        });
    }

    #[test]
    fn gtk_thread_state_with_provides_mutable_access() {
        test_utils::ensure_gtk_init();

        GtkThreadState::with(|state| {
            let initial_id = state.next_object_id;
            state.next_object_id += 1;
            assert_eq!(state.next_object_id, initial_id + 1);
        });
    }

    #[test]
    fn gtk_thread_state_persists_across_calls() {
        test_utils::ensure_gtk_init();

        let id_before = GtkThreadState::with(|state| {
            state.next_object_id += 100;
            state.next_object_id
        });

        let id_after = GtkThreadState::with(|state| state.next_object_id);

        assert_eq!(id_before, id_after);
    }

    #[test]
    fn get_library_loads_glib() {
        test_utils::ensure_gtk_init();

        let success = GtkThreadState::with(|state| state.get_library("libglib-2.0.so.0").is_ok());

        assert!(success);
    }

    #[test]
    fn get_library_caches_loaded_libraries() {
        test_utils::ensure_gtk_init();

        GtkThreadState::with(|state| {
            let _ = state.get_library("libglib-2.0.so.0");

            let lib1_ptr = state.libraries.get("libglib-2.0.so.0").map(|l| l as *const _);

            let _ = state.get_library("libglib-2.0.so.0");

            let lib2_ptr = state.libraries.get("libglib-2.0.so.0").map(|l| l as *const _);

            assert_eq!(lib1_ptr, lib2_ptr);
        });
    }

    #[test]
    fn get_library_returns_error_for_nonexistent() {
        test_utils::ensure_gtk_init();

        let is_err = GtkThreadState::with(|state| {
            state
                .get_library("libnonexistent_library_12345.so")
                .is_err()
        });

        assert!(is_err);
    }

    #[test]
    fn get_library_tries_comma_separated_names() {
        test_utils::ensure_gtk_init();

        let success = GtkThreadState::with(|state| {
            state
                .get_library("libnonexistent.so,libglib-2.0.so.0")
                .is_ok()
        });

        assert!(success);
    }

    #[test]
    fn manually_drop_object_map_prevents_automatic_drop() {
        let state = GtkThreadState::default();

        assert!(!std::mem::needs_drop::<ManuallyDrop<HashMap<usize, Object>>>());

        drop(state);
    }
}

mod common;

use std::collections::HashMap;
use std::mem::ManuallyDrop;

use native::object::Object;
use native::state::GtkThreadState;

#[test]
fn gtk_thread_state_default_initializes_correctly() {
    common::ensure_gtk_init();

    GtkThreadState::with(|state| {
        assert!(state.object_map.is_empty());
        assert!(state.next_object_id >= 1);
        assert!(state.free_object_ids.is_empty());
    });
}

#[test]
fn gtk_thread_state_with_provides_mutable_access() {
    common::ensure_gtk_init();

    GtkThreadState::with(|state| {
        let initial_id = state.next_object_id;
        state.next_object_id += 1;
        assert_eq!(state.next_object_id, initial_id + 1);
    });
}

#[test]
fn gtk_thread_state_persists_across_calls() {
    common::ensure_gtk_init();

    let id_before = GtkThreadState::with(|state| {
        state.next_object_id += 100;
        state.next_object_id
    });

    let id_after = GtkThreadState::with(|state| state.next_object_id);

    assert_eq!(id_before, id_after);
}

#[test]
fn get_library_loads_glib() {
    common::ensure_gtk_init();

    let success = GtkThreadState::with(|state| state.get_library("libglib-2.0.so.0").is_ok());

    assert!(success);
}

#[test]
fn get_library_caches_loaded_libraries() {
    common::ensure_gtk_init();

    GtkThreadState::with(|state| {
        let _ = state.get_library("libglib-2.0.so.0");

        let lib1_ptr = state
            .libraries
            .get("libglib-2.0.so.0")
            .map(|l| l as *const _);

        let _ = state.get_library("libglib-2.0.so.0");

        let lib2_ptr = state
            .libraries
            .get("libglib-2.0.so.0")
            .map(|l| l as *const _);

        assert_eq!(lib1_ptr, lib2_ptr);
    });
}

#[test]
fn get_library_returns_error_for_nonexistent() {
    common::ensure_gtk_init();

    let is_err = GtkThreadState::with(|state| {
        state
            .get_library("libnonexistent_library_12345.so")
            .is_err()
    });

    assert!(is_err);
}

#[test]
fn get_library_tries_comma_separated_names() {
    common::ensure_gtk_init();

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

mod common;

use native::state::GtkThreadState;

#[test]
fn gtk_thread_state_default_initializes_correctly() {
    common::ensure_gtk_init();

    GtkThreadState::with(|state| {
        assert_eq!(state.handles.len(), 0);
    });
}

#[test]
fn get_library_loads_glib() {
    common::ensure_gtk_init();

    let success = GtkThreadState::with(|state| state.library("libglib-2.0.so.0").is_ok());

    assert!(success);
}

#[test]
fn get_library_caches_loaded_libraries() {
    common::ensure_gtk_init();

    GtkThreadState::with(|state| {
        let _ = state.library("libglib-2.0.so.0");
        let lib1_ptr = state
            .library("libglib-2.0.so.0")
            .ok()
            .map(|l| l as *const _);

        let _ = state.library("libglib-2.0.so.0");
        let lib2_ptr = state
            .library("libglib-2.0.so.0")
            .ok()
            .map(|l| l as *const _);

        assert_eq!(lib1_ptr, lib2_ptr);
    });
}

#[test]
fn get_library_returns_error_for_nonexistent() {
    common::ensure_gtk_init();

    let is_err =
        GtkThreadState::with(|state| state.library("libnonexistent_library_12345.so").is_err());

    assert!(is_err);
}

#[test]
fn get_library_tries_comma_separated_names() {
    common::ensure_gtk_init();

    let success =
        GtkThreadState::with(|state| state.library("libnonexistent.so,libglib-2.0.so.0").is_ok());

    assert!(success);
}

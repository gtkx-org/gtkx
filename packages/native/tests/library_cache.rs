use test_support as helpers;

use gtk4::glib;

use native::ffi::library_cache::FfiCache;

#[test]
fn ffi_cache_default_is_empty() {
    helpers::run(|| {
        let cache = FfiCache::default();

        assert!(cache.libs.is_empty());
    });
}

#[test]
fn get_library_loads_glib() {
    helpers::run(|| {
        let success = FfiCache::with(|state| state.library("libglib-2.0.so.0").is_ok());

        assert!(success);
    });
}

#[test]
fn get_library_caches_loaded_libraries() {
    helpers::run(|| {
        FfiCache::with(|state| {
            let _ = state.library("libglib-2.0.so.0");
            let lib1_ptr = state
                .library("libglib-2.0.so.0")
                .ok()
                .map(std::ptr::from_ref);

            let _ = state.library("libglib-2.0.so.0");
            let lib2_ptr = state
                .library("libglib-2.0.so.0")
                .ok()
                .map(std::ptr::from_ref);

            assert_eq!(lib1_ptr, lib2_ptr);
        });
    });
}

#[test]
fn get_library_tries_comma_separated_names() {
    helpers::run(|| {
        let success =
            FfiCache::with(|state| state.library("libnonexistent.so,libglib-2.0.so.0").is_ok());

        assert!(success);
    });
}

#[test]
fn library_cache_len_and_is_empty_track_loads() {
    helpers::run(|| {
        FfiCache::with(|state| {
            let before = state.libs.len();
            let _ = state.library("libgobject-2.0.so.0");
            assert!(!state.libs.is_empty());
            assert!(state.libs.len() > before || before > 0);
        });
    });
}

#[test]
fn library_cache_load_total_failure_reports_error() {
    helpers::run(|| {
        let err = FfiCache::with(|state| {
            state
                .library("libnope_one_12345.so,libnope_two_12345.so")
                .err()
                .map(|e| e.to_string())
        });

        let message = err.expect("loading nonexistent libraries should fail");
        assert!(message.contains("Failed to load library"));
    });
}

#[test]
fn resolve_type_resolves_known_get_type_function() {
    helpers::run(|| {
        let type_ =
            FfiCache::with(|state| state.resolve_type("libgtk-4.so.1", "gtk_widget_get_type"));

        let type_ = type_.expect("gtk_widget_get_type should resolve");
        assert_ne!(type_, glib::Type::INVALID);
    });
}

#[test]
fn resolve_type_caches_repeated_resolutions() {
    helpers::run(|| {
        FfiCache::with(|state| {
            let first = state
                .resolve_type("libgtk-4.so.1", "gtk_button_get_type")
                .expect("first resolution should succeed");
            let second = state
                .resolve_type("libgtk-4.so.1", "gtk_button_get_type")
                .expect("cached resolution should succeed");

            assert_ne!(first, glib::Type::INVALID);
            assert_eq!(first, second);
        });
    });
}

#[test]
fn resolve_type_optional_resolves_known_get_type_function() {
    helpers::run(|| {
        let type_ = FfiCache::with(|state| {
            state.resolve_type_optional("libgtk-4.so.1", "gtk_widget_get_type")
        });

        let type_ = type_.expect("resolving a present symbol should succeed");
        assert_ne!(type_, glib::Type::INVALID);
    });
}

#[test]
fn resolve_type_optional_returns_invalid_for_missing_symbol() {
    helpers::run(|| {
        let type_ = FfiCache::with(|state| {
            state.resolve_type_optional("libgio-2.0.so.0", "g_totally_nonexistent_symbol_get_type")
        });

        let type_ = type_.expect("a missing symbol must not error, only yield INVALID");
        assert_eq!(type_, glib::Type::INVALID);
    });
}

#[test]
fn resolve_type_optional_still_errors_when_library_missing() {
    helpers::run(|| {
        let err = FfiCache::with(|state| {
            state
                .resolve_type_optional("libnope_resolve_optional_12345.so", "g_something_get_type")
                .err()
                .map(|e| e.to_string())
        });

        let message = err.expect("a missing library must remain a fatal error");
        assert!(message.contains("Failed to load library"));
    });
}

#[test]
fn lookup_fundamental_fns_resolves_ref_and_unref() {
    helpers::run(|| {
        let resolved = FfiCache::with(|state| {
            state
                .lookup_fundamental_fns("libgobject-2.0.so.0", "g_object_ref", "g_object_unref")
                .map(|(r, u)| (r.is_some(), u.is_some()))
        });

        assert_eq!(resolved.unwrap(), (true, true));
    });
}

#[test]
fn lookup_fundamental_fns_caches_repeated_lookups() {
    helpers::run(|| {
        FfiCache::with(|state| {
            let first = state
                .lookup_fundamental_fns("libgobject-2.0.so.0", "g_object_ref", "g_object_unref")
                .expect("first lookup should succeed");
            let second = state
                .lookup_fundamental_fns("libgobject-2.0.so.0", "g_object_ref", "g_object_unref")
                .expect("cached lookup should succeed");

            assert_eq!(first.0.is_some(), second.0.is_some());
            assert_eq!(first.1.is_some(), second.1.is_some());
        });
    });
}

#[test]
fn lookup_fundamental_fns_keys_cache_by_library() {
    helpers::run(|| {
        FfiCache::with(|state| {
            state
                .lookup_fundamental_fns("libgobject-2.0.so.0", "g_object_ref", "g_object_unref")
                .expect("first lookup should succeed");
            let err = state
                .lookup_fundamental_fns(
                    "libnonexistent_fundamental_cache_test.so",
                    "g_object_ref",
                    "g_object_unref",
                )
                .err()
                .map(|e| e.to_string());

            let message = err.expect("same symbols in another library should miss the cache");
            assert!(message.contains("Failed to load library"));
        });
    });
}

#[test]
fn lookup_fundamental_fns_empty_names_yield_none() {
    helpers::run(|| {
        let resolved = FfiCache::with(|state| {
            state
                .lookup_fundamental_fns("libgobject-2.0.so.0", "", "")
                .map(|(r, u)| (r.is_none(), u.is_none()))
        });

        assert_eq!(resolved.unwrap(), (true, true));
    });
}

#[test]
fn lookup_fundamental_fns_unref_without_ref_errors() {
    helpers::run(|| {
        let err = FfiCache::with(|state| {
            state
                .lookup_fundamental_fns("libgobject-2.0.so.0", "", "g_object_unref")
                .err()
                .map(|e| e.to_string())
        });

        let message = err.expect("unref without ref should fail");
        assert!(message.contains("without a ref function"));
    });
}

mod common;

use native::state::{GlibThread, GlibThreadState, RuntimePhase};

#[test]
fn gtk_thread_state_default_initializes_correctly() {
    common::run(|| {
        GlibThreadState::with(|state| {
            assert!(state.libs.is_empty());
        });
    });
}

#[test]
fn get_library_loads_glib() {
    common::run(|| {
        let success = GlibThreadState::with(|state| state.library("libglib-2.0.so.0").is_ok());

        assert!(success);
    });
}

#[test]
fn get_library_caches_loaded_libraries() {
    common::run(|| {
        GlibThreadState::with(|state| {
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
    });
}

#[test]
fn get_library_returns_error_for_nonexistent() {
    common::run(|| {
        let is_err = GlibThreadState::with(|state| {
            state.library("libnonexistent_library_12345.so").is_err()
        });

        assert!(is_err);
    });
}

#[test]
fn get_library_tries_comma_separated_names() {
    common::run(|| {
        let success = GlibThreadState::with(|state| {
            state.library("libnonexistent.so,libglib-2.0.so.0").is_ok()
        });

        assert!(success);
    });
}

#[test]
fn library_cache_len_and_is_empty_track_loads() {
    common::run(|| {
        GlibThreadState::with(|state| {
            let before = state.libs.len();
            let _ = state.library("libgobject-2.0.so.0");
            assert!(!state.libs.is_empty());
            assert!(state.libs.len() > before || before > 0);
        });
    });
}

#[test]
fn library_cache_load_total_failure_reports_error() {
    common::run(|| {
        let err = GlibThreadState::with(|state| {
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
fn resolve_gtype_resolves_known_get_type_function() {
    common::run(|| {
        let gtype = GlibThreadState::with(|state| {
            state.resolve_gtype("libgtk-4.so.1", "gtk_widget_get_type")
        });

        let gtype = gtype.expect("gtk_widget_get_type should resolve");
        assert_ne!(gtype, gtk4::glib::Type::INVALID);
    });
}

#[test]
fn resolve_gtype_caches_repeated_resolutions() {
    common::run(|| {
        GlibThreadState::with(|state| {
            let first = state
                .resolve_gtype("libgtk-4.so.1", "gtk_button_get_type")
                .expect("first resolution should succeed");
            let second = state
                .resolve_gtype("libgtk-4.so.1", "gtk_button_get_type")
                .expect("cached resolution should succeed");

            assert_ne!(first, gtk4::glib::Type::INVALID);
            assert_eq!(first, second);
        });
    });
}

#[test]
fn resolve_gtype_missing_symbol_returns_error() {
    common::run(|| {
        let err = GlibThreadState::with(|state| {
            state
                .resolve_gtype("libgtk-4.so.1", "no_such_get_type_symbol_12345")
                .err()
                .map(|e| e.to_string())
        });

        let message = err.expect("missing get_type symbol should fail");
        assert!(message.contains("Failed to find symbol"));
    });
}

#[test]
fn lookup_fundamental_fns_resolves_ref_and_unref() {
    common::run(|| {
        let resolved = GlibThreadState::with(|state| {
            state
                .lookup_fundamental_fns("libgobject-2.0.so.0", "g_object_ref", "g_object_unref")
                .map(|(r, u)| (r.is_some(), u.is_some()))
        });

        assert_eq!(resolved.unwrap(), (true, true));
    });
}

#[test]
fn lookup_fundamental_fns_caches_repeated_lookups() {
    common::run(|| {
        GlibThreadState::with(|state| {
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
    common::run(|| {
        GlibThreadState::with(|state| {
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
    common::run(|| {
        let resolved = GlibThreadState::with(|state| {
            state
                .lookup_fundamental_fns("libgobject-2.0.so.0", "", "")
                .map(|(r, u)| (r.is_none(), u.is_none()))
        });

        assert_eq!(resolved.unwrap(), (true, true));
    });
}

#[test]
fn lookup_fundamental_fns_unref_without_ref_errors() {
    common::run(|| {
        let err = GlibThreadState::with(|state| {
            state
                .lookup_fundamental_fns("libgobject-2.0.so.0", "", "g_object_unref")
                .err()
                .map(|e| e.to_string())
        });

        let message = err.expect("unref without ref should fail");
        assert!(message.contains("without a ref function"));
    });
}

#[test]
fn lookup_fundamental_fns_missing_ref_symbol_errors() {
    common::run(|| {
        let err = GlibThreadState::with(|state| {
            state
                .lookup_fundamental_fns(
                    "libgobject-2.0.so.0",
                    "no_such_ref_symbol_12345",
                    "g_object_unref",
                )
                .err()
                .map(|e| e.to_string())
        });

        let message = err.expect("missing ref symbol should fail");
        assert!(message.contains("Failed to find ref symbol"));
    });
}

#[test]
fn lookup_fundamental_fns_missing_unref_symbol_errors() {
    common::run(|| {
        let err = GlibThreadState::with(|state| {
            state
                .lookup_fundamental_fns(
                    "libgobject-2.0.so.0",
                    "g_object_ref",
                    "no_such_unref_symbol_12345",
                )
                .err()
                .map(|e| e.to_string())
        });

        let message = err.expect("missing unref symbol should fail");
        assert!(message.contains("Failed to find unref symbol"));
    });
}

#[test]
fn gtk_thread_state_debug_format() {
    common::run(|| {
        GlibThreadState::with(|state| {
            let debug_str = format!("{state:?}");
            assert!(debug_str.contains("GlibThreadState"));
            assert!(debug_str.contains("libraries_len"));

            let libs_debug = format!("{:?}", state.libs);
            assert!(libs_debug.contains("LibraryCache"));
            assert!(libs_debug.contains("len"));

            let fns_debug = format!("{:?}", state.fundamental_fns);
            assert!(fns_debug.contains("FundamentalFnCache"));
            assert!(fns_debug.contains("len"));
        });
    });
}

#[test]
fn gtk_thread_global_is_stable_singleton() {
    let first = GlibThread::global() as *const GlibThread;
    let second = GlibThread::global() as *const GlibThread;
    assert_eq!(first, second);
}

#[test]
fn gtk_thread_join_without_handle_returns_none() {
    assert!(GlibThread::global().join().is_none());
}

#[test]
fn gtk_thread_set_handle_then_join_collects_thread() {
    let handle = std::thread::spawn(|| {});
    GlibThread::global().set_handle(handle);

    let result = GlibThread::global().join();
    assert!(result.is_none());
}

#[test]
fn gtk_thread_set_handle_replacing_unjoined_handle_keeps_replacement() {
    common::run(|| {
        let previous_hook = std::panic::take_hook();
        std::panic::set_hook(Box::new(|_| {}));
        let first = std::thread::spawn(|| {});
        let second = std::thread::spawn(|| {
            std::panic::panic_any("replacement handle payload");
        });
        GlibThread::global().set_handle(first);
        GlibThread::global().set_handle(second);
        let result = GlibThread::global().join();
        std::panic::set_hook(previous_hook);

        assert_eq!(result.as_deref(), Some("replacement handle payload"));
        assert!(GlibThread::global().join().is_none());
    });
}

#[test]
fn gtk_thread_join_reports_str_panic_payload() {
    common::run(|| {
        let previous_hook = std::panic::take_hook();
        std::panic::set_hook(Box::new(|_| {}));
        let handle = std::thread::spawn(|| {
            std::panic::panic_any("static panic message");
        });
        GlibThread::global().set_handle(handle);
        let result = GlibThread::global().join();
        std::panic::set_hook(previous_hook);

        assert_eq!(result.as_deref(), Some("static panic message"));
    });
}

#[test]
fn gtk_thread_join_reports_string_panic_payload() {
    common::run(|| {
        let previous_hook = std::panic::take_hook();
        std::panic::set_hook(Box::new(|_| {}));
        let handle = std::thread::spawn(|| {
            panic!("{}", String::from("owned panic message"));
        });
        GlibThread::global().set_handle(handle);
        let result = GlibThread::global().join();
        std::panic::set_hook(previous_hook);

        assert_eq!(result.as_deref(), Some("owned panic message"));
    });
}

#[test]
fn gtk_thread_join_reports_unknown_panic_payload() {
    common::run(|| {
        let previous_hook = std::panic::take_hook();
        std::panic::set_hook(Box::new(|_| {}));
        let handle = std::thread::spawn(|| {
            std::panic::panic_any(42_u32);
        });
        GlibThread::global().set_handle(handle);
        let result = GlibThread::global().join();
        std::panic::set_hook(previous_hook);

        assert_eq!(result.as_deref(), Some("unknown panic"));
    });
}

#[test]
fn gtk_thread_debug_format() {
    let debug_str = format!("{:?}", GlibThread::global());
    assert!(debug_str.contains("GlibThread"));
}

#[test]
fn gtk_thread_phase_lifecycle_transitions() {
    common::run(|| {
        let thread = GlibThread::global();
        thread.reset_phase_for_test();

        assert_eq!(thread.phase(), RuntimePhase::New);
        assert!(thread.begin_start().is_ok());
        assert_eq!(thread.phase(), RuntimePhase::Running);

        let double_start = thread.begin_start().expect_err("second init must fail");
        assert!(double_start.contains("already running"));

        assert!(thread.begin_stop().is_ok());
        assert_eq!(thread.phase(), RuntimePhase::Stopped);

        let double_stop = thread.begin_stop().expect_err("second stop must fail");
        assert!(double_stop.contains("already-stopped"));

        let restart = thread
            .begin_start()
            .expect_err("re-init after stop must fail");
        assert!(restart.contains("cannot be reinitialized"));

        thread.reset_phase_for_test();
        assert_eq!(thread.phase(), RuntimePhase::New);
    });
}

#[test]
fn gtk_thread_abort_start_restores_new_phase() {
    common::run(|| {
        let thread = GlibThread::global();
        thread.reset_phase_for_test();

        assert!(thread.begin_start().is_ok());
        thread.abort_start();
        assert_eq!(thread.phase(), RuntimePhase::New);

        assert!(thread.begin_start().is_ok());
        thread.reset_phase_for_test();
    });
}

#[test]
fn gtk_thread_stop_before_init_fails() {
    common::run(|| {
        let thread = GlibThread::global();
        thread.reset_phase_for_test();

        let err = thread.begin_stop().expect_err("stop before init must fail");
        assert!(err.contains("before init"));
    });
}

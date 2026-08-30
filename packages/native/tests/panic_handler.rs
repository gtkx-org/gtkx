use native::host::panic_handler::{format_panic_payload, guard_ffi_boundary};
use test_support as helpers;

fn catch_with_silent_hook<F: FnOnce() + std::panic::UnwindSafe>(f: F) -> std::thread::Result<()> {
    let previous = std::panic::take_hook();
    std::panic::set_hook(Box::new(|_| {}));
    let result = std::panic::catch_unwind(f);
    std::panic::set_hook(previous);
    result
}

#[test]
fn formats_static_str_payload() {
    let result = catch_with_silent_hook(|| {
        std::panic::panic_any("static slice payload");
    });

    let payload = result.expect_err("catch_unwind should capture the panic");
    assert_eq!(format_panic_payload(&*payload), "static slice payload");
}

#[test]
fn formats_owned_string_payload() {
    let result = catch_with_silent_hook(|| {
        panic!("{}", String::from("owned string payload"));
    });

    let payload = result.expect_err("catch_unwind should capture the panic");
    assert_eq!(format_panic_payload(&*payload), "owned string payload");
}

#[test]
fn guard_ffi_boundary_returns_the_body_value() {
    helpers::run(|| {
        assert_eq!(guard_ffi_boundary("ctx", || 42), Some(42));
    });
}

#[test]
fn guard_ffi_boundary_reports_a_panic_and_returns_none() {
    helpers::run(|| {
        let previous = std::panic::take_hook();
        std::panic::set_hook(Box::new(|_| {}));
        let value = guard_ffi_boundary("boundary", || {
            panic!("boom");
        });
        std::panic::set_hook(previous);

        assert!(value.is_none());
        assert!(test_support::napi_mock::count("napi_fatal_exception") >= 1);
    });
}

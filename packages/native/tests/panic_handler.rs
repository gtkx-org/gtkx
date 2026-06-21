mod common;

use std::panic::PanicHookInfo;
use std::sync::{Arc, Mutex};

use native::panic_handler::{format_panic_payload, format_panic_report, install_panic_hook};

type PreviousHook = Box<dyn Fn(&PanicHookInfo<'_>) + Sync + Send>;

fn capture_panic_report() -> (Arc<Mutex<String>>, PreviousHook) {
    let captured = Arc::new(Mutex::new(String::new()));
    let captured_for_hook = captured.clone();

    let previous = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        *captured_for_hook.lock().unwrap() = format_panic_report(info);
    }));

    (captured, previous)
}

#[test]
fn formats_static_str_payload() {
    let previous = std::panic::take_hook();
    std::panic::set_hook(Box::new(|_| {}));
    let result = std::panic::catch_unwind(|| {
        std::panic::panic_any("static slice payload");
    });
    std::panic::set_hook(previous);

    let payload = result.expect_err("catch_unwind should capture the panic");
    assert_eq!(format_panic_payload(&*payload), "static slice payload");
}

#[test]
fn formats_owned_string_payload() {
    let previous = std::panic::take_hook();
    std::panic::set_hook(Box::new(|_| {}));
    let result = std::panic::catch_unwind(|| {
        panic!("{}", String::from("owned string payload"));
    });
    std::panic::set_hook(previous);

    let payload = result.expect_err("catch_unwind should capture the panic");
    assert_eq!(format_panic_payload(&*payload), "owned string payload");
}

#[test]
fn format_panic_report_includes_thread_location_and_message() {
    let (captured, previous) = capture_panic_report();

    let thread_name = "panic_report_thread";
    let handle = std::thread::Builder::new()
        .name(thread_name.to_owned())
        .spawn(|| {
            panic!("formatted panic body");
        })
        .expect("spawn worker thread");
    let _ = handle.join();

    std::panic::set_hook(previous);

    let message = captured.lock().unwrap().clone();
    assert!(
        message.contains(&format!("'{thread_name}'")),
        "message: {message}"
    );
    assert!(
        message.contains("formatted panic body"),
        "message: {message}"
    );
    assert!(message.contains(file!()), "message: {message}");
}

#[test]
fn format_panic_report_uses_unnamed_when_thread_lacks_name() {
    let (captured, previous) = capture_panic_report();

    let handle = std::thread::spawn(|| {
        panic!("anonymous thread panic");
    });
    let _ = handle.join();

    std::panic::set_hook(previous);

    let message = captured.lock().unwrap().clone();
    assert!(message.contains("<unnamed>"), "message: {message}");
}

#[test]
fn install_panic_hook_is_idempotent() {
    install_panic_hook();
    install_panic_hook();

    let previous = std::panic::take_hook();
    std::panic::set_hook(Box::new(|_| {}));
    let result = std::panic::catch_unwind(|| {
        panic!("hook installed twice should not re-stack");
    });
    std::panic::set_hook(previous);

    assert!(result.is_err());
}

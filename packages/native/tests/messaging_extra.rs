use test_support as helpers;

use native::messaging::Mailbox;
use native::messaging::glib_mailbox::GlibThread;
use native::messaging::panic_handler::{
    format_panic_payload, guard_ffi_boundary, install_panic_hook,
};

fn with_silenced_panics<F, R>(body: F) -> R
where
    F: FnOnce() -> R,
{
    let previous = std::panic::take_hook();
    std::panic::set_hook(Box::new(|_| {}));
    let result = body();
    std::panic::set_hook(previous);
    result
}

#[test]
fn guard_ffi_boundary_returns_some_for_successful_body() {
    let outcome = guard_ffi_boundary("codec-decode", || 7_i32 + 5);
    assert_eq!(outcome, Some(12));
}

#[test]
fn guard_ffi_boundary_returns_none_when_body_panics() {
    let _guard = helpers::serial_guard();
    let outcome = with_silenced_panics(|| {
        guard_ffi_boundary::<()>("codec-encode", || panic!("boundary blew up"))
    });
    assert!(outcome.is_none());
}

#[test]
fn format_panic_payload_falls_back_for_non_string_payload() {
    let _guard = helpers::serial_guard();
    let result =
        with_silenced_panics(|| std::panic::catch_unwind(|| std::panic::panic_any(42_u32)));

    let payload = result.expect_err("panic_any should unwind");
    assert_eq!(format_panic_payload(&*payload), "unknown panic");
}

#[test]
fn install_panic_hook_runs_installed_hook_on_panic() {
    let _guard = helpers::serial_guard();
    with_silenced_panics(|| {
        install_panic_hook();
        let outcome = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            panic!("installed hook exercised");
        }));
        assert!(outcome.is_err());
    });
}

#[test]
fn mailbox_default_starts_running_and_supports_freeze_nesting() {
    let mailbox = Mailbox::default();

    assert!(!mailbox.is_not_running());

    assert!(mailbox.freeze());
    assert!(!mailbox.freeze());
    assert!(!mailbox.freeze());

    mailbox.unfreeze();
    mailbox.unfreeze();
    mailbox.unfreeze();

    assert!(mailbox.freeze());
    mailbox.unfreeze();
}

#[test]
fn mailbox_mark_not_running_then_reset_toggles_running_state() {
    let mailbox = Mailbox::new();

    assert!(!mailbox.is_not_running());

    mailbox.mark_not_running();
    assert!(mailbox.is_not_running());

    mailbox.reset_for_test();
    assert!(!mailbox.is_not_running());
}

#[test]
fn mailbox_enter_and_leave_glib_callback_are_balanced() {
    let mailbox = Mailbox::new();

    mailbox.enter_glib_callback();
    mailbox.enter_glib_callback();
    mailbox.leave_glib_callback();
    mailbox.leave_glib_callback();

    assert!(mailbox.freeze());
    mailbox.unfreeze();
}

#[test]
fn glib_thread_default_has_no_main_loop_or_handle() {
    let thread = GlibThread::default();

    assert!(thread.take_main_loop().is_none());
    assert!(thread.join().is_none());
}

#[test]
fn glib_thread_set_handle_then_join_returns_none_for_clean_thread() {
    let thread = GlibThread::default();
    let handle = std::thread::spawn(|| {});

    thread.set_handle(handle);

    assert!(thread.join().is_none());
}

#[test]
fn glib_thread_set_handle_twice_reports_and_join_succeeds() {
    let thread = GlibThread::default();

    thread.set_handle(std::thread::spawn(|| {}));
    thread.set_handle(std::thread::spawn(|| {}));

    assert!(thread.join().is_none());
}

#[test]
fn glib_thread_join_returns_panic_payload() {
    let _guard = helpers::serial_guard();
    let payload = with_silenced_panics(|| {
        let thread = GlibThread::default();
        thread.set_handle(std::thread::spawn(|| panic!("glib worker exploded")));
        thread.join()
    });

    assert_eq!(payload.as_deref(), Some("glib worker exploded"));
}

#[test]
fn glib_thread_global_returns_stable_reference() {
    assert!(std::ptr::eq(GlibThread::global(), GlibThread::global()));
}

use std::cell::{Cell, RefCell};
use std::ffi::c_int;
use std::io::{Read as _, Write as _};
use std::os::fd::AsRawFd;
use std::os::unix::net::UnixStream;
use std::rc::Rc;
use std::thread;
use std::time::Duration;

use gtk4::glib;
use native::messaging::node_env;
use native::runloop;
use test_support::{napi_mock, uv_mock};

const UV_READABLE: c_int = 1;
const UV_WRITABLE: c_int = 2;
const UV_DISCONNECT: c_int = 4;

fn install() {
    runloop::install(&test_support::fake_env()).expect("installing the runloop should succeed");
}

struct TeardownGuard;

impl Drop for TeardownGuard {
    fn drop(&mut self) {
        runloop::teardown();
    }
}

fn run_installed(f: impl FnOnce()) {
    test_support::run(|| {
        install();
        let _guard = TeardownGuard;
        f();
    });
}

#[repr(C)]
struct FdSourceStorage {
    _source: glib::ffi::GSource,
    fd: c_int,
    events: glib::ffi::GIOCondition,
}

unsafe extern "C" fn fd_source_prepare(
    _source: *mut glib::ffi::GSource,
    timeout: *mut c_int,
) -> glib::ffi::gboolean {
    uv_mock::record("glib_source_prepare");
    if !timeout.is_null() {
        unsafe { *timeout = -1 };
    }
    glib::ffi::GFALSE
}

unsafe extern "C" fn fd_source_check(source: *mut glib::ffi::GSource) -> glib::ffi::gboolean {
    uv_mock::record("glib_source_check");
    let storage = unsafe { &*source.cast::<FdSourceStorage>() };
    let mut pfd = glib::ffi::GPollFD {
        fd: storage.fd,
        events: storage.events as u16,
        revents: 0,
    };
    let ready = unsafe { glib::ffi::g_poll(&mut pfd, 1, 0) } > 0
        && u32::from(pfd.revents) & storage.events != 0;
    glib::ffi::gboolean::from(ready)
}

unsafe extern "C" fn fd_source_dispatch(
    _source: *mut glib::ffi::GSource,
    _callback: glib::ffi::GSourceFunc,
    _user_data: glib::ffi::gpointer,
) -> glib::ffi::gboolean {
    uv_mock::record("glib_source_dispatch");
    glib::ffi::GTRUE
}

static FD_SOURCE_FUNCS: glib::ffi::GSourceFuncs = glib::ffi::GSourceFuncs {
    prepare: Some(fd_source_prepare),
    check: Some(fd_source_check),
    dispatch: Some(fd_source_dispatch),
    finalize: None,
    closure_callback: None,
    closure_marshal: None,
};

struct FdWatch {
    source: *mut glib::ffi::GSource,
    tag: glib::ffi::gpointer,
}

impl FdWatch {
    fn new(fd: c_int, events: glib::ffi::GIOCondition) -> Self {
        unsafe {
            let source = glib::ffi::g_source_new(
                std::ptr::from_ref(&FD_SOURCE_FUNCS).cast_mut(),
                size_of::<FdSourceStorage>() as u32,
            );
            (*source.cast::<FdSourceStorage>()).fd = fd;
            (*source.cast::<FdSourceStorage>()).events = events;
            glib::ffi::g_source_set_priority(source, glib::ffi::G_PRIORITY_HIGH);
            let tag = glib::ffi::g_source_add_unix_fd(source, fd, events);
            glib::ffi::g_source_attach(source, glib::ffi::g_main_context_default());
            Self { source, tag }
        }
    }

    fn modify(&self, events: glib::ffi::GIOCondition) {
        unsafe {
            (*self.source.cast::<FdSourceStorage>()).events = events;
            glib::ffi::g_source_modify_unix_fd(self.source, self.tag, events);
        }
    }

    fn destroy(self) {
        unsafe {
            glib::ffi::g_source_destroy(self.source);
            glib::ffi::g_source_unref(self.source);
        }
    }
}

fn watched_socket() -> (UnixStream, UnixStream, c_int, FdWatch) {
    let (left, right) = UnixStream::pair().expect("socket pair");
    let fd = left.as_raw_fd();
    let watch = FdWatch::new(fd, glib::ffi::G_IO_IN);
    (left, right, fd, watch)
}

fn assert_install_calls_recorded_once() {
    assert_eq!(uv_mock::count("uv_prepare_init"), 1);
    assert_eq!(uv_mock::count("uv_timer_init"), 1);
    assert_eq!(uv_mock::count("uv_prepare_start"), 1);
    assert_eq!(napi_mock::count("napi_get_uv_event_loop"), 1);
}

fn napi_calls_since(baseline: usize) -> Vec<String> {
    napi_mock::calls()[baseline..].to_vec()
}

fn assert_immediate_wakeup_armed() {
    assert_eq!(uv_mock::armed_timeout(), Some(0));
    let segments = uv_mock::tick_segments();
    let last_segment = segments.last().expect("the tick should be recorded");
    assert_eq!(
        last_segment.last().map(String::as_str),
        Some("uv_timer_start(0)")
    );
}

fn poll_init_calls_for(fd: c_int) -> usize {
    let ok = format!("uv_poll_init(fd={fd})");
    let err = format!("uv_poll_init(fd={fd})=err");
    uv_mock::calls()
        .iter()
        .filter(|call| **call == ok || **call == err)
        .count()
}

#[test]
fn install_registers_handles_on_the_node_loop_and_is_idempotent() {
    test_support::run(|| {
        assert_eq!(uv_mock::count("uv_prepare_init"), 0);

        install();
        let _guard = TeardownGuard;

        let expected_loop = napi_mock::fake_uv_loop() as usize;

        let prepare = uv_mock::prepare_snapshot().expect("a prepare handle should be live");
        assert_eq!(prepare.loop_ptr, Some(expected_loop));
        assert!(!prepare.referenced);
        assert_eq!(prepare.unref_calls, 1);

        let timer = uv_mock::timer_snapshot().expect("a timer handle should be live");
        assert_eq!(timer.loop_ptr, Some(expected_loop));
        assert!(!timer.referenced);
        assert_eq!(timer.unref_calls, 1);
        assert!(timer.armed_timeout.is_none());
        assert!(timer.timer_starts.is_empty());

        assert_install_calls_recorded_once();

        install();

        assert_install_calls_recorded_once();
    });
}

#[test]
fn teardown_closes_every_handle_exactly_once_and_releases_the_context() {
    test_support::run(|| {
        install();
        assert!(uv_mock::tick());

        let (_left, _right, fd, watch) = watched_socket();
        assert!(uv_mock::tick());
        assert!(uv_mock::poller_snapshot(fd).is_some());
        assert!(glib::MainContext::default().is_owner());

        runloop::teardown();

        let calls = uv_mock::calls();
        let prepare_close = calls
            .iter()
            .position(|call| call == "uv_close(prepare)")
            .expect("the prepare handle should be closed");
        let timer_close = calls
            .iter()
            .position(|call| call == "uv_close(timer)")
            .expect("the timer handle should be closed");
        assert!(prepare_close < timer_close);
        for (position, call) in calls.iter().enumerate() {
            if call.starts_with("uv_close(poll") {
                assert!(position < prepare_close);
            }
        }

        let snapshots = uv_mock::snapshots();
        assert!(!snapshots.is_empty());
        for handle in &snapshots {
            assert_eq!(handle.close_calls, 1);
            assert!(handle.freed);
        }
        assert_eq!(uv_mock::count("uv_close"), snapshots.len());
        assert!(!glib::MainContext::default().is_owner());

        runloop::teardown();
        assert_eq!(uv_mock::count("uv_close"), snapshots.len());

        runloop::set_keep_alive(true);
        assert_eq!(uv_mock::count("uv_ref"), 0);

        watch.destroy();
    });
}

#[test]
fn failed_install_frees_partial_handles_and_permits_retry() {
    test_support::run(|| {
        uv_mock::set_fail_prepare_init(true);
        let err = runloop::install(&test_support::fake_env())
            .expect_err("install should fail when uv_prepare_init fails");
        assert!(err.to_string().contains("uv_prepare_init"));
        assert!(!uv_mock::tick());
        assert!(!glib::MainContext::default().is_owner());
        let snapshots = uv_mock::snapshots();
        assert_eq!(snapshots.len(), 1);
        assert!(snapshots[0].init_failed);
        assert!(snapshots[0].freed);
        assert_eq!(snapshots[0].close_calls, 0);

        uv_mock::reset();
        uv_mock::set_fail_timer_init(true);
        let err = runloop::install(&test_support::fake_env())
            .expect_err("install should fail when uv_timer_init fails");
        assert!(err.to_string().contains("uv_timer_init"));
        assert!(!glib::MainContext::default().is_owner());
        let snapshots = uv_mock::snapshots();
        assert_eq!(snapshots.len(), 2);
        let prepare = &snapshots[0];
        assert_eq!(prepare.kind, Some(uv_mock::HandleKind::Prepare));
        assert_eq!(prepare.close_calls, 1);
        assert!(prepare.freed);
        let timer = &snapshots[1];
        assert!(timer.init_failed);
        assert!(timer.freed);
        assert_eq!(timer.close_calls, 0);

        uv_mock::reset();
        uv_mock::set_fail_prepare_start(true);
        let err = runloop::install(&test_support::fake_env())
            .expect_err("install should fail when uv_prepare_start fails");
        assert!(err.to_string().contains("uv_prepare_start"));
        assert!(!uv_mock::tick());
        assert!(!glib::MainContext::default().is_owner());
        for handle in uv_mock::snapshots() {
            assert_eq!(handle.close_calls, 1);
            assert!(handle.freed);
        }

        uv_mock::reset();
        install();
        let _guard = TeardownGuard;
        assert!(uv_mock::tick());
    });
}

#[test]
fn each_tick_completes_its_prepare_query_check_bracket() {
    run_installed(|| {
        let (_left, _right, _fd, watch) = watched_socket();
        uv_mock::clear_calls();

        for _ in 0..3 {
            assert!(uv_mock::tick());
            assert!(glib::MainContext::default().is_owner());
        }

        let segments = uv_mock::tick_segments();
        assert_eq!(segments.len(), 3);
        for segment in &segments {
            let timer_ops: Vec<&String> = segment
                .iter()
                .filter(|call| call.starts_with("uv_timer_"))
                .collect();
            assert_eq!(timer_ops.len(), 1);
            let last = segment.last().expect("each tick should arm a wakeup");
            assert!(last.starts_with("uv_timer_"));

            let mut bracket_open = false;
            let mut brackets_closed = 0usize;
            for call in segment {
                match call.as_str() {
                    "glib_source_prepare" => {
                        assert!(
                            !bracket_open,
                            "a prepare began before the previous check closed: {segment:?}"
                        );
                        bracket_open = true;
                    }
                    "glib_source_check" => {
                        assert!(
                            bracket_open,
                            "a check ran without a prepare in the same tick: {segment:?}"
                        );
                        bracket_open = false;
                        brackets_closed += 1;
                    }
                    _ => {}
                }
            }
            assert!(
                !bracket_open,
                "a tick left its prepare bracket open: {segment:?}"
            );
            assert!(
                brackets_closed >= 1,
                "each tick should complete a prepare/check bracket: {segment:?}"
            );
        }
        assert!(uv_mock::calls_outside_ticks().is_empty());

        watch.destroy();
    });
}

#[test]
fn first_tick_polls_the_context_wakeup_fd_and_parks_the_timer() {
    run_installed(|| {
        uv_mock::clear_calls();
        assert!(uv_mock::tick());

        let fds = uv_mock::live_poller_fds();
        assert!(!fds.is_empty());
        for fd in fds {
            let poller = uv_mock::poller_snapshot(fd).expect("live poller");
            assert_eq!(poller.poll_events, Some(UV_READABLE));
            assert_eq!(poller.loop_ptr, Some(napi_mock::fake_uv_loop() as usize));
            assert!(!poller.referenced);
        }

        let segments = uv_mock::tick_segments();
        assert_eq!(
            segments[0].last().map(String::as_str),
            Some("uv_timer_stop")
        );
        assert!(uv_mock::armed_timeout().is_none());
    });
}

#[test]
fn arm_timer_parks_when_idle_and_follows_finite_timeouts() {
    run_installed(|| {
        assert!(uv_mock::tick());
        assert!(uv_mock::armed_timeout().is_none());

        let long = glib::timeout_add_local(Duration::from_secs(60), || glib::ControlFlow::Continue);
        assert!(uv_mock::tick());
        let t1 = uv_mock::armed_timeout().expect("a finite timeout should arm the timer");
        assert!(t1 > 0);
        assert!(t1 <= 60_000);

        let short =
            glib::timeout_add_local(Duration::from_secs(30), || glib::ControlFlow::Continue);
        assert!(uv_mock::tick());
        let t2 = uv_mock::armed_timeout().expect("the nearer timeout should arm the timer");
        assert!(t2 <= 30_000);
        assert!(t2 < t1);

        short.remove();
        assert!(uv_mock::tick());
        let t3 = uv_mock::armed_timeout().expect("the remaining timeout should arm the timer");
        assert!(t3 > t2);

        long.remove();
        assert!(uv_mock::tick());
        assert!(uv_mock::armed_timeout().is_none());
    });
}

#[test]
fn arm_timer_fires_immediately_while_sources_stay_ready() {
    run_installed(|| {
        let invocations = Rc::new(Cell::new(0usize));
        let counter = Rc::clone(&invocations);
        let ready = glib::source::idle_add_local_full(glib::Priority::DEFAULT, move || {
            counter.set(counter.get() + 1);
            glib::ControlFlow::Continue
        });

        assert!(uv_mock::tick());
        assert!(invocations.get() > 0);
        assert_immediate_wakeup_armed();

        ready.remove();
        assert!(uv_mock::tick());
        assert!(uv_mock::armed_timeout().is_none());
    });
}

#[test]
fn readiness_discovered_by_check_arms_an_immediate_wakeup() {
    run_installed(|| {
        let (left, right, _fd, watch) = watched_socket();
        assert!(uv_mock::tick());
        assert!(uv_mock::armed_timeout().is_none());

        (&right)
            .write_all(b"x")
            .expect("writing to the watched socket should succeed");
        assert!(uv_mock::tick());
        assert_immediate_wakeup_armed();

        let mut drained = [0u8; 1];
        (&left)
            .read_exact(&mut drained)
            .expect("draining the watched socket should succeed");
        assert!(uv_mock::tick());
        assert!(uv_mock::armed_timeout().is_none());

        watch.destroy();
        assert!(uv_mock::tick());
    });
}

#[test]
fn hup_only_watch_gets_a_disconnect_poller_and_dispatches_on_writer_close() {
    run_installed(|| {
        let (reader, writer) = std::io::pipe().expect("pipe");
        let fd = reader.as_raw_fd();
        let watch = FdWatch::new(fd, glib::ffi::G_IO_HUP);

        assert!(uv_mock::tick());
        let poller = uv_mock::poller_snapshot(fd).expect("a poller should watch the HUP-only fd");
        assert_eq!(poller.poll_events, Some(UV_DISCONNECT));
        assert!(uv_mock::armed_timeout().is_none());
        assert_eq!(uv_mock::count("glib_source_dispatch"), 0);

        drop(writer);
        assert!(uv_mock::tick());
        assert!(uv_mock::count("glib_source_dispatch") >= 1);
        assert_immediate_wakeup_armed();

        watch.destroy();
        assert!(uv_mock::tick());
        assert!(uv_mock::poller_snapshot(fd).is_none());
        drop(reader);
    });
}

#[test]
fn timer_arm_failure_is_reported_without_crashing() {
    run_installed(|| {
        let long = glib::timeout_add_local(Duration::from_secs(60), || glib::ControlFlow::Continue);
        let fatal_before = napi_mock::count("napi_fatal_exception");

        uv_mock::set_fail_timer_start(true);
        assert!(uv_mock::tick());
        assert!(uv_mock::armed_timeout().is_none());
        assert_eq!(napi_mock::count("napi_fatal_exception"), fatal_before + 1);

        uv_mock::set_fail_timer_start(false);
        assert!(uv_mock::tick());
        let armed = uv_mock::armed_timeout().expect("the timer should recover");
        assert!(armed > 0);

        long.remove();
        assert!(uv_mock::tick());
    });
}

#[test]
fn pollers_track_new_updated_and_vanished_fds() {
    run_installed(|| {
        assert!(uv_mock::tick());
        let baseline = uv_mock::live_poller_fds();

        let (_left, _right, fd, watch) = watched_socket();
        assert!(uv_mock::tick());
        let poller = uv_mock::poller_snapshot(fd).expect("a poller should track the new fd");
        assert_eq!(poller.poll_events, Some(UV_READABLE));
        assert_eq!(poller.loop_ptr, Some(napi_mock::fake_uv_loop() as usize));
        assert!(!poller.referenced);
        assert_eq!(poll_init_calls_for(fd), 1);
        let poller_id = poller.id;

        watch.modify(glib::ffi::G_IO_IN | glib::ffi::G_IO_OUT);
        assert!(uv_mock::tick());
        let poller = uv_mock::poller_snapshot(fd).expect("the poller should survive an update");
        assert_eq!(poller.id, poller_id);
        assert_eq!(poller.poll_events, Some(UV_READABLE | UV_WRITABLE));
        assert_eq!(poll_init_calls_for(fd), 1);

        watch.modify(glib::ffi::G_IO_OUT);
        assert!(uv_mock::tick());
        let poller = uv_mock::poller_snapshot(fd).expect("the poller should survive an update");
        assert_eq!(poller.id, poller_id);
        assert_eq!(poller.poll_events, Some(UV_WRITABLE));
        assert_eq!(poll_init_calls_for(fd), 1);

        watch.destroy();
        assert!(uv_mock::tick());
        assert!(uv_mock::poller_snapshot(fd).is_none());
        let closed = uv_mock::snapshots()
            .into_iter()
            .find(|handle| handle.id == poller_id)
            .expect("the poller record should remain");
        assert_eq!(closed.close_calls, 1);
        assert!(closed.freed);
        assert_eq!(uv_mock::live_poller_fds(), baseline);
    });
}

#[test]
fn rejected_poll_fd_degrades_to_immediate_wakeup_and_recovers() {
    run_installed(|| {
        assert!(uv_mock::tick());

        let (left, _right) = UnixStream::pair().expect("socket pair");
        let fd = left.as_raw_fd();

        uv_mock::set_fail_poll_init(fd, true);
        let watch = FdWatch::new(fd, glib::ffi::G_IO_IN);
        assert!(uv_mock::tick());
        assert!(uv_mock::poller_snapshot(fd).is_none());
        assert_eq!(uv_mock::armed_timeout(), Some(0));
        assert_eq!(poll_init_calls_for(fd), 1);
        let rejected = uv_mock::snapshots()
            .into_iter()
            .find(|handle| handle.fd == Some(fd))
            .expect("the rejected handle should be recorded");
        assert!(rejected.init_failed);
        assert!(rejected.freed);
        assert_eq!(rejected.close_calls, 0);
        assert!(rejected.poll_events.is_none());

        assert!(uv_mock::tick());
        assert_eq!(poll_init_calls_for(fd), 2);
        assert_eq!(uv_mock::armed_timeout(), Some(0));

        uv_mock::set_fail_poll_init(fd, false);
        assert!(uv_mock::tick());
        let poller = uv_mock::poller_snapshot(fd).expect("the fd should be retried and adopted");
        assert_eq!(poller.poll_events, Some(UV_READABLE));
        assert!(uv_mock::armed_timeout().is_none());
        let adopted_id = poller.id;

        uv_mock::set_fail_poll_start(fd, true);
        assert!(uv_mock::tick());
        assert!(uv_mock::poller_snapshot(fd).is_none());
        assert_eq!(uv_mock::armed_timeout(), Some(0));
        let dropped = uv_mock::snapshots()
            .into_iter()
            .find(|handle| handle.id == adopted_id)
            .expect("the dropped poller record should remain");
        assert_eq!(dropped.close_calls, 1);
        assert!(dropped.freed);

        uv_mock::set_fail_poll_start(fd, false);
        assert!(uv_mock::tick());
        let poller = uv_mock::poller_snapshot(fd).expect("the fd should be re-registered");
        assert_ne!(poller.id, adopted_id);
        assert_eq!(poller.poll_events, Some(UV_READABLE));
        assert!(uv_mock::armed_timeout().is_none());

        watch.destroy();
        assert!(uv_mock::tick());
        assert!(uv_mock::poller_snapshot(fd).is_none());
    });
}

#[test]
fn dispatch_honors_the_budget_and_resumes_on_the_next_tick() {
    run_installed(|| {
        let order = Rc::new(RefCell::new(Vec::new()));
        let priorities = [
            glib::Priority::HIGH,
            glib::Priority::DEFAULT,
            glib::Priority::HIGH_IDLE,
            glib::Priority::DEFAULT_IDLE,
            glib::Priority::LOW,
        ];
        let budget_exceeding_index = 2;
        for (index, priority) in priorities.into_iter().enumerate() {
            let order = Rc::clone(&order);
            glib::source::idle_add_local_full(priority, move || {
                if index == budget_exceeding_index {
                    thread::sleep(Duration::from_millis(10));
                }
                order.borrow_mut().push(index);
                glib::ControlFlow::Break
            });
        }

        assert!(uv_mock::tick());
        assert_eq!(*order.borrow(), vec![0, 1, 2]);
        assert_eq!(uv_mock::armed_timeout(), Some(0));

        assert!(uv_mock::tick());
        assert_eq!(*order.borrow(), vec![0, 1, 2, 3, 4]);
        assert!(uv_mock::armed_timeout().is_none());
    });
}

#[test]
fn set_keep_alive_toggles_the_prepare_handle_reference() {
    test_support::run(|| {
        runloop::set_keep_alive(true);
        assert_eq!(uv_mock::count("uv_ref"), 0);

        install();

        runloop::set_keep_alive(true);
        let prepare = uv_mock::prepare_snapshot().expect("prepare handle");
        assert!(prepare.referenced);
        assert_eq!(prepare.ref_calls, 1);

        runloop::set_keep_alive(true);
        let prepare = uv_mock::prepare_snapshot().expect("prepare handle");
        assert!(prepare.referenced);
        assert_eq!(prepare.ref_calls, 2);

        runloop::set_keep_alive(false);
        let prepare = uv_mock::prepare_snapshot().expect("prepare handle");
        assert!(!prepare.referenced);
        assert_eq!(prepare.unref_calls, 2);

        runloop::set_keep_alive(false);
        let prepare = uv_mock::prepare_snapshot().expect("prepare handle");
        assert!(!prepare.referenced);
        assert_eq!(prepare.unref_calls, 3);

        let timer = uv_mock::timer_snapshot().expect("timer handle");
        assert_eq!(timer.ref_calls, 0);
        assert_eq!(timer.unref_calls, 1);
        for call in uv_mock::calls() {
            if call.starts_with("uv_ref(") {
                assert_eq!(call, "uv_ref(prepare)");
            }
        }

        runloop::teardown();
        let refs_after_teardown = uv_mock::count("uv_ref");
        runloop::set_keep_alive(true);
        assert_eq!(uv_mock::count("uv_ref"), refs_after_teardown);
    });
}

#[test]
fn teardown_during_dispatch_stops_the_tick_cleanly() {
    test_support::run(|| {
        install();
        assert!(uv_mock::tick());
        uv_mock::clear_calls();

        glib::source::idle_add_local_full(glib::Priority::DEFAULT, || {
            runloop::teardown();
            glib::ControlFlow::Break
        });

        assert!(uv_mock::tick());

        let segments = uv_mock::tick_segments();
        assert_eq!(segments.len(), 1);
        let segment = &segments[0];
        assert!(segment.iter().any(|call| call == "uv_close(prepare)"));
        assert!(segment.iter().any(|call| call == "uv_close(timer)"));
        assert!(!segment.iter().any(|call| call.starts_with("uv_timer_")));

        for handle in uv_mock::snapshots() {
            assert_eq!(handle.close_calls, 1);
            assert!(handle.freed);
        }
        assert!(!glib::MainContext::default().is_owner());

        assert!(!uv_mock::tick());
        runloop::teardown();
        assert_eq!(uv_mock::tick_segments().len(), 1);
    });
}

#[test]
fn install_wires_the_glib_log_writer() {
    run_installed(|| {
        let before = napi_mock::count("napi_fatal_exception");
        glib::log_structured!(
            "gtkx-test",
            glib::LogLevel::Critical,
            {
                "MESSAGE" => "a critical after runloop install";
            }
        );
        assert_eq!(napi_mock::count("napi_fatal_exception"), before + 1);
    });
}

#[test]
fn dispatch_scope_orders_scopes_and_routes_pending_exceptions() {
    test_support::run(|| {
        let exception = napi_mock::fake_string("dispatch failure");
        let baseline = napi_mock::calls().len();

        node_env::run_dispatch_scope(|| {
            napi_mock::set_pending_exception(exception);
        });

        assert_eq!(
            napi_calls_since(baseline),
            [
                "napi_open_handle_scope",
                "napi_get_reference_value",
                "napi_open_callback_scope",
                "napi_is_exception_pending",
                "napi_get_and_clear_last_exception",
                "napi_fatal_exception",
                "napi_close_callback_scope",
                "napi_close_handle_scope",
            ]
        );
        assert_eq!(napi_mock::fatal_exceptions(), vec![exception]);
        assert!(napi_mock::pending_exception().is_none());

        let baseline = napi_mock::calls().len();
        node_env::run_dispatch_scope(|| {});
        assert_eq!(
            napi_calls_since(baseline),
            [
                "napi_open_handle_scope",
                "napi_get_reference_value",
                "napi_open_callback_scope",
                "napi_is_exception_pending",
                "napi_close_callback_scope",
                "napi_close_handle_scope",
            ]
        );
        assert_eq!(napi_mock::fatal_exceptions().len(), 1);
    });
}

use std::alloc::{Layout, alloc_zeroed, dealloc};
use std::cell::{Cell, RefCell};
use std::collections::HashMap;
use std::collections::hash_map::Entry;
use std::ffi::c_void;
use std::os::raw::c_int;
use std::time::{Duration, Instant};

use glib::ffi::{
    G_IO_ERR, G_IO_HUP, G_IO_IN, G_IO_OUT, G_IO_PRI, GFALSE, GMainContext, GPollFD,
    g_main_context_check, g_main_context_default, g_main_context_iteration, g_main_context_prepare,
    g_main_context_query, g_main_context_release,
};
use libloading::os::unix::Library;
use napi::Env;

use crate::messaging::error_reporter::ErrorReporter;
use crate::messaging::log_writer;

const UV_POLL: c_int = 8;
const UV_PREPARE: c_int = 9;
const UV_TIMER: c_int = 13;

const UV_READABLE: c_int = 1;
const UV_WRITABLE: c_int = 2;
const UV_DISCONNECT: c_int = 4;
const UV_PRIORITIZED: c_int = 8;

const HANDLE_ALIGN: usize = 16;

const DISPATCH_BUDGET: Duration = Duration::from_millis(4);

type UvVoidCb = unsafe extern "C" fn(*mut c_void);
type UvPollCb = unsafe extern "C" fn(*mut c_void, c_int, c_int);

#[derive(Clone, Copy)]
struct UvApi {
    handle_size: unsafe extern "C" fn(c_int) -> usize,
    handle_set_data: unsafe extern "C" fn(*mut c_void, *mut c_void),
    handle_get_data: unsafe extern "C" fn(*const c_void) -> *mut c_void,
    reference: unsafe extern "C" fn(*mut c_void),
    unreference: unsafe extern "C" fn(*mut c_void),
    close: unsafe extern "C" fn(*mut c_void, Option<UvVoidCb>),
    prepare_init: unsafe extern "C" fn(*mut c_void, *mut c_void) -> c_int,
    prepare_start: unsafe extern "C" fn(*mut c_void, UvVoidCb) -> c_int,
    timer_init: unsafe extern "C" fn(*mut c_void, *mut c_void) -> c_int,
    timer_start: unsafe extern "C" fn(*mut c_void, UvVoidCb, u64, u64) -> c_int,
    timer_stop: unsafe extern "C" fn(*mut c_void) -> c_int,
    poll_init: unsafe extern "C" fn(*mut c_void, *mut c_void, c_int) -> c_int,
    poll_start: unsafe extern "C" fn(*mut c_void, c_int, UvPollCb) -> c_int,
}

impl UvApi {
    fn load() -> Result<Self, libloading::Error> {
        let lib = Library::this();
        let api = unsafe {
            Self {
                handle_size: *lib.get(b"uv_handle_size")?,
                handle_set_data: *lib.get(b"uv_handle_set_data")?,
                handle_get_data: *lib.get(b"uv_handle_get_data")?,
                reference: *lib.get(b"uv_ref")?,
                unreference: *lib.get(b"uv_unref")?,
                close: *lib.get(b"uv_close")?,
                prepare_init: *lib.get(b"uv_prepare_init")?,
                prepare_start: *lib.get(b"uv_prepare_start")?,
                timer_init: *lib.get(b"uv_timer_init")?,
                timer_start: *lib.get(b"uv_timer_start")?,
                timer_stop: *lib.get(b"uv_timer_stop")?,
                poll_init: *lib.get(b"uv_poll_init")?,
                poll_start: *lib.get(b"uv_poll_start")?,
            }
        };
        std::mem::forget(lib);
        Ok(api)
    }
}

thread_local! {
    static UV_API: Cell<Option<UvApi>> = const { Cell::new(None) };
    static GTK_LOOP: RefCell<Option<GtkLoop>> = const { RefCell::new(None) };
}

fn uv() -> UvApi {
    UV_API
        .with(Cell::get)
        .expect("uv API accessed before the runloop was installed")
}

struct HandleData {
    size: usize,
}

unsafe fn handle_layout(size: usize) -> Layout {
    Layout::from_size_align(size, HANDLE_ALIGN).expect("uv handle layout")
}

fn alloc_uv_handle(htype: c_int) -> *mut c_void {
    let size = unsafe { (uv().handle_size)(htype) };
    let ptr = unsafe { alloc_zeroed(handle_layout(size)) } as *mut c_void;
    let data = Box::into_raw(Box::new(HandleData { size }));
    unsafe { (uv().handle_set_data)(ptr, data.cast()) };
    ptr
}

unsafe fn free_uv_handle(handle: *mut c_void) {
    let data_ptr = unsafe { (uv().handle_get_data)(handle) } as *mut HandleData;
    if data_ptr.is_null() {
        return;
    }
    let data = unsafe { Box::from_raw(data_ptr) };
    unsafe { dealloc(handle as *mut u8, handle_layout(data.size)) };
}

unsafe extern "C" fn on_close(handle: *mut c_void) {
    unsafe { free_uv_handle(handle) };
}

fn close_uv_handle(handle: *mut c_void) {
    unsafe { (uv().close)(handle, Some(on_close)) };
}

fn glib_events_to_uv(events: u16) -> c_int {
    let events = u32::from(events);
    let mut result = 0;
    if events & G_IO_IN != 0 {
        result |= UV_READABLE;
    }
    if events & G_IO_OUT != 0 {
        result |= UV_WRITABLE;
    }
    if events & (G_IO_HUP | G_IO_ERR) != 0 {
        result |= UV_DISCONNECT;
    }
    if events & G_IO_PRI != 0 {
        result |= UV_PRIORITIZED;
    }
    result
}

fn desired_uv_events(fds: &[GPollFD]) -> HashMap<c_int, c_int> {
    let mut desired = HashMap::new();
    for pfd in fds {
        *desired.entry(pfd.fd).or_insert(0) |= glib_events_to_uv(pfd.events);
    }
    for uv_events in desired.values_mut() {
        if *uv_events == 0 {
            *uv_events = UV_DISCONNECT;
        }
    }
    desired
}

#[derive(Debug, PartialEq, Eq)]
enum Wakeup {
    Now,
    In(u64),
    Idle,
}

fn wakeup_for(timeout: c_int, sources_ready: bool, has_unwatchable_fds: bool) -> Wakeup {
    if sources_ready || has_unwatchable_fds || timeout == 0 {
        Wakeup::Now
    } else if timeout < 0 {
        Wakeup::Idle
    } else {
        Wakeup::In(timeout as u64)
    }
}

struct GtkLoop {
    uv_loop: *mut c_void,
    ctx: *mut GMainContext,
    prepare: *mut c_void,
    timer: *mut c_void,
    pollers: HashMap<c_int, *mut c_void>,
    fds: Vec<GPollFD>,
    n_fds: usize,
}

impl GtkLoop {
    fn arm_wakeups(&mut self) {
        let mut max_priority: c_int = 0;
        let prepared_ready = unsafe { g_main_context_prepare(self.ctx, &mut max_priority) } != 0;

        let mut timeout: c_int = -1;
        loop {
            let capacity = self.fds.len() as c_int;
            let needed = unsafe {
                g_main_context_query(
                    self.ctx,
                    max_priority,
                    &mut timeout,
                    self.fds.as_mut_ptr(),
                    capacity,
                )
            };
            if needed <= capacity {
                self.n_fds = needed.max(0) as usize;
                break;
            }
            self.fds.resize(
                needed as usize,
                GPollFD {
                    fd: 0,
                    events: 0,
                    revents: 0,
                },
            );
        }

        for pfd in &mut self.fds[..self.n_fds] {
            pfd.revents = 0;
        }

        let check_ready = unsafe {
            g_main_context_check(
                self.ctx,
                max_priority,
                self.fds.as_mut_ptr(),
                self.n_fds as c_int,
            )
        } != 0;

        let has_unwatchable_fds = self.reconcile_pollers();
        self.arm_timer(wakeup_for(
            timeout,
            prepared_ready || check_ready,
            has_unwatchable_fds,
        ));
    }

    fn reconcile_pollers(&mut self) -> bool {
        let uv = uv();
        let desired = desired_uv_events(&self.fds[..self.n_fds]);

        let stale: Vec<c_int> = self
            .pollers
            .keys()
            .copied()
            .filter(|fd| !desired.contains_key(fd))
            .collect();
        for fd in stale {
            if let Some(handle) = self.pollers.remove(&fd) {
                close_uv_handle(handle);
            }
        }

        let mut has_unwatchable_fds = false;
        for (fd, uv_events) in desired {
            let handle = match self.pollers.entry(fd) {
                Entry::Occupied(entry) => *entry.get(),
                Entry::Vacant(entry) => {
                    let handle = alloc_uv_handle(UV_POLL);
                    if unsafe { (uv.poll_init)(self.uv_loop, handle, fd) } != 0 {
                        unsafe { free_uv_handle(handle) };
                        has_unwatchable_fds = true;
                        continue;
                    }
                    unsafe { (uv.unreference)(handle) };
                    *entry.insert(handle)
                }
            };
            if unsafe { (uv.poll_start)(handle, uv_events, on_poll) } != 0 {
                self.pollers.remove(&fd);
                close_uv_handle(handle);
                has_unwatchable_fds = true;
            }
        }
        has_unwatchable_fds
    }

    fn arm_timer(&self, wakeup: Wakeup) {
        let uv = uv();
        let rc = match wakeup {
            Wakeup::Now => unsafe { (uv.timer_start)(self.timer, on_timer, 0, 0) },
            Wakeup::In(delay) => unsafe { (uv.timer_start)(self.timer, on_timer, delay, 0) },
            Wakeup::Idle => unsafe { (uv.timer_stop)(self.timer) },
        };
        if rc != 0 {
            ErrorReporter::global().report_str(&format!(
                "libuv failed to arm the GLib wakeup timer (uv error {rc})"
            ));
        }
    }
}

unsafe extern "C" fn on_prepare(_handle: *mut c_void) {
    let Some(ctx) = GTK_LOOP.with_borrow(|slot| slot.as_ref().map(|state| state.ctx)) else {
        return;
    };

    let deadline = Instant::now() + DISPATCH_BUDGET;
    loop {
        let mut dispatched = false;
        crate::messaging::node_env::run_dispatch_scope(|| {
            dispatched = unsafe { g_main_context_iteration(ctx, GFALSE) } != 0;
        });
        if !dispatched || Instant::now() >= deadline || GTK_LOOP.with_borrow(Option::is_none) {
            break;
        }
    }

    GTK_LOOP.with_borrow_mut(|slot| {
        if let Some(state) = slot.as_mut() {
            state.arm_wakeups();
        }
    });
}

unsafe extern "C" fn on_timer(_handle: *mut c_void) {}

unsafe extern "C" fn on_poll(_handle: *mut c_void, _status: c_int, _events: c_int) {}

pub fn install(env: &Env) -> napi::Result<()> {
    if GTK_LOOP.with_borrow(Option::is_some) {
        return Ok(());
    }

    log_writer::install();

    let uv = UvApi::load().map_err(|err| {
        napi::Error::new(
            napi::Status::GenericFailure,
            format!("Failed to resolve libuv symbols from the Node process: {err}"),
        )
    })?;
    UV_API.with(|slot| slot.set(Some(uv)));

    let uv_loop = env.get_uv_event_loop()?.cast::<c_void>();
    let ctx = unsafe { g_main_context_default() };

    if unsafe { glib::ffi::g_main_context_acquire(ctx) } == 0 {
        return Err(napi::Error::new(
            napi::Status::GenericFailure,
            "Failed to acquire the default GLib main context on the Node thread",
        ));
    }

    let prepare = alloc_uv_handle(UV_PREPARE);
    let rc = unsafe { (uv.prepare_init)(uv_loop, prepare) };
    if rc != 0 {
        unsafe { free_uv_handle(prepare) };
        return Err(fail_install(ctx, &[], "uv_prepare_init", rc));
    }

    let timer = alloc_uv_handle(UV_TIMER);
    let rc = unsafe { (uv.timer_init)(uv_loop, timer) };
    if rc != 0 {
        unsafe { free_uv_handle(timer) };
        return Err(fail_install(ctx, &[prepare], "uv_timer_init", rc));
    }

    let rc = unsafe { (uv.prepare_start)(prepare, on_prepare) };
    if rc != 0 {
        return Err(fail_install(ctx, &[prepare, timer], "uv_prepare_start", rc));
    }

    unsafe {
        (uv.unreference)(prepare);
        (uv.unreference)(timer);
    }

    GTK_LOOP.with(|slot| {
        *slot.borrow_mut() = Some(GtkLoop {
            uv_loop,
            ctx,
            prepare,
            timer,
            pollers: HashMap::new(),
            fds: vec![
                GPollFD {
                    fd: 0,
                    events: 0,
                    revents: 0
                };
                8
            ],
            n_fds: 0,
        });
    });

    Ok(())
}

fn fail_install(
    ctx: *mut GMainContext,
    initialized: &[*mut c_void],
    call: &str,
    rc: c_int,
) -> napi::Error {
    for &handle in initialized {
        close_uv_handle(handle);
    }
    unsafe { g_main_context_release(ctx) };
    napi::Error::new(
        napi::Status::GenericFailure,
        format!("{call} failed while installing the GLib runloop (uv error {rc})"),
    )
}

pub fn set_keep_alive(enable: bool) {
    GTK_LOOP.with_borrow(|slot| {
        if let Some(state) = slot.as_ref() {
            let uv = uv();
            unsafe {
                if enable {
                    (uv.reference)(state.prepare);
                } else {
                    (uv.unreference)(state.prepare);
                }
            }
        }
    });
}

pub fn teardown() {
    let ctx = GTK_LOOP.with_borrow_mut(|slot| {
        let state = slot.take()?;
        for handle in state.pollers.into_values() {
            close_uv_handle(handle);
        }
        close_uv_handle(state.prepare);
        close_uv_handle(state.timer);
        Some(state.ctx)
    });

    let Some(ctx) = ctx else {
        return;
    };

    unsafe { g_main_context_release(ctx) };
}

#[cfg(test)]
mod tests {
    use super::*;

    fn pfd(fd: c_int, events: u32) -> GPollFD {
        GPollFD {
            fd,
            events: events as u16,
            revents: 0,
        }
    }

    #[test]
    fn glib_events_map_to_uv_readiness() {
        assert_eq!(glib_events_to_uv(G_IO_IN as u16), UV_READABLE);
        assert_eq!(glib_events_to_uv(G_IO_OUT as u16), UV_WRITABLE);
        assert_eq!(glib_events_to_uv(G_IO_HUP as u16), UV_DISCONNECT);
        assert_eq!(glib_events_to_uv(G_IO_ERR as u16), UV_DISCONNECT);
        assert_eq!(glib_events_to_uv(G_IO_PRI as u16), UV_PRIORITIZED);
        assert_eq!(
            glib_events_to_uv((G_IO_IN | G_IO_OUT) as u16),
            UV_READABLE | UV_WRITABLE
        );
        assert_eq!(
            glib_events_to_uv((G_IO_HUP | G_IO_ERR) as u16),
            UV_DISCONNECT
        );
        assert_eq!(
            glib_events_to_uv((G_IO_IN | G_IO_HUP | G_IO_PRI) as u16),
            UV_READABLE | UV_DISCONNECT | UV_PRIORITIZED
        );
        assert_eq!(glib_events_to_uv(0), 0);
    }

    #[test]
    fn desired_uv_events_merge_per_fd() {
        let fds = [pfd(3, G_IO_IN), pfd(3, G_IO_OUT), pfd(5, G_IO_IN)];
        let desired = desired_uv_events(&fds);
        assert_eq!(desired.len(), 2);
        assert_eq!(desired.get(&3).copied(), Some(UV_READABLE | UV_WRITABLE));
        assert_eq!(desired.get(&5).copied(), Some(UV_READABLE));
    }

    #[test]
    fn desired_uv_events_watch_zero_event_fds_for_disconnect() {
        let fds = [pfd(6, 0)];
        assert_eq!(
            desired_uv_events(&fds).get(&6).copied(),
            Some(UV_DISCONNECT)
        );
    }

    #[test]
    fn desired_uv_events_cover_hangup_error_and_priority_interest() {
        let fds = [pfd(4, G_IO_HUP), pfd(5, G_IO_ERR), pfd(7, G_IO_PRI)];
        let desired = desired_uv_events(&fds);
        assert_eq!(desired.len(), 3);
        assert_eq!(desired.get(&4).copied(), Some(UV_DISCONNECT));
        assert_eq!(desired.get(&5).copied(), Some(UV_DISCONNECT));
        assert_eq!(desired.get(&7).copied(), Some(UV_PRIORITIZED));
    }

    #[test]
    fn wakeup_follows_glib_timeout_when_nothing_is_ready() {
        assert_eq!(wakeup_for(-1, false, false), Wakeup::Idle);
        assert_eq!(wakeup_for(0, false, false), Wakeup::Now);
        assert_eq!(wakeup_for(25, false, false), Wakeup::In(25));
    }

    #[test]
    fn wakeup_is_immediate_when_sources_are_ready() {
        assert_eq!(wakeup_for(-1, true, false), Wakeup::Now);
        assert_eq!(wakeup_for(25, true, false), Wakeup::Now);
    }

    #[test]
    fn wakeup_is_immediate_when_a_poll_fd_is_unwatchable() {
        assert_eq!(wakeup_for(-1, false, true), Wakeup::Now);
        assert_eq!(wakeup_for(25, false, true), Wakeup::Now);
    }
}

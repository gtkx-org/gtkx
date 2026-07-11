use std::alloc::{Layout, alloc_zeroed, dealloc};
use std::cell::{Cell, RefCell};
use std::collections::HashMap;
use std::ffi::c_void;
use std::os::raw::c_int;

use glib::ffi::{
    G_IO_ERR, G_IO_HUP, G_IO_IN, G_IO_NVAL, G_IO_OUT, GMainContext, GPollFD, g_main_context_check,
    g_main_context_default, g_main_context_dispatch, g_main_context_prepare, g_main_context_query,
    g_main_context_release,
};
use libloading::os::unix::Library;
use napi::Env;

const UV_CHECK: c_int = 2;
const UV_POLL: c_int = 8;
const UV_PREPARE: c_int = 9;
const UV_TIMER: c_int = 13;

const UV_READABLE: c_int = 1;
const UV_WRITABLE: c_int = 2;
const UV_DISCONNECT: c_int = 4;

const HANDLE_ALIGN: usize = 16;

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
    prepare_stop: unsafe extern "C" fn(*mut c_void) -> c_int,
    check_init: unsafe extern "C" fn(*mut c_void, *mut c_void) -> c_int,
    check_start: unsafe extern "C" fn(*mut c_void, UvVoidCb) -> c_int,
    check_stop: unsafe extern "C" fn(*mut c_void) -> c_int,
    timer_init: unsafe extern "C" fn(*mut c_void, *mut c_void) -> c_int,
    timer_start: unsafe extern "C" fn(*mut c_void, UvVoidCb, u64, u64) -> c_int,
    timer_stop: unsafe extern "C" fn(*mut c_void) -> c_int,
    poll_init: unsafe extern "C" fn(*mut c_void, *mut c_void, c_int) -> c_int,
    poll_start: unsafe extern "C" fn(*mut c_void, c_int, UvPollCb) -> c_int,
    poll_stop: unsafe extern "C" fn(*mut c_void) -> c_int,
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
                prepare_stop: *lib.get(b"uv_prepare_stop")?,
                check_init: *lib.get(b"uv_check_init")?,
                check_start: *lib.get(b"uv_check_start")?,
                check_stop: *lib.get(b"uv_check_stop")?,
                timer_init: *lib.get(b"uv_timer_init")?,
                timer_start: *lib.get(b"uv_timer_start")?,
                timer_stop: *lib.get(b"uv_timer_stop")?,
                poll_init: *lib.get(b"uv_poll_init")?,
                poll_start: *lib.get(b"uv_poll_start")?,
                poll_stop: *lib.get(b"uv_poll_stop")?,
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
    fd: c_int,
    size: usize,
}

unsafe fn handle_layout(size: usize) -> Layout {
    Layout::from_size_align(size, HANDLE_ALIGN).expect("uv handle layout")
}

fn alloc_uv_handle(htype: c_int, fd: c_int) -> *mut c_void {
    let size = unsafe { (uv().handle_size)(htype) };
    let ptr = unsafe { alloc_zeroed(handle_layout(size)) } as *mut c_void;
    let data = Box::into_raw(Box::new(HandleData { fd, size }));
    unsafe { (uv().handle_set_data)(ptr, data.cast()) };
    ptr
}

unsafe extern "C" fn on_close(handle: *mut c_void) {
    let data_ptr = unsafe { (uv().handle_get_data)(handle) } as *mut HandleData;
    if data_ptr.is_null() {
        return;
    }
    let data = unsafe { Box::from_raw(data_ptr) };
    unsafe { dealloc(handle as *mut u8, handle_layout(data.size)) };
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
    result
}

fn uv_events_to_glib(status: c_int, events: c_int) -> u16 {
    if status < 0 {
        return (G_IO_ERR | G_IO_NVAL) as u16;
    }
    let mut result: u32 = 0;
    if events & UV_READABLE != 0 {
        result |= G_IO_IN;
    }
    if events & UV_WRITABLE != 0 {
        result |= G_IO_OUT;
    }
    if events & UV_DISCONNECT != 0 {
        result |= G_IO_HUP;
    }
    result as u16
}

struct GtkLoop {
    uv_loop: *mut c_void,
    ctx: *mut GMainContext,
    prepare: *mut c_void,
    check: *mut c_void,
    timer: *mut c_void,
    pollers: HashMap<c_int, *mut c_void>,
    fds: Vec<GPollFD>,
    n_fds: usize,
    max_priority: c_int,
}

impl GtkLoop {
    fn prepare_iteration(&mut self) {
        let mut max_priority: c_int = 0;
        let ready = unsafe { g_main_context_prepare(self.ctx, &mut max_priority) } != 0;
        self.max_priority = max_priority;

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

        self.reconcile_pollers();
        self.arm_timer(timeout, ready);
    }

    fn reconcile_pollers(&mut self) {
        let uv = uv();
        let mut desired: HashMap<c_int, u16> = HashMap::new();
        for pfd in &self.fds[..self.n_fds] {
            *desired.entry(pfd.fd).or_insert(0) |= pfd.events;
        }

        let stale: Vec<c_int> = self
            .pollers
            .keys()
            .copied()
            .filter(|fd| glib_events_to_uv(desired.get(fd).copied().unwrap_or(0)) == 0)
            .collect();
        for fd in stale {
            if let Some(handle) = self.pollers.remove(&fd) {
                unsafe { (uv.poll_stop)(handle) };
                close_uv_handle(handle);
            }
        }

        for (fd, events) in desired {
            let uv_events = glib_events_to_uv(events);
            if uv_events == 0 {
                continue;
            }
            let uv_loop = self.uv_loop;
            let handle = *self.pollers.entry(fd).or_insert_with(|| {
                let handle = alloc_uv_handle(UV_POLL, fd);
                unsafe {
                    (uv.poll_init)(uv_loop, handle, fd);
                    (uv.unreference)(handle);
                }
                handle
            });
            unsafe { (uv.poll_start)(handle, uv_events, on_poll) };
        }
    }

    fn arm_timer(&self, timeout: c_int, ready: bool) {
        let uv = uv();
        if ready || timeout == 0 {
            unsafe { (uv.timer_start)(self.timer, on_timer, 0, 0) };
        } else if timeout < 0 {
            unsafe { (uv.timer_stop)(self.timer) };
        } else {
            unsafe { (uv.timer_start)(self.timer, on_timer, timeout as u64, 0) };
        }
    }

    fn record_readiness(&mut self, fd: c_int, revents: u16) {
        for pfd in &mut self.fds[..self.n_fds] {
            if pfd.fd == fd {
                pfd.revents |= revents;
            }
        }
    }
}

unsafe extern "C" fn on_prepare(_handle: *mut c_void) {
    GTK_LOOP.with_borrow_mut(|slot| {
        if let Some(state) = slot.as_mut() {
            state.prepare_iteration();
        }
    });
}

unsafe extern "C" fn on_check(_handle: *mut c_void) {
    let ctx = GTK_LOOP.with_borrow_mut(|slot| {
        slot.as_mut().map(|state| {
            unsafe {
                g_main_context_check(
                    state.ctx,
                    state.max_priority,
                    state.fds.as_mut_ptr(),
                    state.n_fds as c_int,
                );
            }
            state.ctx
        })
    });

    if let Some(ctx) = ctx {
        crate::messaging::node_env::run_dispatch_scope(|| unsafe { g_main_context_dispatch(ctx) });
    }
}

unsafe extern "C" fn on_timer(_handle: *mut c_void) {}

unsafe extern "C" fn on_poll(handle: *mut c_void, status: c_int, events: c_int) {
    let data = unsafe { (uv().handle_get_data)(handle) } as *const HandleData;
    if data.is_null() {
        return;
    }
    let fd = unsafe { (*data).fd };
    let revents = uv_events_to_glib(status, events);
    GTK_LOOP.with_borrow_mut(|slot| {
        if let Some(state) = slot.as_mut() {
            state.record_readiness(fd, revents);
        }
    });
}

pub fn install(env: &Env) -> napi::Result<()> {
    if GTK_LOOP.with_borrow(Option::is_some) {
        return Ok(());
    }

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

    let prepare = alloc_uv_handle(UV_PREPARE, 0);
    let check = alloc_uv_handle(UV_CHECK, 0);
    let timer = alloc_uv_handle(UV_TIMER, 0);
    unsafe {
        (uv.prepare_init)(uv_loop, prepare);
        (uv.check_init)(uv_loop, check);
        (uv.timer_init)(uv_loop, timer);
        (uv.prepare_start)(prepare, on_prepare);
        (uv.check_start)(check, on_check);
        (uv.unreference)(prepare);
        (uv.unreference)(check);
        (uv.unreference)(timer);
    }

    GTK_LOOP.with(|slot| {
        *slot.borrow_mut() = Some(GtkLoop {
            uv_loop,
            ctx,
            prepare,
            check,
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
            max_priority: 0,
        });
    });

    Ok(())
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
        let uv = uv();
        unsafe {
            (uv.prepare_stop)(state.prepare);
            (uv.check_stop)(state.check);
            (uv.timer_stop)(state.timer);
        }
        for (_, handle) in state.pollers {
            unsafe { (uv.poll_stop)(handle) };
            close_uv_handle(handle);
        }
        close_uv_handle(state.prepare);
        close_uv_handle(state.check);
        close_uv_handle(state.timer);
        Some(state.ctx)
    });

    let Some(ctx) = ctx else {
        return;
    };

    unsafe { g_main_context_release(ctx) };

    let context = glib::MainContext::default();
    while context.iteration(false) {}
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn glib_events_map_to_uv_readiness() {
        assert_eq!(glib_events_to_uv(G_IO_IN as u16), UV_READABLE);
        assert_eq!(glib_events_to_uv(G_IO_OUT as u16), UV_WRITABLE);
        assert_eq!(
            glib_events_to_uv((G_IO_IN | G_IO_OUT) as u16),
            UV_READABLE | UV_WRITABLE
        );
        assert_eq!(glib_events_to_uv(0), 0);
    }

    #[test]
    fn uv_readiness_maps_back_to_glib_conditions() {
        assert_eq!(uv_events_to_glib(0, UV_READABLE), G_IO_IN as u16);
        assert_eq!(uv_events_to_glib(0, UV_WRITABLE), G_IO_OUT as u16);
        assert_eq!(uv_events_to_glib(0, UV_DISCONNECT), G_IO_HUP as u16);
        assert_eq!(
            uv_events_to_glib(-1, UV_READABLE),
            (G_IO_ERR | G_IO_NVAL) as u16
        );
    }
}

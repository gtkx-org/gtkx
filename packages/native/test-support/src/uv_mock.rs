use std::cell::RefCell;
use std::collections::{HashMap, HashSet};
use std::ffi::{c_int, c_void};

pub const MOCK_UV_ERROR: c_int = -22;

pub type UvVoidCb = unsafe extern "C" fn(*mut c_void);
pub type UvPollCb = unsafe extern "C" fn(*mut c_void, c_int, c_int);

const MOCK_HANDLE_SIZE: usize = 128;

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum HandleKind {
    Prepare,
    Timer,
    Poll,
}

impl HandleKind {
    fn label(self) -> &'static str {
        match self {
            HandleKind::Prepare => "prepare",
            HandleKind::Timer => "timer",
            HandleKind::Poll => "poll",
        }
    }
}

#[derive(Clone, Debug, Default)]
struct HandleRecord {
    kind: Option<HandleKind>,
    loop_ptr: Option<usize>,
    fd: Option<c_int>,
    poll_events: Option<c_int>,
    referenced: bool,
    ref_calls: usize,
    unref_calls: usize,
    close_calls: usize,
    freed: bool,
    armed_timeout: Option<u64>,
    timer_starts: Vec<u64>,
    init_failed: bool,
}

#[derive(Clone, Debug)]
pub struct HandleSnapshot {
    pub id: usize,
    pub kind: Option<HandleKind>,
    pub loop_ptr: Option<usize>,
    pub fd: Option<c_int>,
    pub poll_events: Option<c_int>,
    pub referenced: bool,
    pub ref_calls: usize,
    pub unref_calls: usize,
    pub close_calls: usize,
    pub freed: bool,
    pub armed_timeout: Option<u64>,
    pub timer_starts: Vec<u64>,
    pub init_failed: bool,
}

fn snapshot(id: usize, record: &HandleRecord) -> HandleSnapshot {
    HandleSnapshot {
        id,
        kind: record.kind,
        loop_ptr: record.loop_ptr,
        fd: record.fd,
        poll_events: record.poll_events,
        referenced: record.referenced,
        ref_calls: record.ref_calls,
        unref_calls: record.unref_calls,
        close_calls: record.close_calls,
        freed: record.freed,
        armed_timeout: record.armed_timeout,
        timer_starts: record.timer_starts.clone(),
        init_failed: record.init_failed,
    }
}

#[derive(Default)]
struct State {
    records: Vec<HandleRecord>,
    live: HashMap<usize, usize>,
    data: HashMap<usize, *mut c_void>,
    prepare_cb: Option<(*mut c_void, UvVoidCb)>,
    calls: Vec<String>,
    counts: HashMap<String, usize>,
    fail_prepare_init: bool,
    fail_timer_init: bool,
    fail_prepare_start: bool,
    fail_timer_start: bool,
    fail_poll_init_fds: HashSet<c_int>,
    fail_poll_start_fds: HashSet<c_int>,
}

impl State {
    fn record(&mut self, entry: String) {
        let name = entry
            .split(['(', '='])
            .next()
            .unwrap_or(entry.as_str())
            .to_owned();
        *self.counts.entry(name).or_insert(0) += 1;
        self.calls.push(entry);
    }

    fn live_id(&self, handle: *mut c_void) -> Option<usize> {
        self.live.get(&(handle as usize)).copied()
    }

    fn live_record_mut(&mut self, handle: *mut c_void) -> Option<&mut HandleRecord> {
        let id = self.live_id(handle)?;
        self.records.get_mut(id)
    }

    fn handle_label(&self, handle: *mut c_void) -> String {
        let Some(id) = self.live_id(handle) else {
            return "dangling".to_owned();
        };
        let record = &self.records[id];
        match (record.kind, record.fd) {
            (Some(kind), Some(fd)) => format!("{},fd={fd}", kind.label()),
            (Some(kind), None) => kind.label().to_owned(),
            _ => "uninitialized".to_owned(),
        }
    }
}

thread_local! {
    static STATE: RefCell<State> = RefCell::new(State::default());
}

pub fn reset() {
    STATE.with_borrow_mut(|state| *state = State::default());
}

pub fn calls() -> Vec<String> {
    STATE.with_borrow(|state| state.calls.clone())
}

pub fn count(name: &str) -> usize {
    STATE.with_borrow(|state| state.counts.get(name).copied().unwrap_or(0))
}

pub fn clear_calls() {
    STATE.with_borrow_mut(|state| {
        state.calls.clear();
        state.counts.clear();
    });
}

pub fn record(entry: &str) {
    STATE.with_borrow_mut(|state| state.record(entry.to_owned()));
}

pub fn tick_segments() -> Vec<Vec<String>> {
    let calls = calls();
    let mut segments = Vec::new();
    let mut current: Option<Vec<String>> = None;
    for call in calls {
        match call.as_str() {
            "tick_begin" => current = Some(Vec::new()),
            "tick_end" => {
                if let Some(segment) = current.take() {
                    segments.push(segment);
                }
            }
            _ => {
                if let Some(segment) = current.as_mut() {
                    segment.push(call);
                }
            }
        }
    }
    segments
}

pub fn calls_outside_ticks() -> Vec<String> {
    let calls = calls();
    let mut outside = Vec::new();
    let mut depth = 0usize;
    for call in calls {
        match call.as_str() {
            "tick_begin" => depth += 1,
            "tick_end" => depth = depth.saturating_sub(1),
            _ => {
                if depth == 0 {
                    outside.push(call);
                }
            }
        }
    }
    outside
}

pub fn snapshots() -> Vec<HandleSnapshot> {
    STATE.with_borrow(|state| {
        state
            .records
            .iter()
            .enumerate()
            .map(|(id, record)| snapshot(id, record))
            .collect()
    })
}

fn live_snapshots() -> Vec<HandleSnapshot> {
    STATE.with_borrow(|state| {
        state
            .live
            .values()
            .map(|&id| snapshot(id, &state.records[id]))
            .collect()
    })
}

pub fn prepare_snapshot() -> Option<HandleSnapshot> {
    live_snapshots()
        .into_iter()
        .find(|handle| handle.kind == Some(HandleKind::Prepare))
}

pub fn timer_snapshot() -> Option<HandleSnapshot> {
    live_snapshots()
        .into_iter()
        .find(|handle| handle.kind == Some(HandleKind::Timer))
}

pub fn poller_snapshot(fd: c_int) -> Option<HandleSnapshot> {
    live_snapshots()
        .into_iter()
        .find(|handle| handle.kind == Some(HandleKind::Poll) && handle.fd == Some(fd))
}

pub fn live_poller_fds() -> Vec<c_int> {
    let mut fds: Vec<c_int> = live_snapshots()
        .into_iter()
        .filter(|handle| handle.kind == Some(HandleKind::Poll))
        .filter_map(|handle| handle.fd)
        .collect();
    fds.sort_unstable();
    fds
}

pub fn armed_timeout() -> Option<u64> {
    timer_snapshot().and_then(|timer| timer.armed_timeout)
}

pub fn set_fail_prepare_init(fail: bool) {
    STATE.with_borrow_mut(|state| state.fail_prepare_init = fail);
}

pub fn set_fail_timer_init(fail: bool) {
    STATE.with_borrow_mut(|state| state.fail_timer_init = fail);
}

pub fn set_fail_prepare_start(fail: bool) {
    STATE.with_borrow_mut(|state| state.fail_prepare_start = fail);
}

pub fn set_fail_timer_start(fail: bool) {
    STATE.with_borrow_mut(|state| state.fail_timer_start = fail);
}

pub fn set_fail_poll_init(fd: c_int, fail: bool) {
    STATE.with_borrow_mut(|state| {
        if fail {
            state.fail_poll_init_fds.insert(fd);
        } else {
            state.fail_poll_init_fds.remove(&fd);
        }
    });
}

pub fn set_fail_poll_start(fd: c_int, fail: bool) {
    STATE.with_borrow_mut(|state| {
        if fail {
            state.fail_poll_start_fds.insert(fd);
        } else {
            state.fail_poll_start_fds.remove(&fd);
        }
    });
}

pub fn tick() -> bool {
    let Some((handle, cb)) = STATE.with_borrow(|state| state.prepare_cb) else {
        return false;
    };
    STATE.with_borrow_mut(|state| state.record("tick_begin".to_owned()));
    unsafe { cb(handle) };
    STATE.with_borrow_mut(|state| state.record("tick_end".to_owned()));
    true
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn uv_handle_size(_htype: c_int) -> usize {
    MOCK_HANDLE_SIZE
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn uv_handle_set_data(handle: *mut c_void, data: *mut c_void) {
    STATE.with_borrow_mut(|state| {
        let id = state.records.len();
        state.records.push(HandleRecord {
            referenced: true,
            ..HandleRecord::default()
        });
        state.live.insert(handle as usize, id);
        state.data.insert(handle as usize, data);
    });
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn uv_handle_get_data(handle: *const c_void) -> *mut c_void {
    STATE.with_borrow_mut(|state| {
        let key = handle as usize;
        let data = state.data.remove(&key).unwrap_or(std::ptr::null_mut());
        if let Some(id) = state.live.remove(&key) {
            state.records[id].freed = true;
        }
        data
    })
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn uv_ref(handle: *mut c_void) {
    STATE.with_borrow_mut(|state| {
        let label = state.handle_label(handle);
        state.record(format!("uv_ref({label})"));
        if let Some(record) = state.live_record_mut(handle) {
            record.referenced = true;
            record.ref_calls += 1;
        }
    });
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn uv_unref(handle: *mut c_void) {
    STATE.with_borrow_mut(|state| {
        let label = state.handle_label(handle);
        state.record(format!("uv_unref({label})"));
        if let Some(record) = state.live_record_mut(handle) {
            record.referenced = false;
            record.unref_calls += 1;
        }
    });
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn uv_close(handle: *mut c_void, close_cb: Option<UvVoidCb>) {
    STATE.with_borrow_mut(|state| {
        let label = state.handle_label(handle);
        state.record(format!("uv_close({label})"));
        if let Some(record) = state.live_record_mut(handle) {
            record.close_calls += 1;
            record.armed_timeout = None;
        }
        if state
            .prepare_cb
            .is_some_and(|(prepare_handle, _)| prepare_handle == handle)
        {
            state.prepare_cb = None;
        }
    });
    if let Some(cb) = close_cb {
        unsafe { cb(handle) };
    }
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn uv_prepare_init(loop_: *mut c_void, handle: *mut c_void) -> c_int {
    STATE.with_borrow_mut(|state| {
        if state.fail_prepare_init {
            state.record("uv_prepare_init=err".to_owned());
            if let Some(record) = state.live_record_mut(handle) {
                record.init_failed = true;
            }
            return MOCK_UV_ERROR;
        }
        state.record("uv_prepare_init".to_owned());
        if let Some(record) = state.live_record_mut(handle) {
            record.kind = Some(HandleKind::Prepare);
            record.loop_ptr = Some(loop_ as usize);
        }
        0
    })
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn uv_prepare_start(handle: *mut c_void, cb: UvVoidCb) -> c_int {
    STATE.with_borrow_mut(|state| {
        if state.fail_prepare_start {
            state.record("uv_prepare_start=err".to_owned());
            return MOCK_UV_ERROR;
        }
        state.record("uv_prepare_start".to_owned());
        state.prepare_cb = Some((handle, cb));
        0
    })
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn uv_timer_init(loop_: *mut c_void, handle: *mut c_void) -> c_int {
    STATE.with_borrow_mut(|state| {
        if state.fail_timer_init {
            state.record("uv_timer_init=err".to_owned());
            if let Some(record) = state.live_record_mut(handle) {
                record.init_failed = true;
            }
            return MOCK_UV_ERROR;
        }
        state.record("uv_timer_init".to_owned());
        if let Some(record) = state.live_record_mut(handle) {
            record.kind = Some(HandleKind::Timer);
            record.loop_ptr = Some(loop_ as usize);
        }
        0
    })
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn uv_timer_start(
    handle: *mut c_void,
    _cb: UvVoidCb,
    timeout: u64,
    _repeat: u64,
) -> c_int {
    STATE.with_borrow_mut(|state| {
        if state.fail_timer_start {
            state.record(format!("uv_timer_start({timeout})=err"));
            return MOCK_UV_ERROR;
        }
        state.record(format!("uv_timer_start({timeout})"));
        if let Some(record) = state.live_record_mut(handle) {
            record.armed_timeout = Some(timeout);
            record.timer_starts.push(timeout);
        }
        0
    })
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn uv_timer_stop(handle: *mut c_void) -> c_int {
    STATE.with_borrow_mut(|state| {
        state.record("uv_timer_stop".to_owned());
        if let Some(record) = state.live_record_mut(handle) {
            record.armed_timeout = None;
        }
        0
    })
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn uv_poll_init(loop_: *mut c_void, handle: *mut c_void, fd: c_int) -> c_int {
    STATE.with_borrow_mut(|state| {
        if state.fail_poll_init_fds.contains(&fd) {
            state.record(format!("uv_poll_init(fd={fd})=err"));
            if let Some(record) = state.live_record_mut(handle) {
                record.fd = Some(fd);
                record.init_failed = true;
            }
            return MOCK_UV_ERROR;
        }
        state.record(format!("uv_poll_init(fd={fd})"));
        if let Some(record) = state.live_record_mut(handle) {
            record.kind = Some(HandleKind::Poll);
            record.fd = Some(fd);
            record.loop_ptr = Some(loop_ as usize);
        }
        0
    })
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn uv_poll_start(handle: *mut c_void, events: c_int, _cb: UvPollCb) -> c_int {
    STATE.with_borrow_mut(|state| {
        let fd = state
            .live_id(handle)
            .and_then(|id| state.records[id].fd)
            .unwrap_or(-1);
        if state.fail_poll_start_fds.contains(&fd) {
            state.record(format!("uv_poll_start(fd={fd},events={events})=err"));
            return MOCK_UV_ERROR;
        }
        state.record(format!("uv_poll_start(fd={fd},events={events})"));
        if let Some(record) = state.live_record_mut(handle) {
            record.poll_events = Some(events);
        }
        0
    })
}

fn reference_symbols() {
    keep_symbols!(
        uv_handle_size,
        uv_handle_set_data,
        uv_handle_get_data,
        uv_ref,
        uv_unref,
        uv_close,
        uv_prepare_init,
        uv_prepare_start,
        uv_timer_init,
        uv_timer_start,
        uv_timer_stop,
        uv_poll_init,
        uv_poll_start,
    );
}

pub fn install_uv_mock() {
    reference_symbols();
}

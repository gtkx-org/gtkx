use std::cell::{Cell, RefCell};
use std::collections::HashMap;
use std::ffi::c_void;
use std::rc::Rc;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex, MutexGuard, OnceLock, PoisonError, Weak};

use glib::translate::from_glib_none;
use napi::{Env, Status, sys};

use super::panic_handler::guard_ffi_boundary;

thread_local! {
    static NODE_ENV: Cell<sys::napi_env> = const { Cell::new(std::ptr::null_mut()) };
    static ASYNC_CONTEXT: Cell<sys::napi_async_context> = const { Cell::new(std::ptr::null_mut()) };
    static RESOURCE_REF: Cell<sys::napi_ref> = const { Cell::new(std::ptr::null_mut()) };
    static LOCAL_SOURCES: RefCell<Option<Vec<LocalSource>>> = const { RefCell::new(None) };
    static NEXT_LOCAL_SOURCE: Cell<u64> = const { Cell::new(1) };
    static DISPATCH_SCOPE: RefCell<Option<DispatchHandle>> = const { RefCell::new(None) };
}

type LocalWork = Box<dyn FnOnce()>;
type SendWork = Box<dyn FnOnce() + Send>;

struct LocalSource {
    token: u64,
    source: glib::Source,
    work: Rc<RefCell<Option<LocalWork>>>,
}

struct SendSource {
    token: u64,
    source: glib::Source,
    work: Arc<Mutex<Option<SendWork>>>,
}

struct SendSources {
    active: bool,
    closed: bool,
    next_token: u64,
    sources: Vec<SendSource>,
    pending: Vec<SendWork>,
}

struct DispatchScope {
    token: usize,
    sources: Mutex<SendSources>,
}

#[derive(Clone)]
pub struct DispatchHandle(Arc<DispatchScope>);

static NEXT_DISPATCH_TOKEN: AtomicUsize = AtomicUsize::new(1);
static ACTIVE_DISPATCH: OnceLock<Mutex<Option<Weak<DispatchScope>>>> = OnceLock::new();
static DISPATCH_SCOPES: OnceLock<Mutex<HashMap<usize, Weak<DispatchScope>>>> = OnceLock::new();

fn lock<T>(mutex: &Mutex<T>) -> MutexGuard<'_, T> {
    mutex.lock().unwrap_or_else(PoisonError::into_inner)
}

fn active_dispatch() -> &'static Mutex<Option<Weak<DispatchScope>>> {
    ACTIVE_DISPATCH.get_or_init(|| Mutex::new(None))
}

fn dispatch_scopes() -> &'static Mutex<HashMap<usize, Weak<DispatchScope>>> {
    DISPATCH_SCOPES.get_or_init(|| Mutex::new(HashMap::new()))
}

impl DispatchScope {
    fn invoke(self: &Arc<Self>, context: &'static str, work: SendWork, is_current_thread: bool) {
        let pending = Arc::new(Mutex::new(Some(work)));
        let mut sources = lock(&self.sources);
        if sources.closed {
            return;
        }
        if !sources.active {
            let work = lock(&pending).take();
            if is_current_thread {
                drop(sources);
                if let Some(work) = work {
                    work();
                }
            } else if let Some(work) = work {
                sources.pending.push(work);
            }
            return;
        }

        let token = sources.next_token;
        sources.next_token = token
            .checked_add(1)
            .expect("the dispatch source token space must not be exhausted");
        let callback_scope = Arc::clone(self);
        let callback_pending = Arc::clone(&pending);
        let source = glib::idle_source_new(Some(context), glib::Priority::DEFAULT, move || {
            callback_scope.run(token, &callback_pending);
            glib::ControlFlow::Break
        });
        source.attach(Some(&glib::MainContext::default()));
        sources.sources.push(SendSource {
            token,
            source,
            work: pending,
        });
    }

    fn run(&self, token: u64, pending: &Mutex<Option<SendWork>>) {
        let active = {
            let mut sources = lock(&self.sources);
            sources.sources.retain(|source| source.token != token);
            sources.active
        };
        if !active {
            return;
        }
        let work = lock(pending).take();
        if let Some(work) = work {
            work();
        }
    }

    fn resume(&self) {
        let pending = {
            let mut state = lock(&self.sources);
            if state.closed {
                return;
            }
            state.active = true;
            std::mem::take(&mut state.pending)
        };
        for work in pending {
            work();
        }
    }

    fn pause(&self) {
        let sources = {
            let mut state = lock(&self.sources);
            if state.closed {
                return;
            }
            state.active = false;
            std::mem::take(&mut state.sources)
        };
        for source in sources {
            source.source.destroy();
            let work = lock(&source.work).take();
            if let Some(work) = work {
                work();
            }
        }
    }

    fn close(&self) {
        let (sources, pending) = {
            let mut state = lock(&self.sources);
            state.active = false;
            state.closed = true;
            (
                std::mem::take(&mut state.sources),
                std::mem::take(&mut state.pending),
            )
        };
        for source in sources {
            source.source.destroy();
            let work = lock(&source.work).take();
            if let Some(work) = work {
                work();
            }
        }
        for work in pending {
            work();
        }
    }
}

impl DispatchHandle {
    #[must_use]
    pub fn is_current_thread(&self) -> bool {
        DISPATCH_SCOPE.with_borrow(|current| {
            current
                .as_ref()
                .is_some_and(|current| Arc::ptr_eq(&current.0, &self.0))
        })
    }

    pub fn invoke(&self, context: &'static str, work: impl FnOnce() + Send + 'static) {
        let work: SendWork = Box::new(move || {
            guard_ffi_boundary(context, work);
        });
        self.0.invoke(context, work, self.is_current_thread());
    }

    #[must_use]
    pub fn data(&self) -> *mut c_void {
        self.0.token as *mut c_void
    }
}

fn check(status: sys::napi_status, what: &str) -> napi::Result<()> {
    if status == sys::Status::napi_ok {
        return Ok(());
    }

    Err(napi::Error::new(
        Status::GenericFailure,
        format!("Failed to {what} while installing the Node environment (status {status})"),
    ))
}

unsafe fn install_dispatch_context(raw: sys::napi_env) -> napi::Result<()> {
    unsafe {
        let mut resource: sys::napi_value = std::ptr::null_mut();
        check(
            sys::napi_create_object(raw, &raw mut resource),
            "create the dispatch resource object",
        )?;

        let name = c"gtkx:dispatch";
        let mut resource_name: sys::napi_value = std::ptr::null_mut();
        check(
            sys::napi_create_string_utf8(raw, name.as_ptr(), 13, &raw mut resource_name),
            "name the dispatch resource",
        )?;

        let mut async_context: sys::napi_async_context = std::ptr::null_mut();
        check(
            sys::napi_async_init(raw, resource, resource_name, &raw mut async_context),
            "create the dispatch async context",
        )?;

        let mut resource_ref: sys::napi_ref = std::ptr::null_mut();
        let status = sys::napi_create_reference(raw, resource, 1, &raw mut resource_ref);
        if status != sys::Status::napi_ok {
            let _ = sys::napi_async_destroy(raw, async_context);
            return check(status, "retain the dispatch resource object");
        }

        ASYNC_CONTEXT.set(async_context);
        RESOURCE_REF.set(resource_ref);
    }

    Ok(())
}

unsafe fn clear_dispatch_context(raw: sys::napi_env) {
    close_sources();
    NODE_ENV.set(std::ptr::null_mut());
    let async_context = ASYNC_CONTEXT.replace(std::ptr::null_mut());
    let resource_ref = RESOURCE_REF.replace(std::ptr::null_mut());

    unsafe {
        if !async_context.is_null() {
            let _ = sys::napi_async_destroy(raw, async_context);
        }
        if !resource_ref.is_null() {
            let _ = sys::napi_delete_reference(raw, resource_ref);
        }
    }
}

unsafe extern "C" fn cleanup(data: *mut c_void) {
    unsafe { clear_dispatch_context(data.cast()) };
}

pub fn install(env: Env) -> napi::Result<()> {
    if is_installed_on_current_thread() {
        return Ok(());
    }

    let raw = env.raw();
    unsafe { install_dispatch_context(raw) }?;

    let status = unsafe { sys::napi_add_env_cleanup_hook(raw, Some(cleanup), raw.cast()) };
    if let Err(error) = check(status, "register the environment cleanup hook") {
        unsafe { clear_dispatch_context(raw) };
        return Err(error);
    }

    NODE_ENV.set(raw);
    install_dispatch_scope();

    Ok(())
}

pub fn is_installed_on_current_thread() -> bool {
    !NODE_ENV.with(Cell::get).is_null()
}

pub fn try_env() -> Option<Env> {
    let raw = NODE_ENV.with(Cell::get);
    if raw.is_null() {
        None
    } else {
        Some(Env::from_raw(raw))
    }
}

#[must_use]
pub fn env() -> Env {
    try_env().expect(
        "the Node environment was accessed from a thread it is not installed on; \
         marshal the call to the GLib main context first",
    )
}

pub fn invoke_on_install_thread(context: &'static str, work: impl FnOnce() + Send + 'static) {
    let dispatch = lock(active_dispatch()).as_ref().and_then(Weak::upgrade);
    if let Some(dispatch) = dispatch {
        DispatchHandle(dispatch).invoke(context, work);
    }
}

pub fn dispatch_handle() -> DispatchHandle {
    DISPATCH_SCOPE
        .with_borrow(Clone::clone)
        .expect("the dispatch scope must be active")
}

pub fn dispatch_handle_for(data: *mut c_void) -> Option<DispatchHandle> {
    let token = data as usize;
    let dispatch = lock(dispatch_scopes())
        .get(&token)
        .and_then(Weak::upgrade)?;
    Some(DispatchHandle(dispatch))
}

fn install_dispatch_scope() {
    let token = NEXT_DISPATCH_TOKEN.fetch_add(1, Ordering::Relaxed);
    assert_ne!(
        token, 0,
        "the dispatch scope token space must not be exhausted"
    );
    let dispatch = DispatchHandle(Arc::new(DispatchScope {
        token,
        sources: Mutex::new(SendSources {
            active: false,
            closed: false,
            next_token: 1,
            sources: Vec::new(),
            pending: Vec::new(),
        }),
    }));
    lock(dispatch_scopes()).insert(token, Arc::downgrade(&dispatch.0));
    DISPATCH_SCOPE.with_borrow_mut(|current| {
        *current = Some(dispatch);
    });
}

pub fn activate_local_sources() {
    deactivate_local_sources();
    let dispatch = dispatch_handle();
    *lock(active_dispatch()) = Some(Arc::downgrade(&dispatch.0));
    dispatch.0.resume();
    LOCAL_SOURCES.with_borrow_mut(|sources| {
        *sources = Some(Vec::new());
    });
}

pub fn deactivate_local_sources() {
    let sources = LOCAL_SOURCES
        .with_borrow_mut(Option::take)
        .unwrap_or_default();

    for source in sources {
        source.source.destroy();
        let work = source.work.borrow_mut().take();
        if let Some(work) = work {
            work();
        }
    }

    let dispatch = DISPATCH_SCOPE.with_borrow(Clone::clone);
    if let Some(dispatch) = &dispatch {
        let mut active = lock(active_dispatch());
        if active
            .as_ref()
            .and_then(Weak::upgrade)
            .is_some_and(|active| Arc::ptr_eq(&active, &dispatch.0))
        {
            *active = None;
        }
        drop(active);
        dispatch.0.pause();
    }
}

pub fn close_sources() {
    deactivate_local_sources();
    let dispatch = DISPATCH_SCOPE.with_borrow_mut(Option::take);
    if let Some(dispatch) = dispatch {
        lock(dispatch_scopes()).remove(&dispatch.0.token);
        dispatch.0.close();
    }
}

pub fn defer_local(context: &'static str, work: impl FnOnce() + 'static) {
    let work: LocalWork = Box::new(move || {
        guard_ffi_boundary(context, work);
    });
    if !LOCAL_SOURCES.with_borrow(Option::is_some) {
        work();
        return;
    }

    let token = NEXT_LOCAL_SOURCE.get();
    NEXT_LOCAL_SOURCE.set(
        token
            .checked_add(1)
            .expect("the local source token space must not be exhausted"),
    );
    let pending = Rc::new(RefCell::new(Some(work)));
    let callback_pending = Rc::clone(&pending);
    let source_id = glib::idle_add_local_once(move || {
        LOCAL_SOURCES.with_borrow_mut(|sources| {
            if let Some(sources) = sources {
                sources.retain(|source| source.token != token);
            }
        });
        let work = callback_pending.borrow_mut().take();
        if let Some(work) = work {
            work();
        }
    });
    let source_ptr = unsafe {
        glib::ffi::g_main_context_find_source_by_id(
            glib::ffi::g_main_context_default(),
            source_id.as_raw(),
        )
    };
    assert!(!source_ptr.is_null(), "a newly attached source must exist");
    let source = unsafe { from_glib_none(source_ptr) };
    LOCAL_SOURCES.with_borrow_mut(|sources| {
        sources
            .as_mut()
            .expect("the local source scope must remain active")
            .push(LocalSource {
                token,
                source,
                work: pending,
            });
    });
}

pub fn run_dispatch_scope(dispatch: impl FnOnce()) {
    let raw = env().raw();

    unsafe {
        let mut handle_scope: sys::napi_handle_scope = std::ptr::null_mut();
        sys::napi_open_handle_scope(raw, &raw mut handle_scope);

        let mut resource: sys::napi_value = std::ptr::null_mut();
        sys::napi_get_reference_value(raw, RESOURCE_REF.with(Cell::get), &raw mut resource);

        let mut callback_scope: sys::napi_callback_scope = std::ptr::null_mut();
        let callback_open = sys::napi_open_callback_scope(
            raw,
            resource,
            ASYNC_CONTEXT.with(Cell::get),
            &raw mut callback_scope,
        ) == sys::Status::napi_ok;

        dispatch();

        report_pending_exception(raw);

        if callback_open {
            sys::napi_close_callback_scope(raw, callback_scope);
        }
        sys::napi_close_handle_scope(raw, handle_scope);
    }
}

fn report_pending_exception(raw: sys::napi_env) {
    unsafe {
        let mut pending = false;
        if sys::napi_is_exception_pending(raw, &raw mut pending) != sys::Status::napi_ok || !pending
        {
            return;
        }
        let mut exception: sys::napi_value = std::ptr::null_mut();
        if sys::napi_get_and_clear_last_exception(raw, &raw mut exception) != sys::Status::napi_ok {
            return;
        }
        sys::napi_fatal_exception(raw, exception);
    }
}

pub fn raise_fatal(message: &str) {
    let Some(env) = try_env() else {
        return;
    };

    let raw = env.raw();
    let error = napi::Error::new(Status::GenericFailure, message.to_owned());

    unsafe {
        let mut handle_scope: sys::napi_handle_scope = std::ptr::null_mut();
        if sys::napi_open_handle_scope(raw, &raw mut handle_scope) != sys::Status::napi_ok {
            return;
        }
        sys::napi_fatal_exception(raw, napi::JsError::from(error).into_value(raw));
        sys::napi_close_handle_scope(raw, handle_scope);
    }
}

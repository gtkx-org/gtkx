use std::cell::Cell;

use napi::sys;
use napi::{Env, Status};

use super::panic_handler::guard_ffi_boundary;

thread_local! {
    static NODE_ENV: Cell<sys::napi_env> = const { Cell::new(std::ptr::null_mut()) };
    static ASYNC_CONTEXT: Cell<sys::napi_async_context> = const { Cell::new(std::ptr::null_mut()) };
    static RESOURCE_REF: Cell<sys::napi_ref> = const { Cell::new(std::ptr::null_mut()) };
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
        check(
            sys::napi_create_reference(raw, resource, 1, &raw mut resource_ref),
            "retain the dispatch resource object",
        )?;

        ASYNC_CONTEXT.set(async_context);
        RESOURCE_REF.set(resource_ref);
    }

    Ok(())
}

pub fn install(env: Env) -> napi::Result<()> {
    if is_installed_on_current_thread() {
        return Ok(());
    }

    let raw = env.raw();
    unsafe { install_dispatch_context(raw) }?;
    NODE_ENV.set(raw);

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
    let pending = Cell::new(Some(work));
    let source = glib::idle_source_new(Some(context), glib::Priority::DEFAULT, move || {
        if let Some(work) = pending.take() {
            guard_ffi_boundary(context, work);
        }
        glib::ControlFlow::Break
    });
    source.attach(Some(&glib::MainContext::default()));
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

#[cfg(test)]
pub(crate) fn run_installed<R>(f: impl FnOnce() -> R) -> R {
    test_support::run(|| {
        install(test_support::fake_env()).expect("installing the local node env should succeed");
        f()
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_environment_is_only_visible_on_its_install_thread() {
        run_installed(|| {
            assert!(is_installed_on_current_thread());
            assert!(try_env().is_some());

            let observed_off_thread = std::thread::spawn(|| {
                (
                    is_installed_on_current_thread(),
                    try_env().is_none(),
                    std::panic::catch_unwind(|| {
                        let _ = env();
                    })
                    .is_err(),
                )
            })
            .join()
            .expect("the probe thread should not crash");

            assert_eq!(observed_off_thread, (false, true, true));
        });
    }
}

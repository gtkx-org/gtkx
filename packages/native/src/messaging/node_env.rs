use std::cell::Cell;

use napi::sys;
use napi::{Env, Status};

thread_local! {
    static NODE_ENV: Cell<sys::napi_env> = const { Cell::new(std::ptr::null_mut()) };
    static ASYNC_CONTEXT: Cell<sys::napi_async_context> = const { Cell::new(std::ptr::null_mut()) };
    static RESOURCE_REF: Cell<sys::napi_ref> = const { Cell::new(std::ptr::null_mut()) };
}

pub fn install(env: Env) -> napi::Result<()> {
    let raw = env.raw();
    NODE_ENV.set(raw);

    unsafe {
        let mut resource: sys::napi_value = std::ptr::null_mut();
        if sys::napi_create_object(raw, &mut resource) != sys::Status::napi_ok {
            return Err(napi::Error::new(
                Status::GenericFailure,
                "Failed to create the dispatch resource object",
            ));
        }

        let name = c"gtkx:dispatch";
        let mut resource_name: sys::napi_value = std::ptr::null_mut();
        sys::napi_create_string_utf8(raw, name.as_ptr(), 13, &mut resource_name);

        let mut async_context: sys::napi_async_context = std::ptr::null_mut();
        sys::napi_async_init(raw, resource, resource_name, &mut async_context);
        ASYNC_CONTEXT.set(async_context);

        let mut resource_ref: sys::napi_ref = std::ptr::null_mut();
        sys::napi_create_reference(raw, resource, 1, &mut resource_ref);
        RESOURCE_REF.set(resource_ref);
    }

    Ok(())
}

pub fn env() -> Env {
    Env::from_raw(NODE_ENV.with(Cell::get))
}

pub fn run_dispatch_scope(dispatch: impl FnOnce()) {
    let raw = NODE_ENV.with(Cell::get);

    unsafe {
        let mut handle_scope: sys::napi_handle_scope = std::ptr::null_mut();
        sys::napi_open_handle_scope(raw, &mut handle_scope);

        let mut resource: sys::napi_value = std::ptr::null_mut();
        sys::napi_get_reference_value(raw, RESOURCE_REF.with(Cell::get), &mut resource);

        let mut callback_scope: sys::napi_callback_scope = std::ptr::null_mut();
        let callback_open = sys::napi_open_callback_scope(
            raw,
            resource,
            ASYNC_CONTEXT.with(Cell::get),
            &mut callback_scope,
        ) == sys::Status::napi_ok;

        dispatch();

        if callback_open {
            sys::napi_close_callback_scope(raw, callback_scope);
        }
        sys::napi_close_handle_scope(raw, handle_scope);
    }
}

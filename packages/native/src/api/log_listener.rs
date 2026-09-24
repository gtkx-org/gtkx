use napi::bindgen_prelude::{FnArgs, Function};
use napi::threadsafe_function::ThreadsafeCallContext;
use napi_derive::napi;

use crate::host::log_writer::{self, LogRecord};

type Listener<'a> = Function<'a, FnArgs<(String, String, String)>, ()>;

/// Registers `listener` for every `GLib` log record the process writes, whichever thread logs it,
/// and returns the id `removeLogListener` takes. Records are queued to the JavaScript thread and
/// delivered asynchronously; a level `GLib` treats as fatal aborts the process before the queued
/// delivery runs, and removing a listener does not cancel records already queued for it.
#[allow(clippy::needless_pass_by_value)]
#[napi(js_name = "addLogListener", catch_unwind)]
pub fn add_log_listener(
    #[napi(
        ts_arg_type = "(level: \"error\" | \"critical\" | \"warning\" | \"message\" | \"info\" | \"debug\", domain: string, message: string) => void"
    )]
    listener: Listener<'_>,
) -> napi::Result<u32> {
    let listener = listener
        .build_threadsafe_function::<LogRecord>()
        .callee_handled::<false>()
        .weak::<true>()
        .build_callback(|context: ThreadsafeCallContext<LogRecord>| {
            Ok(FnArgs::from((
                context.value.level,
                context.value.domain,
                context.value.message,
            )))
        })?;

    Ok(log_writer::add_listener(listener))
}

/// Removes the listener `addLogListener` returned `id` for; an unknown or already removed id is
/// ignored.
#[napi(js_name = "removeLogListener", catch_unwind)]
pub fn remove_log_listener(id: u32) {
    log_writer::remove_listener(id);
}

use napi::bindgen_prelude::{FnArgs, Function};
use napi::threadsafe_function::ThreadsafeCallContext;
use napi_derive::napi;

use crate::host::log_writer::{self, LogRecord};

type Listener<'a> = Function<'a, FnArgs<(String, String, String)>, ()>;

#[napi]
pub struct LogSubscription {
    id: Option<u64>,
}

impl LogSubscription {
    fn unsubscribe_inner(&mut self) {
        if let Some(id) = self.id.take() {
            log_writer::remove_listener(id);
        }
    }
}

#[napi]
impl LogSubscription {
    #[napi(catch_unwind)]
    pub fn unsubscribe(&mut self) {
        self.unsubscribe_inner();
    }
}

impl Drop for LogSubscription {
    fn drop(&mut self) {
        self.unsubscribe_inner();
    }
}

#[allow(clippy::needless_pass_by_value)]
#[napi(catch_unwind)]
pub fn on_log(
    #[napi(
        ts_arg_type = "(level: \"error\" | \"critical\" | \"warning\" | \"message\" | \"info\" | \"debug\", domain: string, message: string) => void"
    )]
    listener: Listener<'_>,
) -> napi::Result<LogSubscription> {
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

    Ok(LogSubscription {
        id: Some(log_writer::add_listener(listener)),
    })
}

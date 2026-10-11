use napi::Env;
use napi::bindgen_prelude::{BigInt, FnArgs, Function};
use napi::threadsafe_function::ThreadsafeCallContext;
use napi_derive::napi;

use crate::host::log_writer::{self, LogRecord};

type Sink<'a> = Function<'a, FnArgs<(BigInt, String, String, String)>, ()>;

/// Installs the environment's single asynchronous sink for copied `GLib` records and fences.
/// Its weak thread-safe function does not keep the event loop alive and is removed on teardown.
#[allow(clippy::needless_pass_by_value)]
#[napi(js_name = "installLogSink", catch_unwind)]
pub fn install_log_sink(
    env: Env,
    #[napi(
        ts_arg_type = "(sequence: bigint, level: \"error\" | \"critical\" | \"warning\" | \"message\" | \"info\" | \"debug\" | \"fence\", domain: string, message: string) => void"
    )]
    sink: Sink<'_>,
) -> napi::Result<()> {
    let sink = sink
        .build_threadsafe_function::<LogRecord>()
        .callee_handled::<false>()
        .weak::<true>()
        .build_callback(|context: ThreadsafeCallContext<LogRecord>| {
            Ok(FnArgs::from((
                BigInt::from(context.value.sequence),
                context.value.level,
                context.value.domain,
                context.value.message,
            )))
        })?;
    let environment = env.raw() as usize;
    log_writer::install_sink(environment, sink)?;
    if let Err(error) = env.add_env_cleanup_hook(environment, log_writer::remove_sink) {
        log_writer::remove_sink(environment);
        return Err(error);
    }
    Ok(())
}

/// Orders an interval boundary with log enqueueing and queues a marker that releases retired
/// runtime subscriptions even when no further logs are produced.
#[napi(js_name = "logSubscriptionFence", catch_unwind)]
pub fn log_subscription_fence(env: Env) -> napi::Result<BigInt> {
    log_writer::subscription_fence(env.raw() as usize).map(BigInt::from)
}

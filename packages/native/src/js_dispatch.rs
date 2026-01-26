//! Callback dispatch from GTK thread back to JavaScript.
//!
//! This module handles invoking JavaScript callback functions from the GTK
//! thread. When GTK signals fire, they trigger closures that queue callbacks
//! here for execution in the JavaScript context.
//!
//! ## Flow
//!
//! 1. GTK signal handler calls [`JsDispatcher::queue`] with callback and args
//! 2. Callback is added to the pending queue and a Neon channel wakeup is sent
//! 3. [`JsDispatcher::process_pending`] is called in the JS context when the wakeup is received
//! 4. Each callback is invoked, and results are sent back via mpsc channel
//!
//! ## Synchronous Invocation
//!
//! - [`JsDispatcher::invoke_and_wait`]: Queues a callback and blocks until the result is available,
//!   dispatching pending GTK tasks while waiting to prevent deadlocks.

use std::collections::VecDeque;
use std::sync::{Arc, Mutex, OnceLock, mpsc};
use std::time::Duration;

use neon::prelude::*;

use crate::{gtk_dispatch, value::Value};

struct PendingCallback {
    callback: Arc<Root<JsFunction>>,
    args: Vec<Value>,
    capture_result: bool,
    result_tx: mpsc::Sender<Result<Value, ()>>,
}

pub struct JsDispatcher {
    queue: Mutex<VecDeque<PendingCallback>>,
}

static DISPATCHER: OnceLock<JsDispatcher> = OnceLock::new();

impl JsDispatcher {
    pub fn global() -> &'static JsDispatcher {
        DISPATCHER.get_or_init(JsDispatcher::new)
    }

    fn new() -> Self {
        Self {
            queue: Mutex::new(VecDeque::new()),
        }
    }

    fn push_callback(&self, callback: PendingCallback) {
        self.queue.lock().unwrap().push_back(callback);
    }

    fn pop_callback(&self) -> Option<PendingCallback> {
        self.queue.lock().unwrap().pop_front()
    }

    pub fn queue(
        &self,
        channel: &Channel,
        callback: Arc<Root<JsFunction>>,
        args: Vec<Value>,
        capture_result: bool,
    ) -> mpsc::Receiver<Result<Value, ()>> {
        let (tx, rx) = mpsc::channel();

        self.push_callback(PendingCallback {
            callback,
            args,
            capture_result,
            result_tx: tx,
        });

        channel.send(|mut cx| {
            Self::global().process_pending(&mut cx);
            Ok(())
        });

        rx
    }

    pub fn process_pending<'a, C: Context<'a>>(&self, cx: &mut C) {
        while let Some(pending) = self.pop_callback() {
            let result = Self::execute_callback(
                cx,
                &pending.callback,
                &pending.args,
                pending.capture_result,
            );
            let _ = pending.result_tx.send(result);
        }
    }

    pub fn invoke_and_wait<T, F>(
        &self,
        channel: &Channel,
        callback: &Arc<Root<JsFunction>>,
        args: Vec<Value>,
        capture_result: bool,
        on_result: F,
    ) -> T
    where
        F: FnOnce(Result<Value, ()>) -> T,
    {
        gtk_dispatch::GtkDispatcher::global().enter_callback();
        let rx = self.queue(channel, callback.clone(), args, capture_result);
        let result = self.wait_for_result(rx, on_result);
        gtk_dispatch::GtkDispatcher::global().exit_callback();
        result
    }

    fn wait_for_result<T, F>(&self, rx: mpsc::Receiver<Result<Value, ()>>, on_result: F) -> T
    where
        F: FnOnce(Result<Value, ()>) -> T,
    {
        const POLL_INTERVAL: Duration = Duration::from_micros(100);

        loop {
            gtk_dispatch::GtkDispatcher::global().dispatch_pending();

            match rx.recv_timeout(POLL_INTERVAL) {
                Ok(result) => return on_result(result),
                Err(mpsc::RecvTimeoutError::Timeout) => continue,
                Err(mpsc::RecvTimeoutError::Disconnected) => return on_result(Err(())),
            }
        }
    }

    fn execute_callback<'a, C: Context<'a>>(
        cx: &mut C,
        callback: &Arc<Root<JsFunction>>,
        args: &[Value],
        capture_result: bool,
    ) -> Result<Value, ()> {
        let js_args: Vec<Handle<JsValue>> = args
            .iter()
            .map(|v| v.to_js_value(cx))
            .collect::<NeonResult<Vec<_>>>()
            .map_err(|_| ())?;

        let js_this = cx.undefined();
        let js_callback = callback.to_inner(cx);

        if capture_result {
            let js_result = js_callback.call(cx, js_this, js_args).map_err(|_| ())?;
            Value::from_js_value(cx, js_result).map_err(|_| ())
        } else {
            js_callback.call(cx, js_this, js_args).map_err(|_| ())?;
            Ok(Value::Undefined)
        }
    }
}

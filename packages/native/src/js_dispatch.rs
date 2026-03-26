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
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex, OnceLock, mpsc};

use neon::prelude::*;

use crate::{gtk_dispatch, value::Value, wait_signal::WaitSignal};

struct PendingCallback {
    callback: Arc<Root<JsFunction>>,
    args: Vec<Value>,
    capture_result: bool,
    result_tx: mpsc::Sender<anyhow::Result<Value>>,
}

pub struct JsDispatcher {
    queue: Mutex<VecDeque<PendingCallback>>,
    pub wake: WaitSignal,
    pub signal_callback_depth: AtomicUsize,
}

static DISPATCHER: OnceLock<JsDispatcher> = OnceLock::new();

impl JsDispatcher {
    pub fn global() -> &'static JsDispatcher {
        DISPATCHER.get_or_init(JsDispatcher::new)
    }

    fn new() -> Self {
        Self {
            queue: Mutex::new(VecDeque::new()),
            wake: WaitSignal::new(),
            signal_callback_depth: AtomicUsize::new(0),
        }
    }

    fn push_callback(&self, callback: PendingCallback) {
        self.queue
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
            .push_back(callback);
        gtk_dispatch::GtkDispatcher::global().wake.notify();
    }

    fn pop_callback(&self) -> Option<PendingCallback> {
        self.queue
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
            .pop_front()
    }

    pub fn queue(
        &self,
        channel: &Channel,
        callback: Arc<Root<JsFunction>>,
        args: Vec<Value>,
        capture_result: bool,
    ) -> mpsc::Receiver<anyhow::Result<Value>> {
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
            self.signal_callback_depth.fetch_add(1, Ordering::AcqRel);
            let result = Self::execute_callback(
                cx,
                &pending.callback,
                &pending.args,
                pending.capture_result,
            );
            self.signal_callback_depth.fetch_sub(1, Ordering::AcqRel);
            if pending.result_tx.send(result).is_err() {
                // Receiver dropped — GTK thread is shutting down
            }
            self.wake.notify();
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
        F: FnOnce(anyhow::Result<Value>) -> T,
    {
        let rx = self.queue(channel, callback.clone(), args, capture_result);
        self.wait_for_result(&rx, on_result)
    }

    fn wait_for_result<T, F>(&self, rx: &mpsc::Receiver<anyhow::Result<Value>>, on_result: F) -> T
    where
        F: FnOnce(anyhow::Result<Value>) -> T,
    {
        loop {
            gtk_dispatch::GtkDispatcher::global().dispatch_signal_pending();

            match rx.try_recv() {
                Ok(result) => return on_result(result),
                Err(mpsc::TryRecvError::Disconnected) => {
                    return on_result(Err(anyhow::anyhow!("JS callback channel disconnected")));
                }
                Err(mpsc::TryRecvError::Empty) => self.wake.wait(),
            }
        }
    }

    fn execute_callback<'a, C: Context<'a>>(
        cx: &mut C,
        callback: &Arc<Root<JsFunction>>,
        args: &[Value],
        capture_result: bool,
    ) -> anyhow::Result<Value> {
        let callback = callback.clone();
        let args: Vec<Value> = args.to_vec();

        match cx.try_catch(|cx| {
            let js_args: Vec<Handle<JsValue>> = args
                .iter()
                .map(|v| v.to_js_value(cx))
                .collect::<NeonResult<Vec<_>>>()?;

            let js_this = cx.undefined();
            let js_callback = callback.to_inner(cx);

            if capture_result {
                let js_result = js_callback.call(cx, js_this, js_args)?;
                Value::from_js_value(cx, js_result)
            } else {
                js_callback.call(cx, js_this, js_args)?;
                Ok(Value::Undefined)
            }
        }) {
            Ok(value) => Ok(value),
            Err(exception) => {
                let msg = Self::extract_exception_message(cx, exception);
                Err(anyhow::anyhow!("{msg}"))
            }
        }
    }

    fn extract_exception_message<'a, C: Context<'a>>(
        cx: &mut C,
        exception: Handle<'a, JsValue>,
    ) -> String {
        if let Ok(obj) = exception.downcast::<JsObject, _>(cx)
            && let Ok(msg_handle) = obj.get_value(cx, "message")
            && let Ok(msg_str) = msg_handle.downcast::<JsString, _>(cx)
        {
            return msg_str.value(cx);
        }
        if let Ok(s) = exception.downcast::<JsString, _>(cx) {
            return s.value(cx);
        }
        "unknown exception".to_owned()
    }
}

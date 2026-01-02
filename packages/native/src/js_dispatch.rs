//! Callback dispatch from GTK thread back to JavaScript.
//!
//! This module handles invoking JavaScript callback functions from the GTK
//! thread. When GTK signals fire, they trigger closures that queue callbacks
//! here for execution in the JavaScript context.
//!
//! ## Flow
//!
//! 1. GTK signal handler calls [`queue`] or [`queue_with_wakeup`] with callback and args
//! 2. Callback is added to the pending queue
//! 3. [`process_pending`] is called in the JS context (via poll or channel wakeup)
//! 4. Each callback is invoked, and results are sent back via mpsc channel
//!
//! ## Wakeup Mechanism
//!
//! - [`queue`]: Queues callback without waking JavaScript (for use during blocking calls)
//! - [`queue_with_wakeup`]: Queues and sends a Neon channel message to wake JavaScript

use std::sync::{Arc, mpsc};

use neon::prelude::*;

use crate::{queue::Queue, value::Value};

pub struct PendingCallback {
    pub callback: Arc<Root<JsFunction>>,
    pub args: Vec<Value>,
    pub capture_result: bool,
    pub result_tx: mpsc::Sender<Result<Value, ()>>,
}

static QUEUE: Queue<PendingCallback> = Queue::new();

pub fn queue(
    callback: Arc<Root<JsFunction>>,
    args: Vec<Value>,
    capture_result: bool,
) -> mpsc::Receiver<Result<Value, ()>> {
    let (tx, rx) = mpsc::channel();

    QUEUE.push(PendingCallback {
        callback,
        args,
        capture_result,
        result_tx: tx,
    });

    rx
}

pub fn queue_with_wakeup(
    channel: &Channel,
    callback: Arc<Root<JsFunction>>,
    args: Vec<Value>,
    capture_result: bool,
) -> mpsc::Receiver<Result<Value, ()>> {
    let rx = queue(callback, args, capture_result);

    channel.send(|mut cx| {
        process_pending(&mut cx);
        Ok(())
    });

    rx
}

pub fn process_pending<'a, C: Context<'a>>(cx: &mut C) {
    while let Some(pending) = QUEUE.pop() {
        let result = execute_callback(cx, &pending.callback, &pending.args, pending.capture_result);
        let _ = pending.result_tx.send(result);
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

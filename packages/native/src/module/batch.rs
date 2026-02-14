use std::sync::mpsc;

use neon::prelude::*;

use crate::gtk_dispatch;

pub fn begin_batch(mut cx: FunctionContext) -> JsResult<JsUndefined> {
    let dispatcher = gtk_dispatch::GtkDispatcher::global();

    if !dispatcher.is_started() {
        return cx.throw_error("GTK application has not been started. Call start() first.");
    }

    let is_outermost = dispatcher.begin_batch();

    if is_outermost {
        let (tx, rx) = mpsc::channel::<()>();

        dispatcher.enter_js_wait();
        dispatcher.schedule(move || {
            let _ = tx.send(());
            let d = gtk_dispatch::GtkDispatcher::global();
            d.wake.notify();
            d.run_batch_loop();
        });

        dispatcher
            .wait_for_gtk_result(&mut cx, &rx)
            .or_else(|err| cx.throw_error(err.to_string()))?;
    }

    Ok(cx.undefined())
}

pub fn end_batch(mut cx: FunctionContext) -> JsResult<JsUndefined> {
    gtk_dispatch::GtkDispatcher::global().end_batch();
    Ok(cx.undefined())
}



use std::sync::mpsc;

use neon::prelude::*;

use crate::{
    gtk_dispatch,
    state::{GtkThreadState, join_gtk_thread},
};

pub fn stop(mut cx: FunctionContext) -> JsResult<JsUndefined> {
    let (tx, rx) = mpsc::channel::<()>();

    gtk_dispatch::schedule(move || {
        gtk_dispatch::mark_stopped();

        GtkThreadState::with(|state| {
            state.app_hold_guard.take();
        });

        let _ = tx.send(());
    });

    rx.recv()
        .or_else(|err| cx.throw_error(format!("Error stopping GTK thread: {err}")))?;

    join_gtk_thread();

    Ok(cx.undefined())
}

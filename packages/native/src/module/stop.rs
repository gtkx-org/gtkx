//! GTK main loop shutdown.

use std::sync::mpsc;

use neon::prelude::*;

use crate::{
    gtk_dispatch,
    state::{GtkThreadState, join_gtk_thread},
};

/// Stops the GTK main loop.
///
/// JavaScript signature: `stop() => void`
///
/// Releases the application hold guard allowing the GTK main loop to exit,
/// then joins the GTK thread to ensure clean shutdown. Also marks the dispatch
/// system as stopped to prevent crashes from GC finalizers running after
/// the main loop has exited.
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

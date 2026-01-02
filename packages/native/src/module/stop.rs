//! Graceful GTK application shutdown.
//!
//! The [`stop`] function releases the application hold guard, marks the
//! dispatch queue as stopped, and joins the GTK thread.
//!
//! ## Shutdown Sequence
//!
//! 1. Schedule a task on the GTK thread to:
//!    - Mark the dispatch queue as stopped (no new tasks accepted)
//!    - Release the application hold guard (allows GTK main loop to exit)
//! 2. Wait for confirmation that the task completed
//! 3. Join the GTK thread, waiting for it to fully terminate

use neon::prelude::*;

use crate::{
    gtk_dispatch,
    state::{GtkThreadState, join_gtk_thread},
};

pub fn stop(mut cx: FunctionContext) -> JsResult<JsUndefined> {
    let rx = gtk_dispatch::run_on_gtk_thread(|| {
        gtk_dispatch::mark_stopped();

        GtkThreadState::with(|state| {
            state.app_hold_guard.take();
        });
    });

    rx.recv()
        .or_else(|err| cx.throw_error(format!("Error stopping GTK thread: {err}")))?;

    join_gtk_thread();

    Ok(cx.undefined())
}

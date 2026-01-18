//! GTK application initialization and thread spawning.
//!
//! The [`start`] function creates a GTK `Application`, spawns a dedicated
//! GTK thread, and waits for the application to activate before returning.
//!
//! ## Startup Sequence
//!
//! 1. Parse application ID and optional flags from JavaScript
//! 2. Spawn a new OS thread for the GTK main loop
//! 3. Create the `GtkApplication` and connect the activate signal
//! 4. Acquire an application hold guard to prevent auto-shutdown
//! 5. Start the GTK main loop with `app.run_with_args`
//! 6. When activate fires, send the application's `NativeHandle` back to JS
//! 7. Return the `NativeHandle` to JavaScript

use std::sync::mpsc;

use gtk4::{gio::ApplicationFlags, prelude::*};
use neon::prelude::*;

use crate::{
    gtk_dispatch::GtkDispatcher,
    managed::{NativeHandle, NativeValue},
    state::{GtkThread, GtkThreadState},
};

pub fn start(mut cx: FunctionContext) -> JsResult<JsValue> {
    let app_id = cx.argument::<JsString>(0)?.value(&mut cx);

    let flags_value: Option<u32> = cx.argument_opt(1).and_then(|arg| {
        arg.downcast::<JsNumber, _>(&mut cx)
            .ok()
            .map(|n| n.value(&mut cx) as u32)
    });

    let flags = flags_value
        .map(ApplicationFlags::from_bits_truncate)
        .unwrap_or(ApplicationFlags::FLAGS_NONE);

    let (tx, rx) = mpsc::channel::<NativeHandle>();

    let handle = std::thread::spawn(move || {
        let app = gtk4::Application::builder()
            .application_id(app_id)
            .flags(flags)
            .build();

        let app_handle: NativeHandle = NativeValue::GObject(app.clone().into()).into();

        GtkThreadState::with(|state| {
            state.app_hold_guard = Some(app.hold());
        });

        app.connect_activate(move |_| {
            let _ = tx.send(app_handle);
        });

        app.run_with_args::<&str>(&[]);
    });

    GtkThread::global().set_handle(handle);

    let app_handle = rx
        .recv()
        .or_else(|err| cx.throw_error(format!("Error starting GTK thread: {err}")))?;

    GtkDispatcher::global().mark_started();

    Ok(cx.boxed(app_handle).upcast())
}

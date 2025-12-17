//! GTK application initialization and main loop startup.

use std::sync::mpsc;

use gtk4::{gio::ApplicationFlags, prelude::*};
use neon::prelude::*;

use crate::{
    object::{Object, ObjectId},
    state::{set_gtk_thread_handle, GtkThreadState},
};

/// Starts the GTK application and main loop.
///
/// JavaScript signature: `start(appId: string, flags?: number) => ObjectId`
///
/// Creates a GTK Application with the given ID, starts the main loop on a
/// dedicated thread, and returns the application's ObjectId. The function
/// blocks until the application is activated.
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

    let (tx, rx) = mpsc::channel::<ObjectId>();

    let handle = std::thread::spawn(move || {
        let app = gtk4::Application::builder()
            .application_id(app_id)
            .flags(flags)
            .build();

        let app_object_id = ObjectId::new(Object::GObject(app.clone().into()));

        GtkThreadState::with(|state| {
            state.app_hold_guard = Some(app.hold());
        });

        app.connect_activate(move |_| {
            // Ignore SendError - the receiver may have been dropped after the first activation
            // This can happen if the app is re-activated via D-Bus while already running
            let _ = tx.send(app_object_id);
        });

        app.run_with_args::<&str>(&[]);
    });

    set_gtk_thread_handle(handle);

    let app_object_id = rx
        .recv()
        .or_else(|err| cx.throw_error(format!("Error starting GTK thread: {err}")))?;

    Ok(cx.boxed(app_object_id).upcast())
}

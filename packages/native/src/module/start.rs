//! GTK application initialization and thread spawning.
//!
//! The [`start`] function creates a GTK `Application`, spawns a dedicated
//! `GLib` thread, and waits for the application to activate before returning.
//!
//! ## Startup Sequence
//!
//! 1. Parse application ID and optional flags from JavaScript
//! 2. Spawn a new OS thread that runs the `GLib` main loop
//! 3. Create the `GtkApplication` and connect the activate signal
//! 4. Acquire an application hold guard to prevent auto-shutdown
//! 5. Start the main loop with `app.run_with_args`
//! 6. When activate fires, send the application's `NativeHandle` back to JS
//! 7. Return the `NativeHandle` to JavaScript

use std::sync::mpsc;

use gtk4::{gio::ApplicationFlags, prelude::*};
use neon::prelude::*;

use super::handler::{JsThreadCommand, execute_js_command};
use crate::{
    dispatch::Mailbox,
    error_reporter::NativeErrorReporter,
    glib_log_handler::GlibLogHandler,
    managed::{NativeHandle, NativeValue},
    state::{GtkThread, GtkThreadState},
};

struct StartCommand {
    app_id: String,
    flags: ApplicationFlags,
}

impl JsThreadCommand for StartCommand {
    fn from_js(cx: &mut FunctionContext) -> NeonResult<Self> {
        let app_id = cx.argument::<JsString>(0)?.value(cx);

        let flags_value: Option<u32> = cx.argument_opt(1).and_then(|arg| {
            arg.downcast::<JsNumber, _>(cx)
                .ok()
                .map(|n| n.value(cx) as u32)
        });

        let flags = flags_value.map_or(
            ApplicationFlags::FLAGS_NONE,
            ApplicationFlags::from_bits_truncate,
        );

        Ok(Self { app_id, flags })
    }

    fn execute<'a>(self, cx: &mut FunctionContext<'a>) -> JsResult<'a, JsValue> {
        let mut error_channel = cx.channel();
        error_channel.unref(cx);
        NativeErrorReporter::global().initialize(error_channel);

        let (tx, rx) = mpsc::channel::<NativeHandle>();

        let handle = std::thread::spawn(move || {
            GlibLogHandler::install();

            let app = gtk4::Application::builder()
                .application_id(self.app_id)
                .flags(self.flags)
                .build();

            let app_handle: NativeHandle = NativeValue::GObject(app.clone().into()).into();

            GtkThreadState::with(|state| {
                state.app_hold_guard = Some(app.hold());
            });

            app.connect_activate(move |_| {
                if tx.send(app_handle.clone()).is_err() {
                    NativeErrorReporter::global().report_str(
                        "GTK application activated but startup channel was already closed",
                    );
                }
            });

            app.run_with_args::<&str>(&[]);
        });

        GtkThread::global().set_handle(handle);

        let app_handle = rx
            .recv()
            .or_else(|err| cx.throw_error(format!("Error starting GTK thread: {err}")))?;

        Mailbox::global().mark_started();

        Ok(cx.boxed(app_handle).upcast())
    }
}

pub fn start(mut cx: FunctionContext) -> JsResult<JsValue> {
    execute_js_command::<StartCommand>(&mut cx)
}

use std::sync::mpsc;

use gtk4::{gio::ApplicationFlags, prelude::*};
use neon::prelude::*;

use crate::{
    object::{Object, ObjectId},
    state::GtkThreadState,
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

    let (tx, rx) = mpsc::channel::<ObjectId>();

    std::thread::spawn(move || {
        let app = gtk4::Application::builder()
            .application_id(app_id)
            .flags(flags)
            .build();
        let app_object_id = ObjectId::new(Object::GObject(app.clone().into()));

        GtkThreadState::with(|state| {
            state.app_hold_guard = Some(app.hold());
            state.app = Some(app.clone());
        });

        app.connect_activate(move |_| {
            tx.send(app_object_id).unwrap();
        });

        app.run_with_args::<&str>(&[]);
    });

    let app_object_id = rx
        .recv()
        .or_else(|err| cx.throw_error(format!("Error starting GTK thread: {err}")))?;

    Ok(cx.boxed(app_object_id).upcast())
}

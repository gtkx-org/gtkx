

use std::sync::mpsc;

use gtk4::glib::ffi::g_malloc0;
use neon::prelude::*;

use crate::{
    boxed::Boxed,
    gtk_dispatch,
    object::{Object, ObjectId},
    types::BoxedType,
};

pub fn alloc(mut cx: FunctionContext) -> JsResult<JsValue> {
    let size = cx.argument::<JsNumber>(0)?.value(&mut cx) as usize;
    let type_name = cx.argument::<JsString>(1)?.value(&mut cx);
    let lib_name = cx
        .argument_opt(2)
        .and_then(|v| v.downcast::<JsString, _>(&mut cx).ok())
        .map(|s| s.value(&mut cx));

    let (tx, rx) = mpsc::channel::<anyhow::Result<ObjectId>>();

    gtk_dispatch::schedule(move || {
        tx.send(handle_alloc(size, &type_name, lib_name.as_deref()))
            .expect("Alloc result channel disconnected");
    });

    let object_id = rx
        .recv()
        .or_else(|err| cx.throw_error(format!("Error receiving alloc result: {err}")))?
        .or_else(|err| cx.throw_error(format!("Error during alloc: {err}")))?;

    Ok(cx.boxed(object_id).upcast())
}

fn handle_alloc(size: usize, type_name: &str, lib_name: Option<&str>) -> anyhow::Result<ObjectId> {
    let boxed_type = BoxedType::new(false, type_name.to_string(), lib_name.map(String::from), None);
    let gtype = boxed_type.get_gtype();

    let ptr = unsafe { g_malloc0(size) };

    if ptr.is_null() {
        anyhow::bail!("Failed to allocate memory for {}", type_name);
    }

    let boxed = Boxed::from_glib_full(gtype, ptr);
    Ok(ObjectId::new(Object::Boxed(boxed)))
}

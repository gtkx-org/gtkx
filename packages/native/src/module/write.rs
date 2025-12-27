

use std::sync::mpsc;

use anyhow::bail;
use neon::prelude::*;

use crate::{
    gtk_dispatch,
    object::ObjectId,
    types::{FloatSize, IntegerSign, IntegerSize, Type},
    value::Value,
};

pub fn write(mut cx: FunctionContext) -> JsResult<JsUndefined> {
    let object_id = cx.argument::<JsBox<ObjectId>>(0)?;
    let js_type = cx.argument::<JsObject>(1)?;
    let offset = cx.argument::<JsNumber>(2)?.value(&mut cx) as usize;
    let js_value = cx.argument::<JsValue>(3)?;
    let type_ = Type::from_js_value(&mut cx, js_type.upcast())?;
    let value = Value::from_js_value(&mut cx, js_value)?;
    let object_id = *object_id.as_inner();
    let (tx, rx) = mpsc::channel::<anyhow::Result<()>>();

    gtk_dispatch::schedule(move || {
        let _ = tx.send(handle_write(object_id, &type_, offset, &value));
    });

    rx.recv()
        .or_else(|err| cx.throw_error(format!("Error receiving write result: {err}")))?
        .or_else(|err| cx.throw_error(format!("Error during write: {err}")))?;

    Ok(cx.undefined())
}

fn handle_write(
    object_id: ObjectId,
    type_: &Type,
    offset: usize,
    value: &Value,
) -> anyhow::Result<()> {
    let ptr = object_id
        .as_ptr()
        .ok_or_else(|| anyhow::anyhow!("Object has been garbage collected"))?;

    if ptr.is_null() {
        bail!("Cannot write field to null pointer");
    }

    let field_ptr = unsafe { (ptr as *mut u8).add(offset) };

    match (type_, value) {
        (Type::Integer(int_type), Value::Number(n)) => {
            dispatch_integer_write!(int_type, field_ptr, *n);
        }
        (Type::Float(float_type), Value::Number(n)) => match float_type.size {
            FloatSize::_32 => unsafe { field_ptr.cast::<f32>().write_unaligned(*n as f32) },
            FloatSize::_64 => unsafe { field_ptr.cast::<f64>().write_unaligned(*n) },
        },
        (Type::Boolean, Value::Boolean(b)) => unsafe {
            field_ptr.cast::<u8>().write_unaligned(u8::from(*b));
        },
        _ => bail!("Unsupported field type for write: {:?}", type_),
    }

    Ok(())
}

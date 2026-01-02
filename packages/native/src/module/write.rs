//! Field writing to boxed/structured memory.
//!
//! The [`write`] function writes a value to a field in a boxed type at a
//! given byte offset. This enables JavaScript to modify struct fields that
//! aren't exposed via GTK property mutators.
//!
//! ## Supported Types
//!
//! Currently limited to primitive types:
//! - `Integer` (all sizes and signs)
//! - `Float` (f32, f64)
//! - `Boolean`

use anyhow::bail;
use neon::prelude::*;

use crate::{
    gtk_dispatch,
    integer,
    object::ObjectId,
    types::{FloatSize, Type},
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

    let rx = gtk_dispatch::run_on_gtk_thread(move || handle_write(object_id, &type_, offset, &value));

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
    let field_ptr = object_id.field_ptr(offset)?;

    match (type_, value) {
        (Type::Integer(int_type), Value::Number(n)) => {
            integer::write(int_type, field_ptr, *n);
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


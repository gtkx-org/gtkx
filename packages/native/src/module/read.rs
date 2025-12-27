

use std::ffi::{CStr, c_void};
use std::sync::mpsc;

use anyhow::bail;
use gtk4::glib::{self, translate::FromGlibPtrNone as _};
use neon::prelude::*;

use crate::{
    boxed::Boxed,
    gtk_dispatch,
    object::{Object, ObjectId},
    types::{FloatSize, IntegerSign, IntegerSize, Type},
    value::Value,
};

pub fn read(mut cx: FunctionContext) -> JsResult<JsValue> {
    let object_id = cx.argument::<JsBox<ObjectId>>(0)?;
    let js_type = cx.argument::<JsObject>(1)?;
    let offset = cx.argument::<JsNumber>(2)?.value(&mut cx) as usize;
    let type_ = Type::from_js_value(&mut cx, js_type.upcast())?;
    let object_id = *object_id.as_inner();
    let (tx, rx) = mpsc::channel::<anyhow::Result<Value>>();

    gtk_dispatch::schedule(move || {
        let _ = tx.send(handle_read(object_id, &type_, offset));
    });

    let value = rx
        .recv()
        .or_else(|err| cx.throw_error(format!("Error receiving read result: {err}")))?
        .or_else(|err| cx.throw_error(format!("Error during read: {err}")))?;

    value.to_js_value(&mut cx)
}

fn handle_read(object_id: ObjectId, type_: &Type, offset: usize) -> anyhow::Result<Value> {
    let ptr = object_id
        .as_ptr()
        .ok_or_else(|| anyhow::anyhow!("Object has been garbage collected"))?;

    if ptr.is_null() {
        bail!("Cannot read field from null pointer");
    }

    let field_ptr = unsafe { (ptr as *const u8).add(offset) };

    match type_ {
        Type::Integer(int_type) => {
            let number = dispatch_integer_read!(int_type, field_ptr);
            Ok(Value::Number(number))
        }
        Type::Float(float_type) => {
            let number = match float_type.size {
                FloatSize::_32 => unsafe { field_ptr.cast::<f32>().read_unaligned() as f64 },
                FloatSize::_64 => unsafe { field_ptr.cast::<f64>().read_unaligned() },
            };

            Ok(Value::Number(number))
        }
        Type::Boolean => {
            let value = unsafe { field_ptr.cast::<u8>().read_unaligned() != 0 };
            Ok(Value::Boolean(value))
        }
        Type::String(_) => {
            let str_ptr = unsafe { field_ptr.cast::<*const i8>().read_unaligned() };

            if str_ptr.is_null() {
                return Ok(Value::Null);
            }

            let c_str = unsafe { CStr::from_ptr(str_ptr) };
            let string = c_str.to_str()?.to_string();
            Ok(Value::String(string))
        }
        Type::GObject(_) => {
            let obj_ptr = unsafe {
                field_ptr
                    .cast::<*mut glib::gobject_ffi::GObject>()
                    .read_unaligned()
            };

            if obj_ptr.is_null() {
                return Ok(Value::Null);
            }

            let object = unsafe { glib::Object::from_glib_none(obj_ptr) };
            Ok(Value::Object(ObjectId::new(Object::GObject(object))))
        }
        Type::Boxed(boxed_type) => {
            let boxed_ptr = unsafe { field_ptr.cast::<*mut c_void>().read_unaligned() };

            if boxed_ptr.is_null() {
                return Ok(Value::Null);
            }

            let gtype = boxed_type.get_gtype();
            let boxed = Boxed::from_glib_none(gtype, boxed_ptr);
            Ok(Value::Object(ObjectId::new(Object::Boxed(boxed))))
        }
        _ => bail!("Unsupported field type for read_field: {:?}", type_),
    }
}

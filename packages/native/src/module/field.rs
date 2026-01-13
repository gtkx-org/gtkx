//! Field access for boxed/structured memory.
//!
//! This module provides read and write access to fields in boxed types at given
//! byte offsets. This enables JavaScript to access struct fields that aren't
//! exposed via GTK property accessors.
//!
//! ## Read Types
//!
//! - `Integer` (all sizes and signs)
//! - `Float` (f32, f64)
//! - `Boolean`
//! - `String` (as pointer to C string)
//! - `GObject` (as pointer to object)
//! - `Boxed` (as pointer to boxed value)
//!
//! ## Write Types
//!
//! Currently limited to primitive types:
//! - `Integer` (all sizes and signs)
//! - `Float` (f32, f64)
//! - `Boolean`

use std::ffi::{CStr, c_char, c_void};

use anyhow::bail;
use gtk4::glib::{self, translate::FromGlibPtrNone as _};
use neon::prelude::*;

use crate::{
    gtk_dispatch,
    managed::{Boxed, NativeHandle, NativeValue},
    types::Type,
    value::Value,
};

struct ReadRequest {
    object_id: NativeHandle,
    field_type: Type,
    offset: usize,
}

impl ReadRequest {
    fn from_js(cx: &mut FunctionContext) -> NeonResult<Self> {
        let object_id = cx.argument::<JsBox<NativeHandle>>(0)?;
        let js_type = cx.argument::<JsObject>(1)?;
        let offset = cx.argument::<JsNumber>(2)?.value(cx) as usize;
        let field_type = Type::from_js_value(cx, js_type.upcast())?;
        let object_id = *object_id.as_inner();

        Ok(Self {
            object_id,
            field_type,
            offset,
        })
    }

    fn execute(self) -> anyhow::Result<Value> {
        let field_ptr = self.object_id.field_ptr_const(self.offset)?;

        match self.field_type {
            Type::Integer(int_type) => {
                let number = int_type.kind.read_ptr(field_ptr);
                Ok(Value::Number(number))
            }
            Type::Float(float_kind) => {
                let number = float_kind.read_ptr(field_ptr);
                Ok(Value::Number(number))
            }
            Type::Boolean => {
                // SAFETY: field_ptr is valid and within bounds (checked by field_ptr_const)
                let value = unsafe { field_ptr.cast::<u8>().read_unaligned() != 0 };
                Ok(Value::Boolean(value))
            }
            Type::String(_) => {
                // SAFETY: field_ptr is valid and contains a C string pointer
                let str_ptr = unsafe { field_ptr.cast::<*const c_char>().read_unaligned() };

                if str_ptr.is_null() {
                    return Ok(Value::Null);
                }

                // SAFETY: str_ptr is a valid null-terminated C string from GTK
                let c_str = unsafe { CStr::from_ptr(str_ptr) };
                let string = c_str.to_str()?.to_string();
                Ok(Value::String(string))
            }
            Type::GObject(_) => {
                // SAFETY: field_ptr is valid and contains a GObject pointer
                let obj_ptr = unsafe {
                    field_ptr
                        .cast::<*mut glib::gobject_ffi::GObject>()
                        .read_unaligned()
                };

                if obj_ptr.is_null() {
                    return Ok(Value::Null);
                }

                // SAFETY: obj_ptr is a valid GObject from GTK
                let object = unsafe { glib::Object::from_glib_none(obj_ptr) };
                Ok(Value::Object(NativeValue::GObject(object).into()))
            }
            Type::Boxed(ref boxed_type) => {
                // SAFETY: field_ptr is valid and contains a boxed pointer
                let boxed_ptr = unsafe { field_ptr.cast::<*mut c_void>().read_unaligned() };

                if boxed_ptr.is_null() {
                    return Ok(Value::Null);
                }

                let gtype = boxed_type.gtype();
                let boxed = Boxed::from_glib_none(gtype, boxed_ptr)?;
                Ok(Value::Object(NativeValue::Boxed(boxed).into()))
            }
            _ => bail!("Unsupported field type for read: {:?}", self.field_type),
        }
    }
}

pub fn read(mut cx: FunctionContext) -> JsResult<JsValue> {
    let request = ReadRequest::from_js(&mut cx)?;

    let rx = gtk_dispatch::GtkDispatcher::global().run_on_gtk_thread(move || request.execute());

    let value = rx
        .recv()
        .or_else(|err| cx.throw_error(format!("Error receiving read result: {err}")))?
        .or_else(|err| cx.throw_error(format!("Error during read: {err}")))?;

    value.to_js_value(&mut cx)
}

struct WriteRequest {
    object_id: NativeHandle,
    field_type: Type,
    offset: usize,
    value: Value,
}

impl WriteRequest {
    fn from_js(cx: &mut FunctionContext) -> NeonResult<Self> {
        let object_id = cx.argument::<JsBox<NativeHandle>>(0)?;
        let js_type = cx.argument::<JsObject>(1)?;
        let offset = cx.argument::<JsNumber>(2)?.value(cx) as usize;
        let js_value = cx.argument::<JsValue>(3)?;
        let field_type = Type::from_js_value(cx, js_type.upcast())?;
        let value = Value::from_js_value(cx, js_value)?;
        let object_id = *object_id.as_inner();

        Ok(Self {
            object_id,
            field_type,
            offset,
            value,
        })
    }

    fn execute(self) -> anyhow::Result<()> {
        let field_ptr = self.object_id.field_ptr(self.offset)?;

        match (&self.field_type, &self.value) {
            (Type::Integer(int_type), Value::Number(n)) => {
                int_type.kind.write_ptr(field_ptr, *n);
            }
            (Type::Float(float_kind), Value::Number(n)) => {
                float_kind.write_ptr(field_ptr, *n);
            }
            (Type::Boolean, Value::Boolean(b)) => {
                // SAFETY: field_ptr is valid and within bounds (checked by field_ptr)
                unsafe {
                    field_ptr.cast::<u8>().write_unaligned(u8::from(*b));
                }
            }
            _ => bail!("Unsupported field type for write: {:?}", self.field_type),
        }

        Ok(())
    }
}

pub fn write(mut cx: FunctionContext) -> JsResult<JsUndefined> {
    let request = WriteRequest::from_js(&mut cx)?;

    let rx = gtk_dispatch::GtkDispatcher::global().run_on_gtk_thread(move || request.execute());

    rx.recv()
        .or_else(|err| cx.throw_error(format!("Error receiving write result: {err}")))?
        .or_else(|err| cx.throw_error(format!("Error during write: {err}")))?;

    Ok(cx.undefined())
}

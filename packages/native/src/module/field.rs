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
//! - `Fundamental` (as pointer to fundamental value)
//! - `Struct` (as pointer to struct, copied with known size)
//!
//! ## Write Types
//!
//! - `Integer` (all sizes and signs)
//! - `Float` (f32, f64)
//! - `Boolean`
//! - `String` (copies via g_strdup)
//! - `GObject` / `Boxed` / `Struct` / `Fundamental` (writes pointer value)

use std::ffi::{CStr, c_char, c_void};

use anyhow::bail;
use gtk4::glib::{self, translate::FromGlibPtrNone as _};
use neon::prelude::*;

use crate::{
    gtk_dispatch,
    managed::{Boxed, Fundamental, NativeHandle, NativeValue},
    types::{IntegerKind, Type},
    value::Value,
};

struct ReadRequest {
    handle: NativeHandle,
    field_type: Type,
    offset: usize,
}

impl ReadRequest {
    fn from_js(cx: &mut FunctionContext) -> NeonResult<Self> {
        let handle = cx.argument::<JsBox<NativeHandle>>(0)?;
        let js_type = cx.argument::<JsObject>(1)?;
        let offset = cx.argument::<JsNumber>(2)?.value(cx) as usize;
        let field_type = Type::from_js_value(cx, js_type.upcast())?;
        let handle = *handle.as_inner();

        Ok(Self {
            handle,
            field_type,
            offset,
        })
    }

    fn execute(self) -> anyhow::Result<Value> {
        let base_ptr = self.handle.require_non_null_ptr()?;
        let field_ptr = unsafe { (base_ptr as *const u8).add(self.offset) };

        match self.field_type {
            Type::Integer(int_kind) => {
                let number = int_kind.read_ptr(field_ptr);
                Ok(Value::Number(number))
            }
            Type::Enum(_) => {
                let number = IntegerKind::I32.read_ptr(field_ptr);
                Ok(Value::Number(number))
            }
            Type::Flags(_) => {
                let number = IntegerKind::U32.read_ptr(field_ptr);
                Ok(Value::Number(number))
            }
            Type::Float(float_kind) => {
                let number = float_kind.read_ptr(field_ptr);
                Ok(Value::Number(number))
            }
            Type::Boolean => {
                let value = unsafe { field_ptr.cast::<i32>().read_unaligned() != 0 };
                Ok(Value::Boolean(value))
            }
            Type::String(_) => {
                let str_ptr = unsafe { field_ptr.cast::<*const c_char>().read_unaligned() };

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
                Ok(Value::Object(NativeValue::GObject(object).into()))
            }
            Type::Boxed(ref boxed_type) => {
                let boxed_ptr = unsafe { field_ptr.cast::<*mut c_void>().read_unaligned() };

                if boxed_ptr.is_null() {
                    return Ok(Value::Null);
                }

                let gtype = boxed_type.gtype();
                let boxed = Boxed::from_glib_none(gtype, boxed_ptr)?;
                Ok(Value::Object(NativeValue::Boxed(boxed).into()))
            }
            Type::Struct(ref struct_type) => {
                let struct_ptr = unsafe { field_ptr.cast::<*mut c_void>().read_unaligned() };

                if struct_ptr.is_null() {
                    return Ok(Value::Null);
                }

                let boxed = Boxed::from_glib_none_with_size(
                    None,
                    struct_ptr,
                    struct_type.size,
                    Some(&struct_type.type_name),
                )?;
                Ok(Value::Object(NativeValue::Boxed(boxed).into()))
            }
            Type::Fundamental(ref fundamental_type) => {
                let ptr = unsafe { field_ptr.cast::<*mut c_void>().read_unaligned() };

                if ptr.is_null() {
                    return Ok(Value::Null);
                }

                let (ref_fn, unref_fn) = fundamental_type.lookup_fns()?;
                let fundamental = unsafe { Fundamental::from_glib_none(ptr, ref_fn, unref_fn) };
                Ok(Value::Object(NativeValue::Fundamental(fundamental).into()))
            }
            Type::Void
            | Type::Array(_)
            | Type::HashTable(_)
            | Type::Callback(_)
            | Type::Trampoline(_)
            | Type::Ref(_)
            | Type::Unichar => {
                bail!("Unsupported field type for read: {:?}", self.field_type)
            }
        }
    }
}

pub fn read(mut cx: FunctionContext) -> JsResult<JsValue> {
    let request = ReadRequest::from_js(&mut cx)?;

    let value = gtk_dispatch::GtkDispatcher::global()
        .dispatch_and_wait(&mut cx, || request.execute())
        .or_else(|err| cx.throw_error(err.to_string()))?
        .or_else(|err| cx.throw_error(format!("Error during read: {err}")))?;

    value.to_js_value(&mut cx)
}

struct WriteRequest {
    handle: NativeHandle,
    field_type: Type,
    offset: usize,
    value: Value,
}

impl WriteRequest {
    fn from_js(cx: &mut FunctionContext) -> NeonResult<Self> {
        let handle = cx.argument::<JsBox<NativeHandle>>(0)?;
        let js_type = cx.argument::<JsObject>(1)?;
        let offset = cx.argument::<JsNumber>(2)?.value(cx) as usize;
        let js_value = cx.argument::<JsValue>(3)?;
        let field_type = Type::from_js_value(cx, js_type.upcast())?;
        let value = Value::from_js_value(cx, js_value)?;
        let handle = *handle.as_inner();

        Ok(Self {
            handle,
            field_type,
            offset,
            value,
        })
    }

    fn execute(self) -> anyhow::Result<()> {
        let base_ptr = self.handle.require_non_null_ptr()?;
        let field_ptr = unsafe { (base_ptr as *mut u8).add(self.offset) };

        match (&self.field_type, &self.value) {
            (Type::Integer(int_kind), Value::Number(n)) => {
                int_kind.write_ptr(field_ptr, *n);
            }
            (Type::Enum(_), Value::Number(n)) => {
                IntegerKind::I32.write_ptr(field_ptr, *n);
            }
            (Type::Flags(_), Value::Number(n)) => {
                IntegerKind::U32.write_ptr(field_ptr, *n);
            }
            (Type::Float(float_kind), Value::Number(n)) => {
                float_kind.write_ptr(field_ptr, *n);
            }
            (Type::Boolean, Value::Boolean(b)) => unsafe {
                field_ptr.cast::<i32>().write_unaligned(i32::from(*b));
            },
            (Type::GObject(_) | Type::Boxed(_) | Type::Struct(_) | Type::Fundamental(_), value) => {
                let ptr = value.object_ptr("field write target")?;
                unsafe {
                    field_ptr.cast::<*mut c_void>().write_unaligned(ptr);
                }
            }
            (Type::String(_), Value::String(s)) => {
                let c_string = std::ffi::CString::new(s.as_str())?;
                let duped = unsafe { glib::ffi::g_strdup(c_string.as_ptr()) };
                unsafe {
                    field_ptr.cast::<*mut c_char>().write_unaligned(duped);
                }
            }
            (Type::String(_), Value::Null) => unsafe {
                field_ptr
                    .cast::<*const c_char>()
                    .write_unaligned(std::ptr::null());
            },
            _ => bail!("Unsupported field type for write: {:?}", self.field_type),
        }

        Ok(())
    }
}

pub fn write(mut cx: FunctionContext) -> JsResult<JsUndefined> {
    let request = WriteRequest::from_js(&mut cx)?;

    gtk_dispatch::GtkDispatcher::global()
        .dispatch_and_wait(&mut cx, || request.execute())
        .or_else(|err| cx.throw_error(err.to_string()))?
        .or_else(|err| cx.throw_error(format!("Error during write: {err}")))?;

    Ok(cx.undefined())
}

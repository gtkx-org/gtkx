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
//!
//! ## Write Types
//!
//! Used for struct initialization in constructors:
//! - `Integer` (all sizes and signs)
//! - `Float` (f32, f64)
//! - `Boolean`

use std::ffi::{CStr, c_char, c_void};
use std::sync::mpsc;

use anyhow::bail;
use gtk4::glib::{self, translate::FromGlibPtrNone as _};
use neon::prelude::*;

use crate::{
    gtk_dispatch,
    managed::{Boxed, Fundamental, NativeHandle, NativeValue},
    types::Type,
    value::Value,
};

struct ReadRequest {
    handle: NativeHandle,
    field_type: Type,
    offset: usize,
    ptr_offset: Option<usize>,
}

impl ReadRequest {
    fn from_js(cx: &mut FunctionContext) -> NeonResult<Self> {
        let handle = cx.argument::<JsBox<NativeHandle>>(0)?;
        let js_type = cx.argument::<JsObject>(1)?;
        let offset = cx.argument::<JsNumber>(2)?.value(cx) as usize;
        let field_type = Type::from_js_value(cx, js_type.upcast())?;
        let handle = *handle.as_inner();

        let ptr_offset = cx
            .argument_opt(3)
            .and_then(|v| v.downcast::<JsNumber, _>(cx).ok())
            .map(|n| n.value(cx) as usize);

        Ok(Self {
            handle,
            field_type,
            offset,
            ptr_offset,
        })
    }

    fn execute(self) -> anyhow::Result<Value> {
        let base_ptr = self.handle.require_non_null_ptr()?;

        let field_ptr = if let Some(ptr_offset) = self.ptr_offset {
            let ptr_field = unsafe { (base_ptr as *const u8).add(ptr_offset) as *const *const u8 };
            let dereferenced_ptr = unsafe { ptr_field.read_unaligned() };
            if dereferenced_ptr.is_null() {
                anyhow::bail!("Pointer at offset {} is null", ptr_offset);
            }
            unsafe { dereferenced_ptr.add(self.offset) }
        } else {
            unsafe { (base_ptr as *const u8).add(self.offset) }
        };

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
            Type::Fundamental(ref fundamental_type) => {
                let ptr = unsafe { field_ptr.cast::<*mut c_void>().read_unaligned() };

                if ptr.is_null() {
                    return Ok(Value::Null);
                }

                let (ref_fn, unref_fn) = fundamental_type.lookup_fns()?;
                let fundamental = Fundamental::from_glib_none(ptr, ref_fn, unref_fn);
                Ok(Value::Object(NativeValue::Fundamental(fundamental).into()))
            }
            _ => bail!("Unsupported field type for read: {:?}", self.field_type),
        }
    }
}

pub fn read(mut cx: FunctionContext) -> JsResult<JsValue> {
    let request = ReadRequest::from_js(&mut cx)?;

    let (tx, rx) = mpsc::channel::<anyhow::Result<Value>>();

    gtk_dispatch::GtkDispatcher::global().enter_js_wait();
    gtk_dispatch::GtkDispatcher::global().schedule(move || {
        let _ = tx.send(request.execute());
    });

    let value = gtk_dispatch::GtkDispatcher::global()
        .wait_for_gtk_result(&mut cx, &rx)
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
            (Type::Integer(int_type), Value::Number(n)) => {
                int_type.kind.write_ptr(field_ptr, *n);
            }
            (Type::Float(float_kind), Value::Number(n)) => {
                float_kind.write_ptr(field_ptr, *n);
            }
            (Type::Boolean, Value::Boolean(b)) => unsafe {
                field_ptr.cast::<u8>().write_unaligned(u8::from(*b));
            },
            _ => bail!("Unsupported field type for write: {:?}", self.field_type),
        }

        Ok(())
    }
}

pub fn write(mut cx: FunctionContext) -> JsResult<JsUndefined> {
    let request = WriteRequest::from_js(&mut cx)?;

    let (tx, rx) = mpsc::channel::<anyhow::Result<()>>();

    gtk_dispatch::GtkDispatcher::global().enter_js_wait();
    gtk_dispatch::GtkDispatcher::global().schedule(move || {
        let _ = tx.send(request.execute());
    });

    gtk_dispatch::GtkDispatcher::global()
        .wait_for_gtk_result(&mut cx, &rx)
        .or_else(|err| cx.throw_error(err.to_string()))?
        .or_else(|err| cx.throw_error(format!("Error during write: {err}")))?;

    Ok(cx.undefined())
}

struct ReadPointerRequest {
    handle: NativeHandle,
    ptr_offset: usize,
    element_offset: usize,
}

impl ReadPointerRequest {
    fn from_js(cx: &mut FunctionContext) -> NeonResult<Self> {
        let handle = cx.argument::<JsBox<NativeHandle>>(0)?;
        let ptr_offset = cx.argument::<JsNumber>(1)?.value(cx) as usize;
        let element_offset = cx.argument::<JsNumber>(2)?.value(cx) as usize;
        let handle = *handle.as_inner();

        Ok(Self {
            handle,
            ptr_offset,
            element_offset,
        })
    }

    fn execute(self) -> anyhow::Result<NativeHandle> {
        let base_ptr = self.handle.require_non_null_ptr()?;

        let ptr_field =
            unsafe { (base_ptr as *const u8).add(self.ptr_offset) as *const *mut c_void };
        let array_ptr = unsafe { ptr_field.read_unaligned() };

        if array_ptr.is_null() {
            anyhow::bail!("Pointer at offset {} is null", self.ptr_offset);
        }

        let element_ptr = unsafe { (array_ptr as *mut u8).add(self.element_offset) as *mut c_void };
        let boxed = Boxed::borrowed(None, element_ptr);
        Ok(NativeValue::Boxed(boxed).into())
    }
}

pub fn read_pointer(mut cx: FunctionContext) -> JsResult<JsValue> {
    let request = ReadPointerRequest::from_js(&mut cx)?;

    let (tx, rx) = mpsc::channel::<anyhow::Result<NativeHandle>>();

    gtk_dispatch::GtkDispatcher::global().enter_js_wait();
    gtk_dispatch::GtkDispatcher::global().schedule(move || {
        let _ = tx.send(request.execute());
    });

    let handle = gtk_dispatch::GtkDispatcher::global()
        .wait_for_gtk_result(&mut cx, &rx)
        .or_else(|err| cx.throw_error(err.to_string()))?
        .or_else(|err| cx.throw_error(format!("Error during read_pointer: {err}")))?;

    Ok(cx.boxed(handle).upcast())
}

struct WritePointerRequest {
    dest_handle: NativeHandle,
    ptr_offset: usize,
    element_offset: usize,
    source_handle: NativeHandle,
    size: usize,
}

impl WritePointerRequest {
    fn from_js(cx: &mut FunctionContext) -> NeonResult<Self> {
        let dest_handle = cx.argument::<JsBox<NativeHandle>>(0)?;
        let ptr_offset = cx.argument::<JsNumber>(1)?.value(cx) as usize;
        let element_offset = cx.argument::<JsNumber>(2)?.value(cx) as usize;
        let source_handle = cx.argument::<JsBox<NativeHandle>>(3)?;
        let size = cx.argument::<JsNumber>(4)?.value(cx) as usize;

        Ok(Self {
            dest_handle: *dest_handle.as_inner(),
            ptr_offset,
            element_offset,
            source_handle: *source_handle.as_inner(),
            size,
        })
    }

    fn execute(self) -> anyhow::Result<()> {
        let dest_base = self.dest_handle.require_non_null_ptr()?;
        let source_ptr = self.source_handle.require_non_null_ptr()?;

        let ptr_field =
            unsafe { (dest_base as *const u8).add(self.ptr_offset) as *const *mut c_void };
        let array_ptr = unsafe { ptr_field.read_unaligned() };

        if array_ptr.is_null() {
            anyhow::bail!("Pointer at offset {} is null", self.ptr_offset);
        }

        let element_ptr = unsafe { (array_ptr as *mut u8).add(self.element_offset) };

        unsafe {
            std::ptr::copy_nonoverlapping(source_ptr as *const u8, element_ptr, self.size);
        }

        Ok(())
    }
}

pub fn write_pointer(mut cx: FunctionContext) -> JsResult<JsUndefined> {
    let request = WritePointerRequest::from_js(&mut cx)?;

    let (tx, rx) = mpsc::channel::<anyhow::Result<()>>();

    gtk_dispatch::GtkDispatcher::global().enter_js_wait();
    gtk_dispatch::GtkDispatcher::global().schedule(move || {
        let _ = tx.send(request.execute());
    });

    gtk_dispatch::GtkDispatcher::global()
        .wait_for_gtk_result(&mut cx, &rx)
        .or_else(|err| cx.throw_error(err.to_string()))?
        .or_else(|err| cx.throw_error(format!("Error during write_pointer: {err}")))?;

    Ok(cx.undefined())
}

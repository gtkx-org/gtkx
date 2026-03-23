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

use std::ffi::c_void;

use neon::prelude::*;

use super::handler::{ModuleRequest, dispatch_request};
use crate::{
    managed::NativeHandle,
    types::{RawPtrCodec as _, Type},
    value::Value,
};

struct ReadRequest {
    handle: NativeHandle,
    field_type: Type,
    offset: usize,
}

impl ModuleRequest for ReadRequest {
    type Output = Value;

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
        let field_ptr = unsafe { (base_ptr as *const u8).add(self.offset) as *const c_void };
        self.field_type.read_from_raw_ptr(field_ptr, "field read")
    }

    fn error_context() -> &'static str {
        "field read"
    }
}

pub fn read(mut cx: FunctionContext) -> JsResult<JsValue> {
    dispatch_request::<ReadRequest>(&mut cx)
}

struct WriteRequest {
    handle: NativeHandle,
    field_type: Type,
    offset: usize,
    value: Value,
}

impl ModuleRequest for WriteRequest {
    type Output = ();

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
        let field_ptr = unsafe { (base_ptr as *mut u8).add(self.offset) as *mut c_void };
        self.field_type
            .write_value_to_raw_ptr(field_ptr, &self.value)
    }

    fn error_context() -> &'static str {
        "field write"
    }
}

pub fn write(mut cx: FunctionContext) -> JsResult<JsUndefined> {
    dispatch_request::<WriteRequest>(&mut cx)?;
    Ok(cx.undefined())
}
